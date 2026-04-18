#!/usr/bin/env node
/**
 * M5-T17 — Staging research-entry: fresh user → story → frames/generate → POST …/research.
 * Usage: pnpm verify:staging:research-entry
 *
 * Target: Railway staging API (no local server).
 */

const STAGING_BASE = "https://api-staging-1de1.up.railway.app";

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

async function main() {
  const email = `staging-research-entry-${Date.now()}@example.test`;
  const password = "StagingResearchEntry9!";

  /** @type {{ name: string, method: string, url: string, status: number | null, verdict: string, body: unknown, notes?: string }[]} */
  const steps = [];

  function logStep(name, method, url, status, verdict, body, notes) {
    steps.push({ name, method, url, status, verdict, body, notes });
    console.log("\n" + "=".repeat(72));
    console.log(name);
    console.log(`Verdict: ${verdict}`);
    console.log(`${method} ${url}`);
    console.log("Status:", status);
    console.log("Response:", safeJson(redactForLog(body)));
    if (notes) console.log("Notes:", notes);
  }

  let token = null;
  let storyId = null;

  // Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const requestBody = { email, password, displayName: "M5-T17 research entry" };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    logStep(
      "1 — Register fresh user",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
  }

  // Login (exercise path; keep register token fallback)
  if (token) {
    const url = `${STAGING_BASE}/api/v1/auth/login`;
    const requestBody = { email, password };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    logStep(
      "2 — Login",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
      ok ? undefined : "Using register JWT if login omitted token.",
    );
  }

  if (!token) {
    logStep(
      "3 — Create story",
      "POST",
      `${STAGING_BASE}/api/v1/creator/stories`,
      null,
      "blocked on staging",
      null,
      "No JWT.",
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  // Create story
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const requestBody = {
      subject: "M5-T17 research entry subject",
      story_type: "biography",
      research_brief: "Minimal brief for research-entry verification.",
      desired_angle: "Verification angle.",
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.data?.story_id;
    if (ok) storyId = body.data.story_id;
    logStep("3 — Create fresh story", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  if (!storyId) {
    logStep(
      "4 — GET framing (initial state)",
      "GET",
      "<no story>",
      null,
      "blocked on staging",
      null,
      "No story_id.",
    );
    printTable(steps);
    process.exit(1);
    return;
  }

  // GET framing — expect drafting_brief
  let stateAfterCreate = null;
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
    const ok = isHttpSuccess(status) && body?.ok === true;
    stateAfterCreate = body?.data?.story_state ?? null;
    const briefOk = stateAfterCreate === "drafting_brief";
    logStep(
      "4 — GET framing (initial state)",
      "GET",
      url,
      status,
      ok && briefOk ? "passed on staging" : ok ? "attempted on staging but failed" : "attempted on staging but failed",
      body,
      ok && !briefOk
        ? `Expected story_state drafting_brief for fresh story; got ${stateAfterCreate}.`
        : undefined,
    );
  }

  // POST frames/generate — prerequisite
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/generate`;
    const idem = `staging-research-entry-frames-${Date.now()}`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idem,
        },
        body: JSON.stringify({ notes: "M5-T17 staging verify" }),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const ok = isHttpSuccess(status) && body?.ok === true;
    logStep(
      "5 — POST frames/generate (workflow prerequisite)",
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
  }

  // GET framing — expect awaiting_framing_choice
  let stateAfterGenerate = null;
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
    const ok = isHttpSuccess(status) && body?.ok === true;
    stateAfterGenerate = body?.data?.story_state ?? null;
    const progressOk = stateAfterGenerate === "awaiting_framing_choice" || stateAfterGenerate === "ready_for_edit";
    logStep(
      "6 — GET framing (after generate)",
      "GET",
      url,
      status,
      ok && progressOk ? "passed on staging" : "attempted on staging but failed",
      body,
      ok && !progressOk ? `Expected awaiting_framing_choice or ready_for_edit; got ${stateAfterGenerate}.` : undefined,
    );
  }

  // POST research
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const researchBody = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "M5-T17 staging research-entry verify",
    };
    const idemKey = `staging-research-entry-${Date.now()}`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify(researchBody),
      });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const success = isHttpSuccess(status) && body?.ok === true && body?.data?.job_id;
    const stillStateGuard =
      status === 400 && body?.ok === false && body?.error?.code === "invalid_state_transition";
    logStep(
      "7 — POST research (after prerequisite)",
      "POST",
      url,
      status,
      success
        ? "passed on staging"
        : stillStateGuard
          ? "attempted on staging but failed"
          : "attempted on staging but failed",
      body,
      stillStateGuard ? "Research still rejected — workflow progression did not reach research-runnable state." : undefined,
    );
  }

  printTable(steps);

  const researchStep = steps.find((s) => s.name.startsWith("7 —"));
  const passed =
    researchStep &&
    isHttpSuccess(researchStep.status) &&
    researchStep.body?.ok === true &&
    researchStep.body?.data?.job_id;

  if (!passed) {
    console.error("\nM5-T17 staging verify: research did not accept (expected 2xx + ok + job_id after frames/generate).");
    process.exit(1);
  }
  console.log("\nM5-T17 staging verify: full progression passed (research job accepted).");
}

function printTable(steps) {
  console.log("\n## Summary table\n");
  console.log("| Step | Endpoint | HTTP | Verdict |");
  console.log("|------|----------|------|---------|");
  for (const s of steps) {
    const ep = s.url.replace(STAGING_BASE, "") || s.url;
    console.log(`| ${s.name.split(" —")[0].trim()} | \`${ep}\` | ${s.status ?? "—"} | ${s.verdict} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
