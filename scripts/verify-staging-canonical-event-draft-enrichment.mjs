#!/usr/bin/env node
/**
 * M5-T26 — Staging: full research → framing refresh → frame select → draft assemble; then prove chronology + draft
 * enrichment + manuscript shell are materially useful (enrichment_materialization_quality ≠ scaffold_thin combined)
 * with inspectable payload evidence. Separate from M5-T23–T25 honesty blocks.
 * Step 15: `section_draft` rows may be zero after assembly while `event_draft` rows are still substantive — that is
 * accepted when step 14 shows enough timeline events (M5-T26 closure does not require inventing sections).
 *
 * Usage: pnpm verify:staging:canonical-event-draft-enrichment
 */

const STAGING_BASE = "https://api-staging-1de1.up.railway.app";
const POLL_MS = 2000;
const MAX_WAIT_MS = 180_000;
const PREAMBLE = "Chronology coverage (M5-T06)";

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

function sampleChronologyLite(rows) {
  const non = (rows ?? []).filter((r) => r && r.headline && r.headline.trim() !== PREAMBLE);
  return non.slice(0, 2).map((r) => ({
    headline: r.headline,
    summary_len: (r.summary ?? "").length,
    context_label: r.context_label ?? null,
    summary_preview: String(r.summary ?? "").slice(0, 140),
  }));
}

function sampleDraftPackage(dep) {
  if (!dep || typeof dep !== "object") return null;
  const ke = Array.isArray(dep.key_events) ? dep.key_events : [];
  const ss = Array.isArray(dep.suggested_sections) ? dep.suggested_sections : [];
  return {
    schema_version: dep.schema_version ?? null,
    summary_spine_chars: typeof dep.summary_spine === "string" ? dep.summary_spine.trim().length : 0,
    first_key_event: ke[0]
      ? {
          headline: ke[0].headline,
          summary_clip_len: String(ke[0].summary_clip ?? "").trim().length,
        }
      : null,
    first_section: ss[0]
      ? {
          title: ss[0].title,
          rationale_len: String(ss[0].rationale ?? "").trim().length,
          rationale_preview: String(ss[0].rationale ?? "").slice(0, 160),
        }
      : null,
  };
}

function sampleManuscriptEvents(events) {
  const non = (events ?? []).filter((e) => e && e.headline && e.headline.trim() !== PREAMBLE);
  return non.slice(0, 2).map((e) => ({
    headline: e.headline,
    summary_len: String(e.summary ?? "").length,
    summary_preview: String(e.summary ?? "").slice(0, 140),
  }));
}

