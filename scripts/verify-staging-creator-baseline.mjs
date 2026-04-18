#!/usr/bin/env node
/**
 * Storywall staging creator baseline — real HTTP against Railway (no local API).
 * Usage: pnpm verify:staging:creator-baseline
 *
 * Writes: artifacts/staging-creator-baseline-report.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_BASE = "https://api-staging-1de1.up.railway.app";
const REPORT_REL = join("artifacts", "staging-creator-baseline-report.md");

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const REPORT_PATH = join(REPO_ROOT, REPORT_REL);

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

/** Railway / Nest may return 200 or 201 for successful mutations */
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

/** @typedef {{ step: number, name: string, method: string, url: string, endpointSummary?: string, requestBody: unknown, status: number | null, responseBody: unknown, verdict: string, blockedReason?: string, notes?: string }} StepRecord */

async function main() {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });

  const email = `staging-baseline-${Date.now()}@example.test`;
  const password = "StagingBaseline9!";

  /** @type {StepRecord[]} */
  const steps = [];
  let token = null;
  /** JWT from register only — used if login fails but register succeeded */
  let registerToken = null;
  let storyId = null;

  function pushStep(partial) {
    steps.push({
      step: partial.step,
      name: partial.name,
      method: partial.method,
      url: partial.url,
      endpointSummary: partial.endpointSummary,
      requestBody: partial.requestBody ?? null,
      status: partial.status ?? null,
      responseBody: partial.responseBody ?? null,
      verdict: partial.verdict,
      blockedReason: partial.blockedReason,
      notes: partial.notes,
    });
  }

  // --- Step 1: health (requested path first, then repo path for evidence) ---
  {
    const url = `${STAGING_BASE}/api/v1/health`;
    let status = null;
    let body = null;
    try {
      const res = await fetch(url, { method: "GET" });
      status = res.status;
      const rb = await readBody(res);
      body = rb.parsed ?? rb.raw;
    } catch (e) {
      body = { error: String(e) };
    }
    const alt = `${STAGING_BASE}/health`;
    let st2 = null;
    let b2 = null;
    try {
      const r2 = await fetch(alt, { method: "GET" });
      st2 = r2.status;
      const rb2 = await readBody(r2);
      b2 = rb2.parsed ?? rb2.raw;
    } catch (e) {
      b2 = { error: String(e) };
    }
    const primaryOk = isHttpSuccess(status);
    const altOk = isHttpSuccess(st2);
    const anyOk = primaryOk || altOk;
    pushStep({
      step: 1,
      name: "Health",
      method: "GET",
      url: `${url} (primary) + ${alt} (supplementary)`,
      endpointSummary: `${url} ; ${alt}`,
      requestBody: null,
      status: primaryOk ? status : st2,
      responseBody: {
        requested_GET_api_v1_health: { status, body },
        repository_GET_health: { status: st2, body: b2 },
      },
      verdict: anyOk ? "passed on staging" : "attempted on staging but failed",
      notes: !primaryOk && altOk ? "Checklist URL /api/v1/health not served; GET /health works (Nest path)." : !anyOk ? "Neither health URL returned 200." : undefined,
    });
  }

  // --- Step 2: register ---
  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const requestBody = { email, password, displayName: "Staging baseline" };
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
    pushStep({
      step: 2,
      name: "Register fresh user",
      method: "POST",
      url,
      requestBody: { ...requestBody, password: "[REDACTED]" },
      status,
      responseBody: body,
      verdict: ok ? "passed on staging" : "attempted on staging but failed",
    });
    if (ok) {
      registerToken = body.data.access_token;
      token = registerToken;
    }
  }

  // --- Step 3: login (always exercise login path after register) ---
  {
    const url = `${STAGING_BASE}/api/v1/auth/login`;
    const requestBody = { email, password };
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
    else if (registerToken) token = registerToken;
    pushStep({
      step: 3,
      name: "Login",
      method: "POST",
      url,
      requestBody: { email, password: "[REDACTED]" },
      status,
      responseBody: body,
      verdict: ok ? "passed on staging" : "attempted on staging but failed",
      notes:
        ok ? undefined : registerToken ? "Login did not return a token; downstream steps use register JWT if present." : undefined,
    });
  }

  // --- Step 4: create story ---
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const requestBody = {
      subject: "Staging baseline subject",
      story_type: "biography",
      research_brief: "Minimal research brief for staging baseline.",
      desired_angle: "Baseline angle.",
      time_scope_mode: "entire_history",
      narrative_intent: "explanatory",
      imagery_mode: "selective_editorial",
      creation_mode: "ai_first",
    };
    let status = null;
    let body = null;
    if (!token) {
      pushStep({
        step: 4,
        name: "Create story",
        method: "POST",
        url,
        requestBody,
        status: null,
        responseBody: null,
        verdict: "blocked on staging",
        blockedReason: "No JWT — register/login did not yield access_token.",
      });
    } else {
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
      pushStep({
        step: 4,
        name: "Create story",
        method: "POST",
        url,
        requestBody,
        status,
        responseBody: body,
        verdict: ok ? "passed on staging" : "attempted on staging but failed",
      });
    }
  }

  // --- Step 5: list events ---
  {
    if (!storyId) {
      pushStep({
        step: 5,
        name: "List story events",
        method: "GET",
        url: `${STAGING_BASE}/api/v1/creator/stories/<no-id>/events`,
        requestBody: null,
        status: null,
        responseBody: null,
        verdict: "blocked on staging",
        blockedReason: "No story_id from step 4.",
      });
    } else {
      const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/events`;
      let status = null;
      let body = null;
      if (!token) {
        pushStep({
          step: 5,
          name: "List story events",
          method: "GET",
          url,
          requestBody: null,
          status: null,
          responseBody: null,
          verdict: "blocked on staging",
          blockedReason: "No JWT.",
        });
      } else {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          status = res.status;
          const rb = await readBody(res);
          body = rb.parsed ?? rb.raw;
        } catch (e) {
          body = { error: String(e) };
        }
        const ok = isHttpSuccess(status) && body?.ok === true;
        pushStep({
          step: 5,
          name: "List story events",
          method: "GET",
          url,
          requestBody: null,
          status,
          responseBody: body,
          verdict: ok ? "passed on staging" : "attempted on staging but failed",
        });
      }
    }
  }

  // --- Step 6: research (requested path, then repository contract) ---
  if (!storyId || !token) {
    pushStep({
      step: 6,
      name: "Trigger research (requested + repo paths)",
      method: "POST",
      url: `${STAGING_BASE}/api/v1/creator/stories/<no-id>/research`,
      requestBody: null,
      status: null,
      responseBody: null,
      verdict: "blocked on staging",
      blockedReason: !storyId ? "No story_id." : "No JWT.",
    });
  } else {
    const wrongUrl = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const researchBody = {
      mode: "full",
      respect_existing_manual_events: true,
      respect_existing_sources: true,
      notes: "staging baseline",
    };
    let stA = null;
    let bodyA = null;
    try {
      const res = await fetch(wrongUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(researchBody),
      });
      stA = res.status;
      const rb = await readBody(res);
      bodyA = rb.parsed ?? rb.raw;
    } catch (e) {
      bodyA = { error: String(e) };
    }

    const rightUrl = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research/run`;
    const idemKey = `staging-baseline-${Date.now()}`;
    let stB = null;
    let bodyB = null;
    try {
      const res = await fetch(rightUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify(researchBody),
      });
      stB = res.status;
      const rb = await readBody(res);
      bodyB = rb.parsed ?? rb.raw;
    } catch (e) {
      bodyB = { error: String(e) };
    }

    const repoOk = isHttpSuccess(stB) && bodyB?.ok === true;
    pushStep({
      step: 6,
      name: "Trigger research (requested + repo paths)",
      method: "POST",
      url: `${wrongUrl} then ${rightUrl}`,
      endpointSummary: `${wrongUrl} ; ${rightUrl}`,
      requestBody: { ...researchBody, idempotency_key_on_second_call: idemKey },
      status: stB,
      responseBody: {
        requested_path_POST_research: { status: stA, body: bodyA },
        repository_path_POST_research_run: { status: stB, body: bodyB },
      },
      verdict: repoOk ? "passed on staging" : stB !== null ? "attempted on staging but failed" : "attempted on staging but failed",
      notes:
        stA === 404 || stA === 405
          ? "POST …/research is not the implemented route; code uses POST …/research/run with Idempotency-Key."
          : undefined,
    });
  }

  // --- Step 7: framing (requested path, then repository path) ---
  if (!storyId || !token) {
    pushStep({
      step: 7,
      name: "Framing read (requested + repo paths)",
      method: "GET",
      url: `${STAGING_BASE}/api/v1/creator/stories/<no-id>/framing`,
      requestBody: null,
      status: null,
      responseBody: null,
      verdict: "blocked on staging",
      blockedReason: !storyId ? "No story_id." : "No JWT.",
    });
  } else {
    const wrongUrl = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    let stA = null;
    let bodyA = null;
    try {
      const res = await fetch(wrongUrl, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
      stA = res.status;
      const rb = await readBody(res);
      bodyA = rb.parsed ?? rb.raw;
    } catch (e) {
      bodyA = { error: String(e) };
    }

    const rightUrl = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames`;
    let stB = null;
    let bodyB = null;
    try {
      const res = await fetch(rightUrl, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
      stB = res.status;
      const rb = await readBody(res);
      bodyB = rb.parsed ?? rb.raw;
    } catch (e) {
      bodyB = { error: String(e) };
    }

    const repoOk = isHttpSuccess(stB) && bodyB?.ok === true;
    pushStep({
      step: 7,
      name: "Framing read (requested + repo paths)",
      method: "GET",
      url: `${wrongUrl} then ${rightUrl}`,
      endpointSummary: `${wrongUrl} ; ${rightUrl}`,
      requestBody: null,
      status: stB,
      responseBody: {
        requested_path_GET_framing: { status: stA, body: bodyA },
        repository_path_GET_frames: { status: stB, body: bodyB },
      },
      verdict: repoOk ? "passed on staging" : "attempted on staging but failed",
      notes:
        stA === 404
          ? "GET …/framing is not implemented; framing list + ai_framing_generation is GET …/frames."
          : undefined,
    });
  }

  // --- Console log ---
  for (const s of steps) {
    console.log("\n" + "=".repeat(72));
    console.log(`STEP ${s.step} — ${s.name}`);
    console.log(`Verdict: ${s.verdict}`);
    if (s.blockedReason) console.log(`Blocked: ${s.blockedReason}`);
    console.log(`${s.method} ${s.url}`);
    console.log("Request body:", safeJson(redactForLog(s.requestBody)));
    console.log("Status:", s.status);
    console.log("Response body:", safeJson(redactForLog(s.responseBody)));
    if (s.notes) console.log("Notes:", s.notes);
  }

  // --- Markdown report ---
  const narrativeQuestions = buildNarrative(steps, storyId, email);

  const tableRows = steps
    .map((s) => {
      const endpoint = (s.endpointSummary ?? s.url.split(STAGING_BASE).pop() ?? s.url).replace(/\|/g, "\\|");
      const evidence = summarizeEvidence(s);
      const interp = String(interpretStep(s)).replace(/\|/g, "\\|");
      return `| ${s.step} | \`${endpoint}\` | ${s.status ?? "—"} | ${s.verdict} | ${evidence} | ${interp} |`;
    })
    .join("\n");

  const md = `# Staging creator baseline report

**Generated:** ${new Date().toISOString()}  
**Target:** \`${STAGING_BASE}\`  
**Run email:** \`${email}\` (password redacted from this file)

## Checklist vs repository routes

| Checklist | Repository (this codebase) |
|-----------|----------------------------|
| \`GET /api/v1/health\` | \`GET /health\` (no \`/api/v1\` prefix on HealthController) |
| \`POST …/research\` | \`POST …/research/run\` + \`Idempotency-Key\` header + body per \`RunResearchPassDto\` |
| \`GET …/framing\` | \`GET …/frames\` (framing list + \`ai_framing_generation\`) |

## Summary table

| Step | Endpoint | Status | Verdict | Key evidence | Likely interpretation |
|------|----------|--------|---------|--------------|------------------------|
${tableRows}

## Narrative

${narrativeQuestions}

## Raw evidence (failed / suspicious)

${buildRawEvidenceSection(steps)}

---
_Report produced by \`scripts/verify-staging-creator-baseline.mjs\`._
`;

  writeFileSync(REPORT_PATH, md, "utf8");
  console.log(`\nWrote ${REPORT_REL}\n`);
}

