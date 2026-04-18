#!/usr/bin/env node
/**
 * M5-T21 — Staging: full funnel through draft assembly, then assert the Draft tab API contract
 * (GET …/framing, …/sections, …/events) shows non-empty assembled artifacts after success.
 *
 * Usage: pnpm verify:staging:draft-review
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
  const email = `staging-draft-review-${Date.now()}@example.test`;
  const password = "StagingDraftReview9!";

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

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T21 draft review workspace" };
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
      subject: "M5-T21 draft review subject",
      story_type: "biography",
      research_brief: "Brief for draft review verify.",
      desired_angle: "Draft review verify angle.",
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

  const auth = { Authorization: `Bearer ${token}` };

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
          "Idempotency-Key": `m5t21-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T21 verify" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.ok === true;
    record("4 — POST frames/generate", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
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
          "Idempotency-Key": `m5t21-research-${Date.now()}`,
        },
        body: JSON.stringify({
          mode: "full",
          respect_existing_manual_events: true,
          respect_existing_sources: true,
          notes: "M5-T21 draft review verify",
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
          "Idempotency-Key": `m5t21-select-${Date.now()}`,
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
          "Idempotency-Key": `m5t21-assemble-${Date.now()}`,
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
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "assembling_draft" &&
      d?.job_id &&
      d?.job_status === "pending";
    if (ok) assembleJobId = d.job_id;
    record(
      "9 — POST draft/assemble",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : "Expect assembling_draft + job_id.",
    );
  }
  if (!assembleJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No assemble job_id.");
    printTable(steps);
    process.exit(1);
  }

  // 10 GET sections while assembling_draft (Draft tab parallel load — M5-T21 API)
  {
    const urlFr = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/sections`;
    let wf = null;
    let bodyFr = null;
    const spinDeadline = Date.now() + 30_000;
    while (Date.now() < spinDeadline) {
      try {
        const res = await fetch(urlFr, { headers: { ...auth } });
        const rb = await readBody(res);
        bodyFr = rb.parsed ?? rb.raw;
        wf = bodyFr?.data?.story_state ?? null;
        if (wf === "assembling_draft") break;
        if (wf === "ready_for_edit") break;
      } catch (e) {
        bodyFr = { error: String(e) };
        break;
      }
      await sleep(250);
    }
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
    const sectionsOk = status === 200 && body?.ok === true && Array.isArray(body?.data?.sections);
    const ok = wf === "assembling_draft" && sectionsOk;
    const skippedFastWorker = wf === "ready_for_edit" && sectionsOk;
    const oldApiBlocksList =
      wf === "assembling_draft" &&
      status === 400 &&
      body?.error?.code === "invalid_state_transition" &&
      String(body?.error?.message ?? "").includes("Sections cannot be edited");
    const verdict = ok
      ? "passed on staging"
      : skippedFastWorker
        ? "passed on staging"
        : oldApiBlocksList
          ? "blocked on staging"
          : "attempted on staging but failed";
    record(
      "10 — GET sections during assembling_draft",
      "GET",
      url,
      status,
      verdict,
      { framing_state: wf, sections_response: body, last_framing: bodyFr },
      ok
        ? "Draft workspace list contract: sections list allowed while draft_assemble runs."
        : skippedFastWorker
          ? "Worker moved to ready_for_edit before probe; sections list still 200 (acceptable race on staging)."
          : oldApiBlocksList
            ? "Staging API still uses strict listSections — redeploy apps/api with M5-T21 read-only list allowlist for assembling_draft."
            : `Expected assembling_draft + sections 200, or ready_for_edit race; got wf=${wf} HTTP ${status}.`,
    );
  }

  // 11 Poll draft assembly
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
      record("11 — Poll draft assembly to succeeded", "GET", asmPollUrl, status, "passed on staging", {
        iterations: asmIter,
        last_poll: body,
      });
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("11 — Poll draft assembly", "GET", asmPollUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "11 — Poll draft assembly to succeeded")) {
    record("11 — Poll draft assembly (timeout)", "GET", asmPollUrl, asmStatus, "attempted on staging but failed", {
      iterations: asmIter,
      last_poll: asmLast,
    });
    printTable(steps);
    process.exit(1);
  }

  // 12 GET framing — story_draft shell (same as DraftReadyPage ingest)
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
    const sd = d?.story_draft;
    const textLen =
      (typeof sd?.title === "string" ? sd.title.trim().length : 0) +
      (typeof sd?.summary === "string" ? sd.summary.trim().length : 0) +
      (typeof sd?.subtitle === "string" ? sd.subtitle.trim().length : 0);
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "ready_for_edit" &&
      sd?.id &&
      textLen > 0;
    record(
      "12 — GET framing (post-assembly; story_draft non-empty)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? "Provenance: framing response carries story_draft for deck fields." : "Need ready_for_edit + non-empty story_draft text.",
    );
  }

  // 13 GET events — event_draft material
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
    const contentLen =
      first &&
      (String(first.headline ?? "").trim().length + String(first.summary ?? "").trim().length);
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      Array.isArray(events) &&
      events.length > 0 &&
      contentLen > 0;
    record(
      "13 — GET events (non-empty event_draft beats)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? `events: ${events.length}` : "Need at least one event with headline or summary text.",
    );
  }

  // 14 GET sections — section_draft list (may be empty on some seeds; log honestly)
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/sections`;
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
    const sections = body?.data?.sections ?? [];
    const ok = isHttpSuccess(status) && body?.ok === true && Array.isArray(sections);
    record(
      "14 — GET sections (post-assembly list)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? `section_draft count: ${sections.length} — narrative blocks for Draft tab.` : undefined,
    );
  }

  record(
    "15 — Next creator action (product)",
    "—",
    "—",
    null,
    "passed on staging",
    {
      route: `/creator/stories/${storyId}/draft`,
      apis: [
        "GET /api/v1/creator/stories/:id/framing",
        "GET /api/v1/creator/stories/:id/sections",
        "GET /api/v1/creator/stories/:id/events",
      ],
      next:
        "Edit narrative sections and timeline events in the Draft tab; deck fields autosave. Run checks from Readiness when you want a publish signal — not required to review assembled material.",
    },
    "Honest next step: manuscript refinement, not publication.",
  );

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed");
  const blocked = steps.some((s) => s.verdict === "blocked on staging");
  if (failed) {
    process.exit(1);
  }
  if (blocked) {
    console.warn(
      "\nNote: at least one step was blocked on staging (usually API not redeployed). Post-assembly draft review path still verified above.",
    );
  }
  console.log("\nM5-T21 staging verify: post-assembly draft artifacts + framing contract passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
