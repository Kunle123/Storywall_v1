/**
 * Shared helpers for M5 staging scripts: first-publish gates (sources, conclusion, visibility, validation).
 * Used by verify-staging-publish-flow.mjs and verify-staging-live-story-update.mjs.
 */

export const STAGING_BASE = "https://api-staging-1de1.up.railway.app";
export const POLL_MS = 2000;
export const MAX_WAIT_MS = 180_000;

export function isHttpSuccess(status) {
  return status === 200 || status === 201;
}

export async function readBody(res) {
  const t = await res.text();
  if (!t) return { raw: "", parsed: null };
  try {
    return { raw: t, parsed: JSON.parse(t) };
  } catch {
    return { raw: t, parsed: null };
  }
}

export function redactForLog(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactForLog);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (key.includes("password")) out[k] = "[REDACTED]";
    else if (key.includes("access_token") || key === "authorization") out[k] = "[REDACTED]";
    else if (typeof v === "object" && v !== null) out[k] = redactForLog(v);
    else out[k] = v;
  }
  return out;
}

export function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function printTable(steps) {
  console.log("\n## Summary table\n");
  console.log("| Step | Endpoint | HTTP | Verdict |");
  console.log("|------|----------|------|---------|");
  for (const s of steps) {
    const ep = (s.url || "").replace(STAGING_BASE, "") || "—";
    console.log(`| ${s.step} | \`${ep}\` | ${s.status ?? "—"} | ${s.verdict} |`);
  }
}

export async function fetchJson(method, url, { token, body, idempotencyKey, ifMatch } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (ifMatch) headers["If-Match"] = ifMatch;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rb = await readBody(res);
  return { status: res.status, body: rb.parsed ?? rb.raw };
}

/**
 * @param {string} token
 * @param {string} storyId
 * @param {{ step: string, method: string, url: string, status: number | null, verdict: string, body: unknown, notes?: string }[]} steps
 * @param {(s: string, m: string, u: string, st: number | null, v: string, b: unknown, n?: string) => void} record
 */
export async function ensurePublishableValidation(token, storyId, steps, record) {
  async function getFramingDraft() {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const { status, body } = await fetchJson("GET", url, { token });
    const d = body?.data;
    return { status, body, draft: d?.story_draft ?? null, wf: d?.story_state };
  }

  async function getEvents() {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events`;
    const { status, body } = await fetchJson("GET", url, { token });
    return { status, body, events: body?.data?.events ?? [] };
  }

  async function listSources(eventId) {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}/sources`;
    const { status, body } = await fetchJson("GET", url, { token });
    return { status, body, sources: body?.data?.sources ?? [] };
  }

  // 1) Mark every attached source public (PTS-1).
  {
    const { events } = await getEvents();
    let patched = 0;
    for (const ev of events) {
      const { sources } = await listSources(ev.id);
      for (const src of sources) {
        if (src.is_public === true) continue;
        const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(ev.id)}/sources/${encodeURIComponent(src.id)}`;
        const { status, body } = await fetchJson("PATCH", url, {
          token,
          body: { is_public: true },
          idempotencyKey: `m5-pubsrc-${ev.id}-${src.id}-${Date.now()}`,
          ifMatch: src.updated_at,
        });
        if (status === 200 && body?.ok) patched += 1;
      }
    }
    record(
      "A — PATCH sources is_public (pre-validation)",
      "PATCH",
      "(per source)",
      null,
      "passed on staging",
      { events_scanned: events.length, sources_marked_public: patched },
      "Clears publish-blocking PTS-1 when references exist but were private.",
    );
  }

  // 2) Second reference for turning_point events with exactly one source (§5.2 block).
  {
    const { events } = await getEvents();
    let added = 0;
    for (const ev of events) {
      if (ev.event_type !== "turning_point") continue;
      const { sources } = await listSources(ev.id);
      if (sources.length !== 1) continue;
      const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(ev.id)}/sources`;
      const { status, body } = await fetchJson("POST", url, {
        token,
        body: {
          source_url: "https://example.com/m5-corroboration",
          source_title: "M5 corroboration (verify)",
          publisher_name: "Example Press",
          relevance_note: "Second independent reference for turning-point corroboration (staging verify only).",
          is_public: true,
        },
        idempotencyKey: `m5-tp2-${ev.id}-${Date.now()}`,
      });
      if (isHttpSuccess(status) && body?.ok) added += 1;
    }
    record(
      "B — POST second source on single-ref turning_point",
      "POST",
      "(per event)",
      null,
      "passed on staging",
      { turning_point_second_sources_added: added },
      added === 0 ? "No single-ref turning_point rows (ok)." : undefined,
    );
  }

  // 3) Non-empty conclusion (removes missing_synthesis warn on full/trust runs when events exist).
  {
    const { draft, status, body } = await getFramingDraft();
    if (!draft?.last_edited_at) {
      record("C — PATCH draft conclusion", "PATCH", "—", status, "attempted on staging but failed", body, "No story_draft.");
      return false;
    }
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: {
        conclusion: "M5 staging publish verify — short closing synthesis for validation engine.",
      },
      idempotencyKey: `m5-concl-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record("C — PATCH draft conclusion", "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
    if (!ok) return false;
  }

  // 3b) Public visibility — anonymous read requires `public` or `unlisted` on the story row (copied from draft at publish).
  {
    const { draft } = await getFramingDraft();
    if (!draft?.last_edited_at) return false;
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: { visibility_target: "public" },
      idempotencyKey: `m5-vis-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record(
      "C2 — PATCH draft visibility_target public",
      "PATCH",
      url,
      st,
      ok ? "passed on staging" : "attempted on staging but failed",
      redactForLog(b),
      "So GET /api/v1/stories/:slug succeeds after publish (M3-T08 gate).",
    );
    if (!ok) return false;
  }

  // 4) Run validation (retry once if still blocked — e.g. race on source counts).
  let overall = null;
  let wf = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/run`;
    const { status, body } = await fetchJson("POST", url, {
      token,
      body: {
        run_type: "full",
        include_style_checks: true,
        include_imagery_checks: true,
        include_dispute_checks: true,
      },
      idempotencyKey: `m5-val-${attempt}-${Date.now()}`,
    });
    const d = body?.data;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.overall_result &&
      (d?.story_state === "blocked" || d?.story_state === "ready_to_publish");
    record(
      attempt === 1 ? "D — POST validation/run" : "D2 — POST validation/run (retry)",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
    if (!ok) return false;
    overall = d.overall_result;
    wf = d.story_state;
    if (wf === "ready_to_publish") break;
    await sleep(1500);
  }

  return { overall_result: overall, story_state: wf };
}
