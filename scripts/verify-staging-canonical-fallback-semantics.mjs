#!/usr/bin/env node
/**
 * M5-T28 — Staging: same creator spine as M5-T27 through post-assembly GET package, asserting `workflow_fallback_semantics`
 * (m5-t28-v1) is present, non-empty next actions, signal codes align with thin rails, and composite posture never
 * over-claims `healthy_grounded_package` when retrieval or synthesis tiers are thin/partial.
 *
 * Usage: pnpm verify:staging:canonical-fallback-semantics
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

/**
 * @param {unknown} data — GET package `data`
 * @param {string} phase — label for logs
 */
function evaluateWorkflowFallbackSemantics(data, phase) {
  const wfs = data?.workflow_fallback_semantics;
  const hs = data?.honesty_summary;
  const rd = hs?.retrieval_depth?.tier;
  const so = hs?.synthesis_orchestration?.tier;
  const okSchema = wfs?.schema_version === "m5-t28-v1";
  const okSignals = Array.isArray(wfs?.signal_codes);
  const okActions = Array.isArray(wfs?.creator_next_actions) && wfs.creator_next_actions.length >= 2;
  const okPosture =
    typeof wfs?.composite_workflow_posture === "string" &&
    ["healthy_grounded_package", "usable_with_explicit_limits", "degraded_partial_package", "thin_or_risky_guidance_only"].includes(
      wfs.composite_workflow_posture,
    );
  const okBand =
    typeof wfs?.grounding_band === "string" &&
    ["strong_guidance", "mixed_guidance", "thin_guidance", "scaffold_only_guidance"].includes(wfs.grounding_band);

  let truthfulVsTiers = true;
  if (rd === "thin" || rd === "partial" || so === "thin" || so === "partial") {
    if (wfs?.composite_workflow_posture === "healthy_grounded_package") truthfulVsTiers = false;
  }

  return {
    wfs,
    ok: Boolean(okSchema && okSignals && okActions && okPosture && okBand && truthfulVsTiers),
    detail: {
      phase,
      schema_version: wfs?.schema_version ?? null,
      composite_workflow_posture: wfs?.composite_workflow_posture ?? null,
      grounding_band: wfs?.grounding_band ?? null,
      signal_codes: wfs?.signal_codes ?? null,
      creator_next_actions_count: Array.isArray(wfs?.creator_next_actions) ? wfs.creator_next_actions.length : 0,
      retrieval_tier: rd ?? null,
      synthesis_tier: so ?? null,
      truthfulVsTiers,
    },
  };
}

