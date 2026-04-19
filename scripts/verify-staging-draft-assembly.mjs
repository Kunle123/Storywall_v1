#!/usr/bin/env node
/**
 * M5-T20 — Staging: ready_for_edit → POST …/draft/assemble → poll → timeline events exist.
 * Usage: pnpm verify:staging:draft-assembly
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

async function main() {
  const email = `staging-draft-asm-${Date.now()}@example.test`;
  const password = "StagingDraftAsm9!";

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
  let jobId = null;
  let frameId = null;
  let assembleJobId = null;
  /** Populated after step 12 for richer-structure assertions (post-canonical draft quality). */
  let postAssemblyEventCount = 0;

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T20 draft assembly" };
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
    return;
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
      subject: "M5-T20 draft assembly subject",
      story_type: "biography",
      research_brief: "Brief for draft assembly verify.",
      desired_angle: "Draft assembly verify angle.",
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
    return;
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
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t20-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T20 verify" }),
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
    const bodyIn = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T20 draft assembly verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t20-research-${Date.now()}`,
        },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.job_id;
    if (ok) jobId = body.data.job_id;
    record("5 — POST research", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!jobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No job_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // 6 Poll research job
  const pollUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(jobId)}`;
  const deadline = Date.now() + MAX_WAIT_MS;
  let lastPoll = null;
  let lastStatus = null;
  let iterations = 0;
  while (Date.now() < deadline) {
    iterations += 1;
    let status = null;
    let body = null;
    try {
      const res = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    lastPoll = body;
    lastStatus = status;
    const d = body?.data;
    if (status === 200 && body?.ok === true && d?.status === "succeeded") {
      record(
        "6 — Poll research job to succeeded",
        "GET",
        pollUrl,
        status,
        "passed on staging",
        { iterations, last_poll: body },
      );
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("6 — Poll research job", "GET", pollUrl, status, "attempted on staging but failed", body, `Terminal ${d?.status}`);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "6 — Poll research job to succeeded")) {
    record(
      "6 — Poll research job (timeout)",
      "GET",
      pollUrl,
      lastStatus,
      "attempted on staging but failed",
      { iterations, last_poll: lastPoll },
      `No succeeded within ${MAX_WAIT_MS}ms`,
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  // 7 GET framing — pick first proposed frame
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
    record(
      "7 — GET framing (candidates for select)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : "Need awaiting_framing_choice and at least one proposed frame.",
    );
  }
  if (!frameId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No frame_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // 8 POST frames/select
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/select`;
    const bodyIn = { frame_id: frameId, selection_mode: "accept" };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t20-select-${Date.now()}`,
        },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const ok =
      isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    const briefOk = Boolean(d?.story_brief?.id);
    record(
      "8 — POST frames/select",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok && !briefOk
        ? "M5-T19: story_brief not in response yet — redeploy API for full brief-workspace handoff without local cache."
        : ok && briefOk
          ? "Includes story_brief for brief tab navigation (M5-19)."
          : undefined,
    );
  }

  // 9 GET framing — confirm workflow + draft shell
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const ok =
      isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    record(
      "9 — GET framing (post-select; next-step anchor)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? "Prerequisite for M5-T20: ready_for_edit with story_draft — next POST …/draft/assemble."
        : undefined,
    );
  }

  // 10 POST draft/assemble
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft/assemble`;
    const bodyIn = {
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t20-assemble-${Date.now()}`,
        },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const meta = body?.meta;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "assembling_draft" &&
      d?.job_id &&
      d?.job_status === "pending" &&
      meta?.async_job?.kind === "draft_assemble";
    if (ok) assembleJobId = d.job_id;
    record(
      "10 — POST draft/assemble",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : "Expect assembling_draft + job_id + meta.async_job.kind draft_assemble (mutation §11.2).",
    );
  }
  if (!assembleJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No draft assembly job_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // 11 Poll draft assembly job
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
      const res = await fetch(asmPollUrl, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    asmLast = body;
    asmStatus = status;
    const d = body?.data;
    if (
      status === 200 &&
      body?.ok === true &&
      d?.status === "succeeded" &&
      d?.kind === "draft_assemble"
    ) {
      record(
        "11 — Poll draft assembly job to succeeded",
        "GET",
        asmPollUrl,
        status,
        "passed on staging",
        { iterations: asmIter, last_poll: body },
      );
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("11 — Poll draft assembly job", "GET", asmPollUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "11 — Poll draft assembly job to succeeded")) {
    record(
      "11 — Poll draft assembly job (timeout)",
      "GET",
      asmPollUrl,
      asmStatus,
      "attempted on staging but failed",
      { iterations: asmIter, last_poll: asmLast },
      `No succeeded within ${MAX_WAIT_MS}ms`,
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  // 12 GET events — materialized timeline
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const events = body?.data?.events ?? [];
    postAssemblyEventCount = Array.isArray(events) ? events.length : 0;
    const ok = isHttpSuccess(status) && body?.ok === true && Array.isArray(events) && events.length > 0;
    record(
      "12 — GET events (draft assembly artifact)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? `event_draft count: ${events.length}` : "Expected at least one event_draft after successful assembly.",
    );
  }

  // 12b GET sections — narrative spine materialized with assembly (M2-T05 worker)
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/sections`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const sections = body?.data?.sections ?? [];
    const multiArc =
      postAssemblyEventCount >= 6 ? sections.length >= 2 : sections.length >= 1;
    const ok =
      isHttpSuccess(status) && body?.ok === true && Array.isArray(sections) && sections.length > 0 && multiArc;
    record(
      "12b — GET sections (narrative spine after assembly)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? `section_draft count: ${sections.length} (expect ≥2 arcs when events≥6; got ${postAssemblyEventCount} events)`
        : postAssemblyEventCount >= 6 && sections.length < 2
          ? "Expected at least two editorial arc sections when chronology has six or more rows."
          : "Expected at least one section_draft after successful assembly.",
    );
  }

  // 13 GET framing — workflow restored + draft shell still present
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const conclusion = d?.story_draft?.conclusion;
    const hasClosing =
      typeof conclusion === "string" && conclusion.trim().length >= 40;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "ready_for_edit" &&
      d?.story_draft?.id &&
      hasClosing;
    record(
      "13 — GET framing (post-assembly)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? "story_draft includes first-pass conclusion scaffold; open Draft tab to edit."
        : "Expected non-empty story_draft.conclusion after assembly (first-pass editorial close).",
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) {
    process.exit(1);
    return;
  }
  console.log("\nM5-T20 staging verify: draft assembly + timeline events + ready_for_edit passed.");
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
