#!/usr/bin/env node
/**
 * M5-T25 — Staging: live framing batch must include `framing_quality_assessment`, low duplicate risk,
 * and synthesis-grounded refs when research package exposes ids (distinctness + grounding from real payloads).
 *
 * Usage: pnpm verify:staging:canonical-framing-quality
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

function tokenize(s) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length > 2);
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const u = A.size + B.size - inter;
  return u === 0 ? 0 : inter / u;
}

function maxPairwiseJaccardTitlesAngles(options) {
  const bags = options.map((o) => tokenize(`${o.title}\n${(o.angle_description || "").slice(0, 220)}`));
  let max = 0;
  for (let i = 0; i < bags.length; i += 1) {
    for (let j = i + 1; j < bags.length; j += 1) {
      max = Math.max(max, jaccard(bags[i], bags[j]));
    }
  }
  return max;
}

async function main() {
  const email = `staging-m5t25-framing-${Date.now()}@example.test`;
  const password = "StagingM5T25Framing9!";

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
      sha ? `deployment.git_commit_sha=${sha}` : undefined,
    );
  }

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: "M5-T25 framing quality" }),
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
      subject: "M5-T25 framing quality subject",
      story_type: "biography",
      research_brief:
        "Brief for M5-T25 — require three differentiated framing angles grounded in synthesis findings and clusters after research.",
      desired_angle: "Chronology-first biography with thematic contrast.",
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
          "Idempotency-Key": `m5t25-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T25 verify" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    record("4 — POST frames/generate", "POST", url, status, isHttpSuccess(status) && body?.ok === true ? "passed on staging" : "attempted on staging but failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${sid}/research`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t25-research-${Date.now()}`,
        },
        body: JSON.stringify({
          mode: "full",
          respect_existing_manual_events: true,
          respect_existing_sources: true,
          notes: "M5-T25 framing quality verify",
        }),
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
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t25-frames-refresh-${Date.now()}`,
        },
        body: JSON.stringify({
          notes: "M5-T25 verify — post-research framing refresh",
          replace_existing_unselected_frames: true,
        }),
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

  let qualitySnapshot = null;
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
    const afg = body?.data?.ai_framing_generation;
    const fq = afg?.framing_quality_assessment;
    const opts = Array.isArray(afg?.framing_options) ? afg.framing_options : [];
    const clientJaccard = maxPairwiseJaccardTitlesAngles(
      opts.map((o) => ({
        title: String(o.title ?? ""),
        angle_description: String(o.angle_description ?? ""),
      })),
    );
    const titles = opts.map((o) => o.title);
    const refSummary = opts.map((o) => ({
      id: o.id,
      refs: (o.grounding_refs || []).map((r) => `${r.kind}:${r.id || ""}`),
    }));
    qualitySnapshot = {
      prompt_version: afg?.prompt_version,
      overall: fq?.overall,
      distinctness_risk: fq?.distinctness_risk,
      server_jaccard: fq?.max_pairwise_title_angle_jaccard,
      client_jaccard_max: Math.round(clientJaccard * 1000) / 1000,
      grounding_tier: fq?.synthesis_grounding?.grounding_tier,
      options_with_synthesis_ref: fq?.synthesis_grounding?.options_with_synthesis_ref,
      titles,
      refSummary,
    };
    const hasContract =
      status === 200 &&
      body?.ok === true &&
      fq?.schema_version === "m5-t25-v1" &&
      ["production_usable", "usable_with_caveats", "weak_set"].includes(fq.overall) &&
      ["low", "medium", "high"].includes(fq.distinctness_risk) &&
      opts.length >= 3;
    const blockedDeploy = status === 200 && body?.ok === true && afg && !fq;
    const distinctOk = fq && fq.distinctness_risk !== "high";
    const notWeak = fq && fq.overall !== "weak_set";
    const groundedOk =
      fq &&
      (fq.synthesis_grounding?.grounding_tier === "strong" ||
        fq.synthesis_grounding?.grounding_tier === "partial" ||
        (fq.synthesis_grounding?.extractable_synthesis_ids ?? 0) < 2);
    const ok = hasContract && distinctOk && notWeak && groundedOk;
    record(
      "7 — GET framing (M5-T25 framing_quality_assessment + options)",
      "GET",
      url,
      status,
      blockedDeploy ? "blocked on staging" : ok ? "passed on staging" : "attempted on staging but failed",
      { quality_snapshot: qualitySnapshot, honesty_retrieval: afg?.honesty_context?.retrieval_depth?.tier },
      blockedDeploy
        ? "framing_quality_assessment missing — redeploy API with M5-T25 @storywall/shared + frames.service."
        : ok
          ? "Distinctness not high, overall not weak_set, synthesis grounding tier acceptable for stub staging."
          : `Contract or quality bar failed: overall=${fq?.overall} risk=${fq?.distinctness_risk} grounding=${fq?.synthesis_grounding?.grounding_tier}`,
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed");
  const blocked = steps.some((s) => s.verdict === "blocked on staging");
  if (failed || blocked) {
    process.exit(1);
    return;
  }

  console.log("\n## M5-T25 framing quality snapshot (staging)\n");
  console.log(safeJson(qualitySnapshot));
  console.log("\nM5-T25 staging verify: framing_quality_assessment + differentiated grounded batch passed.");
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