async function main() {
  const email = `staging-m5t28-fallback-${Date.now()}@example.test`;
  const password = "StagingM5T28Fallback9!";

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
    record("0 — GET api/v1/health", "GET", url, status, status === 200 && body?.ok === true ? "passed on staging" : "failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T28 fallback semantics" };
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
    record("1 — Register", "POST", url, status, ok ? "passed on staging" : "failed", body);
  }
  if (!token) {
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
    record("2 — Login", "POST", url, status, ok ? "passed on staging" : "failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const bodyIn = {
      subject: "M5-T28 fallback semantics subject",
      story_type: "biography",
      research_brief:
        "Verify M5-T28: explicit workflow_fallback_semantics must track thin retrieval, partial synthesis, materialization, and provenance posture without claiming healthy when tiers are weak.",
      desired_angle: "Honest degraded-state messaging for creators.",
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
    record("3 — Create story", "POST", url, status, ok ? "passed on staging" : "failed", body);
  }
  if (!storyId) {
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
          "Idempotency-Key": `m5t28-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T28 verify" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    record("4 — POST frames/generate", "POST", url, status, isHttpSuccess(status) && body?.ok === true ? "passed on staging" : "failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research`;
    const bodyIn = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T28 canonical fallback semantics verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t28-research-${Date.now()}`,
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
    record("5 — POST research", "POST", url, status, ok ? "passed on staging" : "failed", body);
  }
  if (!jobId) {
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
      record("6 — Poll research job", "GET", pollUrl, status, "failed", body);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "6 — Poll research job to succeeded")) {
    record("6 — Poll research job (timeout)", "GET", pollUrl, lastStatus, "failed", { iterations, last_poll: lastPoll });
    printTable(steps);
    process.exit(1);
    return;
  }

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
          "Idempotency-Key": `m5t28-frames-refresh-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T28 — refresh framing after research", replace_existing_unselected_frames: true }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.ok === true;
    record("6b — POST frames/generate (replace)", "POST", url, status, ok ? "passed on staging" : "failed", body);
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
    const d = body?.data;
    const emq = d?.enrichment_materialization_quality;
    const pt = d?.provenance_truthfulness;
    const baseOk =
      status === 200 &&
      body?.ok === true &&
      emq?.schema_version === "m5-t26-v1" &&
      pt?.schema_version === "m5-t27-v1" &&
      pt?.research_origin?.synthesis_parseable === true;
    const ev = evaluateWorkflowFallbackSemantics(d, "post_research");
    const ok = baseOk && ev.ok;
    record(
      "7 — GET package (M5-T26/27 + M5-T28 workflow_fallback_semantics, post-research)",
      "GET",
      pkgUrl,
      status,
      ok ? "passed on staging" : "failed",
      { ...ev.detail, enrichment_schema: emq?.schema_version ?? null, provenance_schema: pt?.schema_version ?? null },
      ok
        ? "workflow_fallback_semantics present and consistent with honesty tiers."
        : "Deploy API with M5-T28 (workflow_fallback_semantics m5-t28-v1) or fix tier/posture mismatch.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
    /** Thin / mixed path: staging stub should surface at least one explicit signal (not a silent success shell). */
    const hasThinSignal =
      (ev.wfs?.signal_codes ?? []).includes("retrieval_depth_partial_or_thin") ||
      (ev.wfs?.signal_codes ?? []).includes("synthesis_orchestration_thin_or_partial") ||
      (ev.wfs?.signal_codes ?? []).includes("honesty_support_rollup_mixed_or_weak") ||
      (ev.wfs?.signal_codes ?? []).includes("provenance_truthfulness_mixed_evidence_and_model");
    const postureNotOnlyHealthy = ev.wfs?.composite_workflow_posture !== "healthy_grounded_package";
    const thinPathOk = hasThinSignal || postureNotOnlyHealthy;
    record(
      "7a — M5-T28 degraded interpretation (thin / mixed evidence)",
      "GET",
      pkgUrl,
      status,
      thinPathOk ? "passed on staging" : "failed",
      { signal_codes: ev.wfs?.signal_codes, composite_workflow_posture: ev.wfs?.composite_workflow_posture },
      thinPathOk
        ? "Explicit degraded signals and/or non-healthy posture on typical staging stub run."
        : "Expected at least one M5-T28 signal or a non-healthy composite when evidence is thin/mixed.",
    );
    if (!thinPathOk) {
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
    const ok = isHttpSuccess(status) && body?.ok === true && d?.story_state === "awaiting_framing_choice" && proposed.length > 0;
    if (ok) frameId = proposed[0].id;
    record("8 — GET framing (select candidate)", "GET", url, status, ok ? "passed on staging" : "failed", body);
  }
  if (!frameId) {
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
          "Idempotency-Key": `m5t28-select-${Date.now()}`,
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
    record("9 — POST frames/select", "POST", url, status, ok ? "passed on staging" : "failed", body);
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
          "Idempotency-Key": `m5t28-assemble-${Date.now()}`,
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
    record("10 — POST draft/assemble", "POST", url, status, ok ? "passed on staging" : "failed", body);
  }
  if (!assembleJobId) {
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
      record("11 — Poll draft assembly", "GET", asmPollUrl, status, "failed", body);
      printTable(steps);
      process.exit(1);
      return;
    }
    await sleep(POLL_MS);
  }
  if (!steps.some((s) => s.step === "11 — Poll draft assembly to succeeded")) {
    record("11 — Poll draft assembly (timeout)", "GET", asmPollUrl, asmStatus, "failed", { iterations: asmIter, last_poll: asmLast });
    printTable(steps);
    process.exit(1);
    return;
  }

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
    const d = body?.data;
    const emq = d?.enrichment_materialization_quality;
    const pt = d?.provenance_truthfulness;
    const combined = emq?.combined_overall;
    const materialOk = combined === "production_usable" || combined === "usable_with_caveats";
    const ptOk =
      pt?.schema_version === "m5-t27-v1" &&
      pt?.draft_enrichment_origin?.trace_index_present === true &&
      (pt?.research_origin?.synthesis_finding_counts?.sourced_claim ?? 0) >= 1;
    const ev = evaluateWorkflowFallbackSemantics(d, "post_assembly");
    const ok = status === 200 && body?.ok === true && emq?.schema_version === "m5-t26-v1" && materialOk && ptOk && ev.ok;
    record(
      "12 — GET package (M5-T28 after assembly; creator still guided)",
      "GET",
      pkgUrl,
      status,
      ok ? "passed on staging" : "failed",
      {
        combined_overall: combined,
        workflow_fallback: ev.detail,
      },
      ok ? "Materialization + provenance + M5-T28 envelope coherent after assembly." : "Check assembly output or M5-T28 wiring.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
    const actions = ev.wfs?.creator_next_actions ?? [];
    const usabilityOk = actions.some((a) => /research|source|inspect|edit|manual|retry|assembly|chronology|provenance/i.test(a));
    record(
      "12a — M5-T28 creator usability under degradation (actionable next steps)",
      "GET",
      pkgUrl,
      status,
      usabilityOk ? "passed on staging" : "failed",
      { sample_next_actions: actions.slice(0, 3) },
      usabilityOk ? "Next actions mention concrete follow-ups (sources, inspect, edit, assembly, etc.)." : "Next actions look too vague.",
    );
    if (!usabilityOk) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

  printTable(steps);
  console.log("\nM5-T28 staging verify: workflow fallback semantics passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
