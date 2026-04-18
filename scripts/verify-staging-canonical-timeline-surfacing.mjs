#!/usr/bin/env node
/**
 * M5-T22 — Staging: chronology / timeline contract via GET …/creator/stories/:id/events (+ sections)
 * before and after draft assembly; honest strength (thin / partial / solid) from counts + display_date.
 *
 * Usage: pnpm verify:staging:canonical-timeline-surfacing
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

/** @param {unknown[]} events */
function chronologyStrength(events) {
  const n = events.length;
  const missingWhen = events.filter((e) => typeof e === "object" && e && !String(e.display_date ?? "").trim()).length;
  if (n === 0) return { label: "thin", note: "Zero event_draft rows — timeline artifact empty for this read." };
  if (n <= 2 || missingWhen > 0) {
    return {
      label: "partial",
      note:
        missingWhen > 0
          ? `${missingWhen} event(s) missing display_date — chronology is usable but incomplete for readers.`
          : "Few beats — partial spine until you add more dated events.",
    };
  }
  return { label: "solid", note: "Enough events with When lines to treat chronology as the primary artifact to review." };
}

/** @param {unknown} ev */
function eventFieldSample(ev) {
  if (!ev || typeof ev !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (ev);
  return {
    id: o.id,
    headline: o.headline,
    position_index: o.position_index,
    display_date: o.display_date,
    section_id: o.section_id,
    event_type: o.event_type,
  };
}

async function main() {
  const email = `staging-m5t22-timeline-${Date.now()}@example.test`;
  const password = "StagingM5T22Timeline9!";

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

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T22 timeline surfacing" };
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
      subject: "M5-T22 chronology surfacing subject",
      story_type: "biography",
      research_brief: "Brief: verify timeline events contract across research and assembly.",
      desired_angle: "Chronology-first staging verify.",
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

  const sid = encodeURIComponent(storyId);

  // 4 Frames generate
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/frames/generate`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    const ok = isHttpSuccess(status) && body?.ok === true;
    record("4 — POST frames/generate", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 5 POST research
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research`;
    const bodyIn = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T22 timeline surfacing",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t22-research-${Date.now()}`,
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

  // 6 Poll research
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
      record("6 — Poll research job to succeeded", "GET", pollUrl, status, "passed on staging", { iterations, last_poll: body });
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

  // 7 GET events after research (pre shell — contract: empty + meta.no_story_draft until framing select)
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/events`;
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
    const ok =
      status === 200 &&
      body?.ok === true &&
      Array.isArray(events) &&
      events.length === 0 &&
      body?.meta?.event_list_scope === "no_story_draft";
    record(
      "7 — GET events after research (pre framing shell)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? "Truthful: chronology list is empty until story_draft exists; meta discloses no_story_draft."
        : "Expected 200 + ok + empty events + meta.event_list_scope=no_story_draft before frames/select.",
    );
  }

  // 8 GET framing — pick frame
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/framing`;
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
      isHttpSuccess(status) && body?.ok === true && d?.story_state === "awaiting_framing_choice" && proposed.length > 0;
    if (ok) frameId = proposed[0].id;
    record(
      "8 — GET framing (select candidate)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : "Need awaiting_framing_choice + proposed frame.",
    );
  }
  if (!frameId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No frame_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // 9 POST frames/select
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/frames/select`;
    const bodyIn = { frame_id: frameId, selection_mode: "accept" };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t22-select-${Date.now()}`,
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
    const ok = isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    record("9 — POST frames/select", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  // 10 GET events pre-assembly (draft shell exists; events often still empty before assemble — honest pass)
  let preAsmEvents = [];
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/events`;
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
    preAsmEvents = body?.data?.events ?? [];
    const ok = status === 200 && body?.ok === true && Array.isArray(preAsmEvents) && !body?.meta?.event_list_scope;
    const shape = chronologyStrength(preAsmEvents);
    record(
      "10 — GET events before draft assembly (ready_for_edit)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? `Pre-assembly event count=${preAsmEvents.length}; strength=${shape.label} (${shape.note}). Empty pre-assembly is valid — assembly materializes beats.`
        : "Expected 200 + ok + data.events array with draft present (no no_story_draft meta).",
    );
  }

  // 11 POST draft/assemble
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/draft/assemble`;
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
          "Idempotency-Key": `m5t22-assemble-${Date.now()}`,
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
      "11 — POST draft/assemble",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
  }
  if (!assembleJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No assembly job_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // 12 Poll assembly
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
    if (status === 200 && body?.ok === true && d?.status === "succeeded" && d?.kind === "draft_assemble") {
      record(
        "12 — Poll draft assembly to succeeded",
        "GET",
        asmPollUrl,
        status,
        "passed on staging",
        { iterations: asmIter, last_poll: body },
      );
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("12 — Poll draft assembly", "GET", asmPollUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "12 — Poll draft assembly to succeeded")) {
    record(
      "12 — Poll draft assembly (timeout)",
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

  // 13 GET events post-assembly
  let postEvents = [];
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/events`;
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
    postEvents = body?.data?.events ?? [];
    const ok = status === 200 && body?.ok === true && Array.isArray(postEvents);
    const shape = chronologyStrength(postEvents);
    const sample = postEvents[0] ? eventFieldSample(postEvents[0]) : null;
    record(
      "13 — GET events after assembly (chronology artifact)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? `Post-assembly count=${postEvents.length}; strength=${shape.label}. First event fields: ${safeJson(sample)}. ${shape.note}`
        : undefined,
    );
  }

  // 14 GET sections (distinct narrative artifact from event_draft)
  let sections = [];
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/sections`;
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
    sections = body?.data?.sections ?? [];
    const ok = status === 200 && body?.ok === true && Array.isArray(sections);
    record(
      "14 — GET sections after assembly (narrative blocks)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? `Section count=${sections.length} (independent from event_draft rows).` : undefined,
    );
  }

  // 15 GET framing — workflow back to ready_for_edit
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/framing`;
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
    const ok = isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    record(
      "15 — GET framing (post-assembly anchor)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok
        ? "Creator next: open Draft workspace — Chronology-first card + Timeline panel (event_draft) above Narrative sections (section_draft)."
        : undefined,
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) {
    process.exit(1);
    return;
  }

  const postShape = chronologyStrength(postEvents);
  console.log("\n## M5-T22 chronology summary (staging)\n");
  console.log("| Phase | event_draft count | narrative section count | chronology strength |");
  console.log("|-------|-------------------|-------------------------|---------------------|");
  console.log(
    `| Pre-assembly (after framing) | ${preAsmEvents.length} | (not fetched yet) | ${chronologyStrength(preAsmEvents).label} |`,
  );
  console.log(
    `| Post-assembly | ${postEvents.length} | ${sections.length} | ${postShape.label} |`,
  );
  console.log(
    "\nUI contract: workspace lists timeline events first; sections are separate section_draft blocks — counts can diverge (honest).",
  );
  console.log("\nM5-T22 staging verify: chronology GET contract + pre/post assembly reads passed.");
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
