#!/usr/bin/env node
/**
 * M5-T19 — Staging: full path through POST …/frames/select after research completes.
 * Usage: pnpm verify:staging:framing-selection
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
  const email = `staging-framing-sel-${Date.now()}@example.test`;
  const password = "StagingFramingSel9!";

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

  // 1 Register
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const bodyIn = { email, password, displayName: "M5-T19 framing selection" };
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
      subject: "M5-T19 framing selection subject",
      story_type: "biography",
      research_brief: "Brief for framing selection verify.",
      desired_angle: "Framing verify angle.",
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
          "Idempotency-Key": `m5t19-frames-${Date.now()}`,
        },
        body: JSON.stringify({ notes: "M5-T19 verify" }),
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
      notes: "M5-T19 framing verify",
    };
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `m5t19-research-${Date.now()}`,
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
          "Idempotency-Key": `m5t19-select-${Date.now()}`,
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
        ? "Next supported step: brief workspace — Assemble full draft; or Draft tab for manuscript shell."
        : undefined,
    );
  }

  printTable(steps);

  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) {
    process.exit(1);
    return;
  }
  console.log("\nM5-T19 staging verify: framing selection + ready_for_edit passed (see step 8 notes for story_brief).");
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
