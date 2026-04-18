#!/usr/bin/env node
/**
 * M5-T18 — Staging: research accepted → poll GET …/creator/jobs/:jobId until terminal;
 * confirm story_state on poll + workflow after completion via GET …/framing.
 *
 * Usage: pnpm verify:staging:research-status
 */

const STAGING_BASE = "https://api-staging-1de1.up.railway.app";
const POLL_MS = 2000;
const MAX_WAIT_MS = 180_000;

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const email = `staging-research-status-${Date.now()}@example.test`;
  const password = "StagingResearchStatus9!";

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

  // Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T18 research status" };
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
    record("blocked", "—", "—", null, "blocked on staging", null, "No JWT from register.");
    printTable(steps);
    process.exit(1);
    return;
  }

  // Login
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

  // Create story
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const bodyIn = {
      subject: "M5-T18 research status subject",
      story_type: "biography",
      research_brief: "Brief for post-research status verify.",
      desired_angle: "Status verify angle.",
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

  // Frames generate
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
          "Idempotency-Key": `m5t18-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T18 verify" }),
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

  // Start research
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const bodyIn = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T18 status verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t18-research-${Date.now()}`,
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

  // Poll job
  const pollUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(jobId)}`;
  let lastPoll = null;
  let lastStatus = null;
  let sawStoryState = false;
  const deadline = Date.now() + MAX_WAIT_MS;
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
    if (d?.story_state !== undefined && d?.story_state !== null) sawStoryState = true;

    if (status === 200 && body?.ok === true && d?.status === "succeeded") {
      record(
        "6a — Poll GET …/creator/jobs/:jobId (job reaches succeeded)",
        "GET",
        pollUrl,
        status,
        "passed on staging",
        { iterations, last_poll: body },
        `research_job.status=succeeded after ${iterations} poll(s).`,
      );

      const m5t18Ok = sawStoryState && d.story_state === "awaiting_framing_choice";
      record(
        "6b — M5-T18 poll contract (data.story_state on same GET)",
        "GET",
        pollUrl,
        status,
        m5t18Ok ? "passed on staging" : "attempted on staging but failed",
        { final_job_poll: body?.data ?? body },
        !sawStoryState
          ? "Missing data.story_state — redeploy API with M5-T18 for combined job + workflow visibility."
          : !m5t18Ok
            ? `Expected final story_state awaiting_framing_choice on succeeded poll; got ${d.story_state}.`
            : `story_state on terminal poll: ${d.story_state}.`,
      );
      break;
    }

    if (status === 200 && body?.ok === true && (d?.status === "failed" || d?.status === "cancelled")) {
      record(
        "6a — Poll GET …/creator/jobs/:jobId (terminal non-success)",
        "GET",
        pollUrl,
        status,
        "attempted on staging but failed",
        { iterations, last_poll: body },
        `Job ended with ${d?.status}.`,
      );
      printTable(steps);
      process.exit(1);
      return;
    }

    await sleep(POLL_MS);
  }

  if (!steps.some((s) => s.step.startsWith("6a —"))) {
    record(
      "6a — Poll GET …/creator/jobs/:jobId (timeout)",
      "GET",
      pollUrl,
      lastStatus,
      "attempted on staging but failed",
      { iterations, last_poll: lastPoll },
      `No terminal status within ${MAX_WAIT_MS}ms (worker may be down or Redis/DB mismatch).`,
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  const step6a = steps.find((s) => s.step.startsWith("6a —"));
  const step6b = steps.find((s) => s.step.startsWith("6b —"));
  if (step6a?.verdict !== "passed on staging") {
    printTable(steps);
    process.exit(1);
    return;
  }
  if (step6b?.verdict !== "passed on staging") {
    printTable(steps);
    console.error("\nM5-T18: job completed on staging but poll contract (story_state) not satisfied — redeploy API, then re-run.");
    process.exit(1);
    return;
  }

  // GET framing — cross-check workflow for next-step messaging
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
    const st = body?.data?.story_state;
    const ok = isHttpSuccess(status) && body?.ok === true && st === "awaiting_framing_choice";
    record(
      "7 — GET framing (post-research next step anchor)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : `Expected story_state awaiting_framing_choice for next step (choose framing); got ${st}.`,
    );
  }

  // GET research package (optional completion artifact)
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research/jobs/${encodeURIComponent(jobId)}/package`;
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
    const ok = isHttpSuccess(status) && body?.ok === true;
    record(
      "8 — GET research package (succeeded job)",
      "GET",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
  }

  printTable(steps);

  const step7 = steps.find((s) => s.step.startsWith("7 —"));
  const step8 = steps.find((s) => s.step.startsWith("8 —"));
  if (step7?.verdict !== "passed on staging" || step8?.verdict !== "passed on staging") {
    process.exit(1);
    return;
  }

  console.log("\nM5-T18 staging verify: job poll + story_state + framing + package passed.");
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