async function main() {
  const email = `staging-m5t26-enrich-${Date.now()}@example.test`;
  const password = "StagingM5T26Enrich9!";

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
  /** Populated in step 14 — used when step 15 returns zero sections (valid on staging). */
  let manuscriptEventDraftCount = 0;

  {
    const url = `${STAGING_BASE}/api/v1/health`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url);
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = status === 200 && body?.ok === true;
    record("0 — GET api/v1/health", "GET", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T26 event/draft enrichment" };
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

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const bodyIn = {
      subject: "M5-T26 enrichment materialization subject",
      story_type: "biography",
      research_brief:
        "Verify M5-T26: chronology rows carry excerpt-scale summaries; draft enrichment carries synthesis-linked rationale; assembled manuscript inherits substantive text for editing.",
      desired_angle: "Timeline + narrative spine suitable for creator edit pass.",
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
          "Idempotency-Key": `m5t26-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T26 verify" }),
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

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research`;
    const bodyIn = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T26 canonical event/draft enrichment verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t26-research-${Date.now()}`,
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
      record("6 — Poll research job", "GET", pollUrl, status, "attempted on staging but failed", body);
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

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/frames/generate`;
    const bodyIn = {
      notes: "M5-T26 — refresh framing after research",
      replace_existing_unselected_frames: true,
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t26-frames-refresh-${Date.now()}`,
        },
        body: JSON.stringify(bodyIn),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.ok === true;
    record("6b — POST frames/generate (replace)", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

  const pkgUrl = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research/jobs/${encodeURIComponent(jobId)}/package`;
  {
    let status = null;
    let body = null;
    try {
      const res = await fetch(pkgUrl, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const emq = body?.data?.enrichment_materialization_quality;
    const lite = body?.data?.chronology_events_lite;
    const blocked = status === 200 && body?.ok === true && !emq;
    const ok = status === 200 && body?.ok === true && emq?.schema_version === "m5-t26-v1" && Array.isArray(lite);
    record(
      "7 — GET package (M5-T26 fields post-research)",
      "GET",
      pkgUrl,
      status,
      blocked ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      {
        enrichment_schema: emq?.schema_version ?? null,
        chronology_lite_count: Array.isArray(lite) ? lite.length : null,
        combined_post_research: emq?.combined_overall ?? null,
        chronology_tier: emq?.chronology_layer?.overall ?? null,
        draft_tier: emq?.draft_enrichment_layer?.overall ?? null,
      },
      blocked
        ? "enrichment_materialization_quality missing — deploy API + @storywall/shared with M5-T26 package extensions."
        : ok
          ? "M5-T26 block present; chronology_events_lite mirrors persisted assembly."
          : "Expected enrichment_materialization_quality.schema_version m5-t26-v1 and chronology_events_lite array.",
    );
    if (blocked || !ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

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
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.story_state === "awaiting_framing_choice" &&
      proposed.length > 0;
    if (ok) frameId = proposed[0].id;
    record(
      "8 — GET framing (select candidate)",
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

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/frames/select`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t26-select-${Date.now()}`,
        },
        body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const d = body?.data;
    const ok = isHttpSuccess(status) && body?.ok === true && d?.story_state === "ready_for_edit" && d?.story_draft?.id;
    record(
      "9 — POST frames/select",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
  }

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
          "Idempotency-Key": `m5t26-assemble-${Date.now()}`,
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
    );
  }
  if (!assembleJobId) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No assemble job_id.");
    printTable(steps);
    process.exit(1);
    return;
  }

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
      record("11 — Poll draft assembly to succeeded", "GET", asmPollUrl, status, "passed on staging", { iterations: asmIter, last_poll: body });
      break;
    }
    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record("11 — Poll draft assembly", "GET", asmPollUrl, status, "attempted on staging but failed", body);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "11 — Poll draft assembly to succeeded")) {
    record(
      "11 — Poll draft assembly (timeout)",
      "GET",
      asmPollUrl,
      asmStatus,
      "attempted on staging but failed",
      { iterations: asmIter, last_poll: asmLast },
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  let finalEmq = null;
  let finalLite = [];
  let finalArtifactDep = null;
  {
    let status = null;
    let body = null;
    try {
      const res = await fetch(pkgUrl, { headers: { Authorization: `Bearer ${token}` } });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    finalEmq = body?.data?.enrichment_materialization_quality ?? null;
    finalLite = body?.data?.chronology_events_lite ?? [];
    finalArtifactDep = body?.data?.artifact?.draft_enrichment_package ?? null;
    const combined = finalEmq?.combined_overall;
    const substantiveCh = finalEmq?.chronology_layer?.substantive_event_count ?? 0;
    const richKe = finalEmq?.draft_enrichment_layer?.rich_key_event_count ?? 0;
    const richSec = finalEmq?.draft_enrichment_layer?.rich_suggested_section_count ?? 0;
    const ms = finalEmq?.manuscript_shell;
    const materialCombined = combined === "production_usable" || combined === "usable_with_caveats";
    const evidenceCh = substantiveCh >= 1 && (finalEmq?.chronology_layer?.average_summary_chars_substantive ?? 0) >= 48;
    const evidenceDraft = richKe >= 1 && richSec >= 1;
    const evidenceMs = ms && ms.overall !== "scaffold_thin";
    const ok =
      status === 200 &&
      body?.ok === true &&
      finalEmq?.schema_version === "m5-t26-v1" &&
      materialCombined &&
      evidenceCh &&
      evidenceDraft &&
      evidenceMs;
    record(
      "12 — GET package (M5-T26 substantive enrichment post-assembly)",
      "GET",
      pkgUrl,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        combined_overall: combined,
        chronology: {
          tier: finalEmq?.chronology_layer?.overall,
          substantive_event_count: substantiveCh,
          avg_summary_substantive: finalEmq?.chronology_layer?.average_summary_chars_substantive,
        },
        draft_enrichment: {
          tier: finalEmq?.draft_enrichment_layer?.overall,
          rich_key_event_count: richKe,
          rich_suggested_section_count: richSec,
          summary_spine_chars: finalEmq?.draft_enrichment_layer?.summary_spine_chars,
        },
        manuscript_shell: ms,
        chronology_lite_samples: sampleChronologyLite(finalLite),
        draft_package_samples: sampleDraftPackage(finalArtifactDep),
      },
      ok
        ? "Combined tier usable+; chronology+draft counts show excerpt-scale material; manuscript shell evaluated with draft rows."
        : `Weak or missing materialization: combined=${combined} evidenceCh=${evidenceCh} evidenceDraft=${evidenceDraft} evidenceMs=${evidenceMs} — see printed block.`,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research/jobs/${encodeURIComponent(jobId)}/chronology`;
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
    const events = body?.data?.chronology?.events ?? [];
    const non = events.filter((e) => e?.headline && e.headline.trim() !== PREAMBLE);
    const ok =
      status === 200 &&
      body?.ok === true &&
      non.length >= 1 &&
      non.some((e) => String(e.summary ?? "").trim().length >= 48);
    record(
      "13 — GET chronology (canonical event payload)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        event_count: events.length,
        non_preamble_count: non.length,
        sample: non[0]
          ? { headline: non[0].headline, summary_len: String(non[0].summary ?? "").length }
          : null,
      },
      ok ? "At least one non-preamble row with summary length floor (editor-scale)." : "Chronology rows look too thin.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

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
    manuscriptEventDraftCount = events.length;
    const samples = sampleManuscriptEvents(events);
    const ok =
      status === 200 &&
      body?.ok === true &&
      samples.length >= 1 &&
      samples.every((s) => s.summary_len >= 48);
    record(
      "14 — GET events (manuscript / timeline layer)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { event_count: events.length, samples },
      ok ? "Event drafts carry excerpt-scale summaries (not empty shells)." : "Expected substantive event draft summaries.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

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
    const sections = body?.data?.sections ?? [];
    const hasSections = sections.length >= 1;
    const ok =
      status === 200 &&
      body?.ok === true &&
      Array.isArray(sections) &&
      (hasSections || manuscriptEventDraftCount >= 2);
    record(
      "15 — GET sections (manuscript structure)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        section_count: sections.length,
        event_draft_count_for_fallback: manuscriptEventDraftCount,
        first: sections[0]
          ? {
              label: sections[0].label,
              summary_len: String(sections[0].summary ?? "").length,
            }
          : null,
      },
      ok
        ? hasSections
          ? "Narrative section_draft rows exist after assembly."
          : "Zero section_draft rows — accepted because event_draft count is substantive (see step 14); package manuscript_shell already reflects this."
        : "Expected 200 OK sections list plus either ≥1 section or ≥2 event drafts.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

  printTable(steps);
  console.log("\n## M5-T26 enrichment materialization (final GET package)\n");
  console.log(safeJson(redactForLog(finalEmq)));
  console.log("\nM5-T26 staging verify: event + draft + manuscript materialization passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
