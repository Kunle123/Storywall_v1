#!/usr/bin/env node
/**
 * M5-T23 — Staging: research job success + GET …/research/jobs/:jobId/package shows truthful retrieval_depth
 * (tier, counts, mode) — not merely job status succeeded.
 *
 * Usage: pnpm verify:staging:canonical-retrieval-depth
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
  const email = `staging-m5t23-retrieval-${Date.now()}@example.test`;
  const password = "StagingM5T23Retrieval9!";

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

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T23 retrieval depth" };
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
      subject: "M5-T23 retrieval depth subject",
      story_type: "biography",
      research_brief: "Brief for retrieval depth verification — multiple angles and dates.",
      desired_angle: "Verify bounded retrieval and synthesis materialization.",
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
          "Idempotency-Key": `m5t23-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T23 verify" }),
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
      notes: "M5-T23 retrieval depth verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t23-research-${Date.now()}`,
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

  // 7 GET research package — M5-T23 retrieval_depth + real counts
  let depthSnapshot = null;
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
    const rd = body?.data?.honesty_summary?.retrieval_depth;
    const cand = body?.data?.candidate_sources ?? [];
    const syn = body?.data?.artifact?.research_synthesis_package;
    depthSnapshot = {
      tier: rd?.tier,
      candidate_rows: cand.length,
      retrieval_mode: syn?.retrieval_mode ?? rd?.evidence?.retrieval_mode,
      sourced_claims: rd?.evidence?.sourced_claim_finding_count,
      distinct_hosts: rd?.evidence?.distinct_source_hosts,
    };
    const hasContract =
      status === 200 &&
      body?.ok === true &&
      rd &&
      ["thin", "partial", "solid"].includes(rd.tier) &&
      typeof rd.evidence?.candidate_source_count === "number" &&
      cand.length >= 2;
    const blockedDeploy = status === 200 && body?.ok === true && !rd;
    const ok = hasContract;
    record(
      "7 — GET research package (retrieval_depth contract)",
      "GET",
      url,
      status,
      blockedDeploy ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      body,
      blockedDeploy
        ? "honesty_summary.retrieval_depth missing — API must be redeployed with M5-T23 @storywall/shared + API build."
        : ok
          ? `M5-T23: tier=${rd.tier}, candidate_rows=${cand.length}, synthesis_mode=${syn?.retrieval_mode}, partial=${syn?.retrieval_partial}. Next: ${rd.next_action?.slice(0, 120)}…`
          : "Expected honesty_summary.retrieval_depth + at least two candidate_sources after success.",
    );
  }

  // 8 GET framing — honesty_context.retrieval_depth (count override path)
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
    const hc = body?.data?.ai_framing_generation?.honesty_context?.retrieval_depth;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      hc?.tier &&
      typeof hc.evidence?.candidate_source_count === "number" &&
      hc.evidence.candidate_source_count >= 2;
    const blockedDeploy = isHttpSuccess(status) && body?.ok === true && body?.data?.ai_framing_generation && !hc;
    record(
      "8 — GET framing (honesty_context.retrieval_depth)",
      "GET",
      url,
      status,
      blockedDeploy ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      { framing_honesty_retrieval_depth: hc, full_framing_redacted: "(see status 200 body in log above)" },
      blockedDeploy
        ? "honesty_context.retrieval_depth missing on framing package — redeploy API after M5-T23."
        : ok
          ? `Framing rail tier=${hc.tier}, candidate_source_count=${hc.evidence.candidate_source_count} (DB-backed override).`
          : "Expected ai_framing_generation.honesty_context.retrieval_depth after research.",
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed");
  const blocked = steps.some((s) => s.verdict === "blocked on staging");
  if (failed || blocked) {
    if (blocked && !failed) {
      console.error("\nM5-T23: staging blocked until API (and worker for 4-row stub) redeploy with this commit.");
    }
    process.exit(failed || blocked ? 1 : 0);
    return;
  }

  console.log("\n## M5-T23 retrieval depth snapshot\n");
  console.log(safeJson(depthSnapshot));
  console.log(
    "\nStub staging runs should show retrieval_mode=stub and tier partial (or thin if worker still on two-row stub). Solid requires live multi-host breadth.",
  );
  console.log("\nM5-T23 staging verify: package + framing honesty_context retrieval signals passed.");
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
