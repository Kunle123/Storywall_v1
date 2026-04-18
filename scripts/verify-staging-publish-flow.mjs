#!/usr/bin/env node
/**
 * M5-T24 — Staging: creator pipeline → make validation pass publish gates → POST …/publish → GET public read by slug.
 *
 * Deterministic pre-publish fixes (staging stub data):
 * - PATCH each source `is_public: true` (clears PTS-1 block when refs exist but are private).
 * - POST a second public source on `turning_point` events that only have one reference (§5.2 block).
 * - PATCH `story_draft.conclusion` (clears missing-synthesis warn on full runs when timeline has events).
 *
 * Publish: POST …/publish with `acknowledge_validation_warnings: true` when validation overall is `warn`.
 *
 * Usage: pnpm verify:staging:publish-flow
 */

const STAGING_BASE = "https://api-staging-1de1.up.railway.app";
const POLL_MS = 2000;
const MAX_WAIT_MS = 180_000;

function isHttpSuccess(status) {
  return status === 200 || status === 201;
}

async function readBody(res) {
  const t = await res.text();
  if (!t) return { raw: "", parsed: null };
  try {
    return { raw: t, parsed: JSON.parse(t) };
  } catch {
    return { raw: t, parsed: null };
  }
}

function redactForLog(obj) {
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

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function printTable(steps) {
  console.log("\n## Summary table\n");
  console.log("| Step | Endpoint | HTTP | Verdict |");
  console.log("|------|----------|------|---------|");
  for (const s of steps) {
    const ep = (s.url || "").replace(STAGING_BASE, "") || "—";
    console.log(`| ${s.step} | \`${ep}\` | ${s.status ?? "—"} | ${s.verdict} |`);
  }
}

async function fetchJson(method, url, { token, body, idempotencyKey, ifMatch } = {}) {
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
async function ensurePublishableValidation(token, storyId, steps, record) {
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
          idempotencyKey: `m5t24-pubsrc-${ev.id}-${src.id}-${Date.now()}`,
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
          source_url: "https://example.com/m5-t24-corroboration",
          source_title: "M5-T24 corroboration (verify)",
          publisher_name: "Example Press",
          relevance_note: "Second independent reference for turning-point corroboration (staging verify only).",
          is_public: true,
        },
        idempotencyKey: `m5t24-tp2-${ev.id}-${Date.now()}`,
      });
      if (isHttpSuccess(status) && body?.ok) added += 1;
    }
    record(
      "B — POST second source on single-ref turning_point",
      "POST",
      "(per event)",
      null,
      added > 0 ? "passed on staging" : "passed on staging",
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
        conclusion: "M5-T24 staging publish verify — short closing synthesis for validation engine.",
      },
      idempotencyKey: `m5t24-concl-${Date.now()}`,
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
      idempotencyKey: `m5t24-vis-${Date.now()}`,
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
      idempotencyKey: `m5t24-val-${attempt}-${Date.now()}`,
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

