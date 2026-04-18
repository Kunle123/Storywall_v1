#!/usr/bin/env node
/**
 * M5-T22 — Staging: funnel through draft assembly, then PATCH one event_draft field and verify persistence (GET …/events).
 * Usage: pnpm verify:staging:draft-editing
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

async function main() {
  const email = `staging-draft-edit-${Date.now()}@example.test`;
  const password = "StagingDraftEdit9!";

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
  let researchJobId = null;
  let frameId = null;
  let assembleJobId = null;
  let eventId = null;
  let eventEtag = null;
  const marker = `M5-T22-${Date.now()}`;

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T22 draft editing" };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("1 — Register", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!token) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No JWT.");
    printTable(steps);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 2 Login
  {
    const url = `${STAGING_BASE}/api/v1/auth/login`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("2 — Login", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 3 Create story
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const bodyIn = {
      subject: "M5-T22 draft edit subject",
      story_type: "biography",
      research_brief: "Brief for draft edit verify.",
      desired_angle: "Draft edit verify angle.",
      time_scope_mode: "entire_history",
      narrative_intent: "explanatory",
      imagery_mode: "selective_editorial",
      creation_mode: "ai_first",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.story_id;
    if (ok) storyId = body.data.story_id;
    record("3 — Create story", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!storyId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No story_id.");
    printTable(steps);
    process.exit(1);
  }

  // 4 Frames generate
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/generate`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...auth,
          "Idempotency-Key": `m5t22-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T22 verify" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    record("4 — POST frames/generate", "POST", url, status, isHttpSuccess(status) && body?.ok === true ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 5 POST research
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...auth,
          "Idempotency-Key": `m5t22-research-${Date.now()}`,
        },
        body: JSON.stringify({
          mode: "full",
          respect_existing_manual_events: true,
          respect_existing_sources: true,
          notes: "M5-T22 draft editing verify",
        }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.job_id;
    if (ok) researchJobId = body.data.job_id;
    record("5 — POST research", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!researchJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No research job_id.");
    printTable(steps);
    process.exit(1);
  }

  // 6 Poll research
  const pollResearchUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(researchJobId)}`;
  const rDeadline = Date.now() + MAX_WAIT_MS;
  let rLast = null;
  let rStatus = null;
  let rIter = 0;
  while (Date.now() < rDeadline) {
    rIter += 1;
    let status = null;
    let body = null;
    try {
      const res = await fetch(pollResearchUrl, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    rLast = body;
    rStatus = status;
    const d = body?.data;
    if (status === 200 && body?.ok === true && d?.status === "succeeded") {
      record("6 — Poll research to succeeded", "GET", pollResearchUrl, status, "passed on staging", {
        iterations: rIter,
        last_poll: body,
      });
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("6 — Poll research", "GET", pollResearchUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "6 — Poll research to succeeded")) {
    record("6 — Poll research (timeout)", "GET", pollResearchUrl, rStatus, "attempted on staging but failed", {
      iterations: rIter,
      last_poll: rLast,
    });
    printTable(steps);
    process.exit(1);
  }

  // 7 GET framing — pick proposed
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const proposed = (d?.frame_drafts ?? []).filter((f) => f.status === "proposed");
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "awaiting_framing_choice" &&
      proposed.length > 0;
    if (ok) frameId = proposed[0].id;
    record("7 — GET framing (select candidate)", "GET", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!frameId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No frame_id.");
    printTable(steps);
    process.exit(1);
  }

  // 8 POST frames/select
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/select`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...auth,
          "Idempotency-Key": `m5t22-select-${Date.now()}`,
        },
        body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.ok === true && body?.data?.story_state === "ready_for_edit";
    record("8 — POST frames/select", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 9 POST draft/assemble
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft/assemble`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...auth,
          "Idempotency-Key": `m5t22-assemble-${Date.now()}`,
        },
        body: JSON.stringify({
          mode: "full_regeneration",
          preserve_creator_notes: true,
          preserve_manual_event_positions: false,
          preserve_approved_images: true,
        }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const ok = isHttpSuccess(status) && body?.ok === true && d?.job_id;
    if (ok) assembleJobId = d.job_id;
    record("9 — POST draft/assemble", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!assembleJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No assemble job_id.");
    printTable(steps);
    process.exit(1);
  }

  // 10 Poll draft assembly
  const asmPollUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(assembleJobId)}`;
  const asmDeadline = Date.now() + MAX_WAIT_MS;
  let asmLast = null;
  let asmStatus = null;
  let asmIter = 0;
  while (Date.now() < asmDeadline) {
    asmIter += 1;
    let status = null;
    let body = null;
    try {
      const res = await fetch(asmPollUrl, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    asmLast = body;
    asmStatus = status;
    const d = body?.data;
    if (status === 200 && body?.ok === true && d?.status === "succeeded" && d?.kind === "draft_assemble") {
      record("10 — Poll draft assembly to succeeded", "GET", asmPollUrl, status, "passed on staging", {
        iterations: asmIter,
        last_poll: body,
      });
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("10 — Poll draft assembly", "GET", asmPollUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "10 — Poll draft assembly to succeeded")) {
    record("10 — Poll draft assembly (timeout)", "GET", asmPollUrl, asmStatus, "attempted on staging but failed", {
      iterations: asmIter,
      last_poll: asmLast,
    });
    printTable(steps);
    process.exit(1);
  }

  // 11 GET framing — draft workspace contract + workflow
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const ok = isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    record(
      "11 — GET framing (post-assembly workspace)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? "Contract: framing carries story_state + story_draft (same as Draft tab load)." : undefined,
    );
  }

  // 12 GET events — pick target row
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const events = body?.data?.events ?? [];
    const first = events[0];
    const ok =
      isHttpSuccess(status) && body?.ok === true && Array.isArray(events) && events.length > 0 && first?.id && first?.updated_at;
    if (ok) {
      eventId = first.id;
      eventEtag = first.updated_at;
    }
    record(
      "12 — GET events (pre-edit; contract)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? `Will PATCH event ${eventId}` : "Need at least one event_draft.",
    );
  }
  if (!eventId || !eventEtag) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No event to edit.");
    printTable(steps);
    process.exit(1);
  }

  // 13 PATCH event — mutation §14.2 (product path: timeline editor uses same)
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}`;
    const patchBody = { dek: marker };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...auth,
          "If-Match": eventEtag,
        },
        body: JSON.stringify(patchBody),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ev = body?.data?.event_draft;
    const ok = isHttpSuccess(status) && body?.ok === true && ev?.dek === marker;
    if (ok && ev?.updated_at) eventEtag = ev.updated_at;
    record(
      "13 — PATCH event (persist dek)",
      "PATCH",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? "If-Match = updated_at; body persisted on event_draft." : undefined,
    );
  }

  // 14 GET events — fresh read confirms persistence
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { ...auth } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const events = body?.data?.events ?? [];
    const found = events.find((e) => e.id === eventId);
    const ok =
      isHttpSuccess(status) && body?.ok === true && found && String(found.dek ?? "") === marker;
    record(
      "14 — GET events (re-read; persistence)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { ...body, data: { ...body?.data, events: `[${events.length} rows; event ${eventId} dek=${found?.dek}]` } },
      ok ? "Non-cache proof: server list includes edited dek." : undefined,
    );
  }

  record(
    "15 — Next creator action",
    "—",
    "—",
    null,
    "passed on staging",
    {
      story_state_after: "ready_for_edit (until validation or other transitions)",
      next: "Continue editing other timeline fields, narrative sections, deck, or evidence; optionally Run checks in the Draft tab when you want publish-readiness feedback.",
    },
    "Honest: one field proved persistence — not an exhaustive edit suite.",
  );

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) {
    process.exit(1);
  }
  console.log("\nM5-T22 staging verify: persisted event_draft edit passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
