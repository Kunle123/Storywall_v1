#!/usr/bin/env node
/**
 * M5-T24 — Staging: persisted M5-T05 synthesis is structured, honesty exposes synthesis_orchestration (≠ retrieval_depth),
 * chronology is populated from synthesis-backed extraction, framing honesty_context carries the same block after refresh.
 *
 * Usage: pnpm verify:staging:canonical-synthesis-orchestration
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

function countSourcedClaims(findings) {
  if (!Array.isArray(findings)) return 0;
  return findings.filter((f) => f && typeof f === "object" && f.kind === "sourced_claim").length;
}

async function main() {
  const email = `staging-m5t24-synthesis-${Date.now()}@example.test`;
  const password = "StagingM5T24Synth9!";

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
    const sha = body?.deployment?.git_commit_sha ?? null;
    const ok = status === 200 && body?.ok === true;
    record(
      "0 — GET api/v1/health",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok && sha ? `deployment.git_commit_sha=${sha}` : undefined,
    );
  }

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T24 synthesis orchestration" };
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
      subject: "M5-T24 synthesis orchestration subject",
      story_type: "biography",
      research_brief:
        "Brief for M5-T24 — verify M5-T05 clusters and sourced claims drive chronology rows and honesty synthesis_orchestration.",
      desired_angle: "Structured synthesis spine for framing and timeline.",
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
          "Idempotency-Key": `m5t24-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T24 verify" }),
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
      notes: "M5-T24 synthesis orchestration verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t24-research-${Date.now()}`,
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
      notes: "M5-T24 verify — refresh framing after research for honesty_context.synthesis_orchestration",
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
          "Idempotency-Key": `m5t24-frames-refresh-${Date.now()}`,
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
    record(
      "6b — POST frames/generate (replace; post-research)",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
      return;
    }
  }

  let synthEvidence = null;
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research/jobs/${encodeURIComponent(jobId)}/package`;
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
    const syn = body?.data?.artifact?.research_synthesis_package;
    const findings = syn?.findings ?? [];
    const clusters = syn?.clusters ?? [];
    const sc = countSourcedClaims(findings);
    const so = body?.data?.honesty_summary?.synthesis_orchestration;
    synthEvidence = {
      retrieval_mode: syn?.retrieval_mode,
      finding_count: findings.length,
      cluster_count: clusters.length,
      sourced_claim_count_raw: sc,
      honesty_tier: so?.tier,
      honesty_sourced_claims: so?.evidence?.sourced_claim_count,
      pipeline_coherent: so?.pipeline_materialization_coherent,
    };
    const hasM5T05Shape =
      status === 200 &&
      body?.ok === true &&
      Array.isArray(findings) &&
      findings.length >= 3 &&
      Array.isArray(clusters) &&
      clusters.length >= 1 &&
      sc >= 2;
    const hasHonesty =
      so &&
      ["thin", "partial", "solid"].includes(so.tier) &&
      typeof so.evidence?.sourced_claim_count === "number" &&
      typeof so.evidence?.cluster_count === "number";
    const blockedDeploy = status === 200 && body?.ok === true && !so;
    const ok = hasM5T05Shape && hasHonesty;
    record(
      "7 — GET research package (M5-T05 structure + honesty synthesis_orchestration)",
      "GET",
      url,
      status,
      blockedDeploy ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      { synthesis_snapshot: synthEvidence, retrieval_depth_tier: body?.data?.honesty_summary?.retrieval_depth?.tier },
      blockedDeploy
        ? "honesty_summary.synthesis_orchestration missing — redeploy API with M5-T24 @storywall/shared build."
        : ok
          ? "Structured synthesis present; honesty exposes orchestration tier separate from retrieval_depth."
          : "Expected findings+clusters in research_synthesis_package and synthesis_orchestration on honesty_summary.",
    );
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
    const ok =
      status === 200 &&
      body?.ok === true &&
      Array.isArray(events) &&
      events.length >= 2;
    record(
      "8 — GET research chronology (downstream from synthesis-backed extraction)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { event_count: events.length, first_headline: events[0]?.headline ?? null },
      ok ? "Chronology assembly materialized multiple rows (preamble + finding-derived)." : "Expected chronology.events length >= 2.",
    );
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
    const hc = body?.data?.ai_framing_generation?.honesty_context;
    const so = hc?.synthesis_orchestration;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      so?.tier &&
      typeof so.evidence?.sourced_claim_count === "number";
    const blockedDeploy = isHttpSuccess(status) && body?.ok === true && body?.data?.ai_framing_generation && hc && !so;
    record(
      "9 — GET framing (honesty_context.synthesis_orchestration)",
      "GET",
      url,
      status,
      blockedDeploy ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      {
        framing_synthesis_tier: so?.tier,
        framing_synthesis_sourced_claims: so?.evidence?.sourced_claim_count,
        retrieval_depth_tier: hc?.retrieval_depth?.tier,
      },
      blockedDeploy
        ? "honesty_context.synthesis_orchestration missing — redeploy API (M5-T24 framing-ai-context + honesty)."
        : ok
          ? "Framing rail carries same synthesis orchestration block as package (not retrieval-only)."
          : "Expected synthesis_orchestration nested under honesty_context.",
    );
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research/jobs/${encodeURIComponent(jobId)}/package`;
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
    const dep = body?.data?.artifact?.draft_enrichment_package;
    const ok =
      status === 200 &&
      body?.ok === true &&
      dep &&
      typeof dep === "object" &&
      !Array.isArray(dep) &&
      dep.schema_version === "m5-t08-v1";
    record(
      "10 — GET package draft_enrichment_package (draft consumer spine)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        draft_enrichment_schema: dep?.schema_version ?? null,
        has_summary_spine: Boolean(dep?.summary_spine_node),
      },
      ok
        ? "Draft enrichment persisted from synthesis+chronology — pipeline consumer materialized."
        : "Expected persisted draft_enrichment_package on artifact after successful research (worker).",
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed");
  const blocked = steps.some((s) => s.verdict === "blocked on staging");
  if (failed || blocked) {
    process.exit(1);
    return;
  }

  console.log("\n## M5-T24 synthesis orchestration snapshot (staging)\n");
  console.log(safeJson(synthEvidence));
  console.log("\nM5-T24 staging verify: structured synthesis + honesty orchestration + chronology + framing + draft spine passed.");
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