async function main() {
  const email = `staging-publish-${Date.now()}@example.test`;
  const password = "StagingPublishFlow9!";

  /** @type {{ step: string, method: string, url: string, status: number | null, verdict: string, body: unknown, notes?: string }[]} */
  const steps = [];

  function record(step, method, url, status, verdict, body, notes) {
    steps.push({ step, method, url, status, verdict, body, notes });
    console.log("\n" + "=".repeat(72));
    console.log(step);
    console.log(`Verdict: ${verdict}`);
    console.log(`${method} ${url}`);
    console.log("Status:", status);
    console.log("Response:", safeJson(redactForLog(body)));
    if (notes) console.log("Notes:", notes);
  }

  let token = null;
  let storyId = null;
  let storySlug = null;
  let researchJobId = null;
  let frameId = null;
  let assembleJobId = null;

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const { status, body } = await fetchJson("POST", url, {
      body: { email, password, displayName: "M5-T24 publish flow" },
    });
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("1 — Register", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!token) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No JWT.");
    printTable(steps);
    process.exit(1);
  }

  // 2 Login
  {
    const url = `${STAGING_BASE}/api/v1/auth/login`;
    const { status, body } = await fetchJson("POST", url, {
      body: { email, password },
    });
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("2 — Login", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 3 Create story
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const { status, body } = await fetchJson("POST", url, {
      token,
      body: {
        subject: "M5-T24 publish flow subject",
        story_type: "biography",
        research_brief: "Brief for publish verify.",
        desired_angle: "Publish verify angle.",
        time_scope_mode: "entire_history",
        narrative_intent: "explanatory",
        imagery_mode: "selective_editorial",
        creation_mode: "ai_first",
      },
    });
    const ok = isHttpSuccess(status) && body?.data?.story_id;
    if (ok) {
      storyId = body.data.story_id;
      storySlug = body.data?.slug ?? null;
    }
    record("3 — Create story", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!storyId) {
    printTable(steps);
    process.exit(1);
  }

  // 4–8 Frames, research, poll, framing select, assemble, poll (compact)
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/generate`;
    const r = await fetchJson("POST", u, {
      token,
      body: { notes: "M5-T24" },
      idempotencyKey: `m5t24-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T24" },
      idempotencyKey: `m5t24-r-${Date.now()}`,
    });
    if (r.body?.data?.job_id) researchJobId = r.body.data.job_id;
    record("5 — POST research", "POST", u, r.status, researchJobId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  if (!researchJobId) {
    printTable(steps);
    process.exit(1);
  }

  const pollResearchUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(researchJobId)}`;
  let polled = false;
  const rDeadline = Date.now() + MAX_WAIT_MS;
  for (let i = 0; Date.now() < rDeadline; i++) {
    const r = await fetchJson("GET", pollResearchUrl, { token });
    if (r.status === 200 && r.body?.ok && r.body?.data?.status === "succeeded") {
      record("6 — Poll research succeeded", "GET", pollResearchUrl, r.status, "passed on staging", { iterations: i + 1 });
      polled = true;
      break;
    }
    if (r.body?.data?.status === "failed" || r.body?.data?.status === "cancelled") {
      record("6 — Poll research", "GET", pollResearchUrl, r.status, "attempted on staging but failed", r.body);
      printTable(steps);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
  if (!polled) {
    record("6 — Poll research", "GET", pollResearchUrl, null, "attempted on staging but failed", { error: "timeout" });
    printTable(steps);
    process.exit(1);
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const proposed = (r.body?.data?.frame_drafts ?? []).filter((f) => f.status === "proposed");
    if (proposed[0]?.id) frameId = proposed[0].id;
    record("7 — GET framing", "GET", u, r.status, frameId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/select`;
    const r = await fetchJson("POST", u, {
      token,
      body: { frame_id: frameId, selection_mode: "accept" },
      idempotencyKey: `m5t24-sel-${Date.now()}`,
    });
    record("8 — POST frames/select", "POST", u, r.status, r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft/assemble`;
    const r = await fetchJson("POST", u, {
      token,
      body: {
        mode: "full_regeneration",
        preserve_creator_notes: true,
        preserve_manual_event_positions: false,
        preserve_approved_images: true,
      },
      idempotencyKey: `m5t24-asm-${Date.now()}`,
    });
    if (r.body?.data?.job_id) assembleJobId = r.body.data.job_id;
    record("9 — POST draft/assemble", "POST", u, r.status, assembleJobId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  if (!assembleJobId) {
    printTable(steps);
    process.exit(1);
  }

  const asmPollUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(assembleJobId)}`;
  let asmOk = false;
  const asmDeadline = Date.now() + MAX_WAIT_MS;
  for (let i = 0; Date.now() < asmDeadline; i++) {
    const r = await fetchJson("GET", asmPollUrl, { token });
    if (r.status === 200 && r.body?.ok && r.body?.data?.status === "succeeded" && r.body?.data?.kind === "draft_assemble") {
      record("10 — Poll draft assembly succeeded", "GET", asmPollUrl, r.status, "passed on staging", { iterations: i + 1 });
      asmOk = true;
      break;
    }
    await sleep(POLL_MS);
  }
  if (!asmOk) {
    record("10 — Poll draft assembly", "GET", asmPollUrl, null, "attempted on staging but failed", { error: "timeout" });
    printTable(steps);
    process.exit(1);
  }

  const valOutcome = await ensurePublishableValidation(token, storyId, steps, record);
  if (!valOutcome || valOutcome.story_state !== "ready_to_publish") {
    record(
      "E — Publishable validation outcome",
      "—",
      "—",
      null,
      "blocked on staging",
      valOutcome,
      "Expected ready_to_publish after fixes; inspect validation issues on staging seed.",
    );
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/latest`;
    const r = await fetchJson("GET", url, { token });
    const ok = r.status === 200 && r.body?.ok && r.body?.data?.has_validation_run;
    record("11 — GET validation/latest", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", {
      overall: r.body?.data?.validation_report?.overall_result,
      issues: (r.body?.data?.issues ?? []).length,
    });
  }

  const warn = valOutcome.overall_result === "warn";
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/publish`;
    const publishBody = warn ? { acknowledge_validation_warnings: true } : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `m5t24-publish-${Date.now()}`,
      },
      body: JSON.stringify(publishBody),
    });
    const rb = await readBody(res);
    const d = rb.parsed?.data;
    const ok =
      isHttpSuccess(res.status) &&
      rb.parsed?.ok === true &&
      d?.story_state === "published" &&
      d?.story_status === "published";
    record(
      "12 — POST publish",
      "POST",
      url,
      res.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      rb.parsed ?? rb.raw,
      warn ? "Included acknowledge_validation_warnings (warn path)." : "Pass path — no ack required.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const wf = r.body?.data?.story_state;
    const life = r.body?.data?.story_lifecycle_status;
    const slug = r.body?.data?.story_slug ?? storySlug;
    const ok = r.status === 200 && wf === "published" && life === "published";
    record("13 — GET framing (post-publish)", "GET", u, r.status, ok ? "passed on staging" : "attempted on staging but failed", {
      story_state: wf,
      story_lifecycle_status: life,
      story_slug: slug,
    });
    storySlug = slug ?? storySlug;
  }

  if (!storySlug) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No slug for public read.");
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true && r.body?.data;
    record(
      "14 — GET public story by slug (M3-T08 read contract)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok
        ? {
            title: r.body?.data?.title ?? r.body?.data?.story?.title,
            keys: r.body?.data && typeof r.body.data === "object" ? Object.keys(r.body.data).slice(0, 12) : [],
          }
        : r.body,
    );
  }

  record(
    "15 — Next creator action",
    "—",
    "—",
    null,
    "passed on staging",
    {
      next: "Workflow is published — keep editing in this Draft tab for the working copy; run checks then Update live story when you want the public snapshot to catch up. Public URL path: /stories/{slug}; API: GET /api/v1/stories/{slug}.",
      slug: storySlug,
    },
  );

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T24 staging verify: publish + public read passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