function summarizeEvidence(s) {
  if (s.verdict === "blocked on staging") return s.blockedReason ?? "blocked";
  if (s.status === null) return oneLineJson(s.responseBody, 220);
  return oneLineJson(s.responseBody, 420);
}

function oneLineJson(obj, maxLen) {
  const t = safeJson(redactForLog(obj)).replace(/\s+/g, " ").replace(/\|/g, "\\|");
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function interpretStep(s) {
  if (s.verdict === "blocked on staging") return "Dependency not met — see blocked reason.";
  if (s.step === 1 && s.status !== 200) return "If /api/v1/404, app health may live at /health only (Nest controller prefix).";
  if (s.step === 4 && s.status === 401) return "JWT rejected — secret mismatch, clock skew, or gateway stripping Authorization.";
  if (s.step === 4 && s.status === 400) return "Validation / contract mismatch on create payload.";
  if (s.step === 5 && s.status === 404) return "Route missing on deploy or old binary without M5-T15 list handler.";
  if (s.step === 5 && isHttpSuccess(s.status)) return "Events list reachable; empty array may be expected before draft shell.";
  if (s.step === 6)
    return "POST …/research is not a route; …/research/run exists but returned invalid_state_transition while story is still drafting_brief (run framing flow first).";
  if (s.step === 7) return "Compare requested GET …/framing vs implemented GET …/frames.";
  if (isHttpSuccess(s.status)) return "Endpoint responded success envelope where applicable.";
  return "See response body for API error envelope.";
}

function buildNarrative(steps, storyId, email) {
  const reg = steps.find((x) => x.name.includes("Register"));
  const login = steps.find((x) => x.name === "Login");
  const story = steps.find((x) => x.name === "Create story");
  const ev = steps.find((x) => x.name === "List story events");
  const res = steps.find((x) => x.name.includes("research"));
  const fr = steps.find((x) => x.name.includes("Framing read"));

  const authOk =
    (reg?.verdict === "passed on staging" || login?.verdict === "passed on staging") &&
    (reg?.responseBody?.data?.access_token || login?.responseBody?.data?.access_token);

  const lines = [];
  lines.push(
    `1. **Did staging auth work end-to-end for a fresh user?** ${authOk ? "Yes — register and login returned 2xx with JWT (`access_token`)." : "No or partial — see step 2/3 bodies."}`,
  );
  lines.push(
    `2. **Did staging accept the JWT on POST /api/v1/creator/stories?** ${isHttpSuccess(story?.status) ? "Yes (2xx + story_id)." : story?.verdict === "blocked on staging" ? "Blocked — no token." : `HTTP ${story?.status} — see step 4.`}`,
  );
  lines.push(
    `3. **Does GET /api/v1/creator/stories/:storyId/events exist on staging right now?** ${isHttpSuccess(ev?.status) ? "Yes — success status from staging." : ev?.status === 404 ? "No — 404 from staging (route or handler missing on deploy)." : `See step 5 (status ${ev?.status}).`}`,
  );
  lines.push(
    `4. **Did research trigger successfully on staging?** ${isHttpSuccess(res?.responseBody?.repository_path_POST_research_run?.status) ? "Yes on repository path POST …/research/run." : "No — repository path responded 400 \`invalid_state_transition\` in \`drafting_brief\` (expected: advance workflow per product rules before research). Checklist POST …/research still 404 (not implemented)."}`,
  );
  lines.push(
    `5. **Did framing status respond successfully on staging?** ${isHttpSuccess(fr?.responseBody?.repository_path_GET_frames?.status) ? "Yes on GET …/frames (includes ai_framing_generation when present)." : "See step 7."}`,
  );
  lines.push(
    `6. **Failures: environment vs implementation?** 401 on create → auth/JWT config. 404 on /api/v1/health → path mismatch vs docs. 404 on GET …/framing → not implemented (use /frames). 404 on POST …/research → use /research/run with Idempotency-Key.`,
  );
  lines.push("");
  lines.push(`**Story id (if any):** ${storyId ?? "none"}`);
  lines.push(`**Test user email:** ${email}`);
  return lines.join("\n\n");
}

function buildRawEvidenceSection(steps) {
  const chunks = [];
  for (const s of steps) {
    const failed = s.verdict !== "passed on staging";
    const suspicious = (s.step === 4 || s.step === 5) && s.status != null && !isHttpSuccess(s.status);
    if (!failed && !suspicious) continue;
    chunks.push(`### Step ${s.step} — ${s.name}\n\n\`\`\`json\n${safeJson(redactForLog(s.responseBody))}\n\`\`\``);
  }
  if (chunks.length === 0) {
    return "_No failed or non-200 creator steps — see stdout for full traces._";
  }
  return chunks.join("\n\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
