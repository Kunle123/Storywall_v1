#!/usr/bin/env node
/**
 * M5-T06 / M5-T07 — repeatable local end-to-end: live bounded retrieval → research_synthesis_package (M5-T05)
 * → chronology extraction (M5-T06) → draft_enrichment_package (M5-T07) with provenance + honesty markers.
 *
 * Requires (same as smoke-m2-02 / smoke-m2-03):
 * - API running (e.g. `pnpm --filter @storywall/api start` or `dev`)
 * - Worker running with the **same** `DATABASE_URL` and **same** `REDIS_URL` as the API
 * - Postgres schema applied (`pnpm db:deploy` or migrate dev)
 * - For **live** retrieval: `STORYWALL_RETRIEVAL_ENABLED=true`, allowed hosts, and `STORYWALL_RETRIEVAL_USER_AGENT` set on **both** API and worker
 *
 * Redis isolation (read README “M5-T06 local E2E”):
 * - Prefer `REDIS_URL=redis://127.0.0.1:6379/15` (dedicated logical DB) on API **and** worker.
 * - Optionally `redis-cli -n 15 FLUSHDB` before a run so no stale Bull state interferes.
 * - This script **exits with an error** if `REDIS_URL` uses logical DB **0** unless
 *   `STORYWALL_E2E_ALLOW_REDIS_DB0=true` (acknowledges risk of ghost consumers acking jobs
 *   against a different Postgres and leaving `research_job` stuck `pending`).
 *
 * Usage (from repo root, after API + worker are up):
 *   export DATABASE_URL=... REDIS_URL=redis://127.0.0.1:6379/15 JWT_SECRET=...
 *   export STORYWALL_RETRIEVAL_ENABLED=true STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS=en.wikipedia.org
 *   export STORYWALL_RETRIEVAL_USER_AGENT='StorywallM5T06E2E/1.0 (+https://example.com)'
 *   # terminal A: pnpm --filter @storywall/api start
 *   # terminal B: pnpm --filter @storywall/worker start
 *   API_URL=http://127.0.0.1:3001 pnpm --filter @storywall/api exec node ./scripts/e2e-m5-t06-research-chronology.mjs
 */

const BASE = process.env.API_URL ?? "http://127.0.0.1:3001";

/** @param {string} redisUrl */
function redisLogicalDbIndex(redisUrl) {
  const trimmed = redisUrl.trim().split("?")[0];
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1] ?? "";
  return /^\d+$/.test(last) ? parseInt(last, 10) : 0;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

async function j(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`${res.status} ${t.slice(0, 400)}`);
  }
}

async function enforceRedisIsolationGuard() {
  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const db = redisLogicalDbIndex(redisUrl);
  if (db === 0 && process.env.STORYWALL_E2E_ALLOW_REDIS_DB0 !== "true") {
    fail(
      [
        "REDIS_URL uses logical database 0 (default). Another local worker on the same Redis DB can",
        "consume BullMQ jobs while using a different DATABASE_URL, so jobs may show completed in Redis",
        "while research_job stays pending and no artifact is written to your intended Postgres.",
        "",
        "Fix: use a dedicated logical DB on API and worker, e.g.",
        "  export REDIS_URL=redis://127.0.0.1:6379/15",
        "  redis-cli -n 15 FLUSHDB   # optional, before the run",
        "",
        "Override (not recommended): STORYWALL_E2E_ALLOW_REDIS_DB0=true",
      ].join("\n"),
    );
  }
  if (db !== 0) {
    // eslint-disable-next-line no-console
    console.log(`[e2e-m5-t06] REDIS_URL logical DB index=${db} (isolation guard satisfied)`);
  } else {
    // eslint-disable-next-line no-console
    console.warn("[e2e-m5-t06] STORYWALL_E2E_ALLOW_REDIS_DB0=true — Redis DB 0 in use; ensure no stray worker.");
  }
}

async function pollJob(token, jobId, maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${BASE}/api/v1/creator/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await j(res);
    assert(res.ok, `poll job ${res.status} ${JSON.stringify(data)}`);
    if (data.data.status === "succeeded") return data.data;
    if (data.data.status === "failed") fail(`job failed: ${JSON.stringify(data.data)}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  fail("timeout waiting for job (is worker running with same DATABASE_URL + REDIS_URL as API?)");
}

const briefBody = {
  subject: "Marie Curie",
  story_type: "biography",
  research_brief: "Life and scientific work of Marie Curie; bounded Wikipedia retrieval E2E.",
  desired_angle: "Scientific legacy.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

const runBody = {
  mode: "full",
  respect_existing_manual_events: true,
  respect_existing_sources: true,
  notes: "M5-T06 e2e-m5-t06-research-chronology.mjs",
};

async function main() {
  await enforceRedisIsolationGuard();

  let health;
  try {
    health = await fetch(`${BASE}/health`);
  } catch (e) {
    const code = e && typeof e === "object" && "cause" in e && e.cause && typeof e.cause === "object" && "code" in e.cause ? e.cause.code : "";
    fail(`GET /health failed (${String(code) || (e instanceof Error ? e.message : String(e))}). Is the API running at ${BASE}?`);
  }
  assert(health.ok, `GET /health must succeed (API running?), got ${health.status}`);

  const email = `e2e-m5t06-${Date.now()}@example.test`;
  const password = "e2epass12345";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M5-T06 E2E" }),
  });
  const regJson = await j(reg);
  assert(reg.ok, `register ${reg.status} ${JSON.stringify(regJson)}`);
  const token = regJson.data.access_token;

  const create = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(briefBody),
  });
  const createJson = await j(create);
  assert(create.ok, `create story ${create.status}`);
  const storyId = createJson.data.story_id;

  const gen = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const genJson = await j(gen);
  assert(gen.ok, `frames/generate ${gen.status} ${JSON.stringify(genJson)}`);

  const run = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `e2e-m5t06-${storyId}`,
    },
    body: JSON.stringify(runBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research/run ${run.status} ${JSON.stringify(runJson)}`);
  const jobId = runJson.data.job_id;

  // eslint-disable-next-line no-console
  console.log(`[e2e-m5-t06] story_id=${storyId} job_id=${jobId}`);

  await pollJob(token, jobId, 180_000);

  const pkgRes = await fetch(
    `${BASE}/api/v1/creator/stories/${storyId}/research/jobs/${jobId}/package`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const pkg = await j(pkgRes);
  assert(pkgRes.ok, `GET package ${pkgRes.status}`);
  const syn = pkg.data?.artifact?.research_synthesis_package;
  assert(syn && syn.schema_version === "m5-t05-v1", "research_synthesis_package missing or wrong schema_version");
  assert(
    syn.retrieval_mode === "live" || syn.retrieval_mode === "stub",
    `unexpected retrieval_mode: ${syn.retrieval_mode}`,
  );
  assert(Array.isArray(syn.findings) && syn.findings.length >= 1, "synthesis findings missing");
  assert(Array.isArray(pkg.data?.candidate_sources) && pkg.data.candidate_sources.length >= 1, "candidate_sources");

  // eslint-disable-next-line no-console
  console.log(
    `[e2e-m5-t06] synthesis retrieval_mode=${syn.retrieval_mode} findings=${syn.findings.length} sources=${pkg.data.candidate_sources.length}`,
  );

  const enrich = pkg.data?.artifact?.draft_enrichment_package;
  assert(enrich && enrich.schema_version === "m5-t07-v1", "draft_enrichment_package missing or wrong schema_version");
  assert(
    enrich.chronology_extraction_version === "m5-t06-v1",
    `enrichment must record chronology version, got ${enrich.chronology_extraction_version}`,
  );
  assert(
    typeof enrich.not_publishable_narrative_note === "string" && enrich.not_publishable_narrative_note.length > 40,
    "not_publishable_narrative_note honesty missing",
  );
  assert(Array.isArray(enrich.key_events) && enrich.key_events.length >= 1, "key_events missing");
  const keLinked = enrich.key_events.find(
    (k) => Array.isArray(k.linked_synthesis_finding_ids) && k.linked_synthesis_finding_ids.length > 0,
  );
  assert(keLinked, "expected a key_event with linked_synthesis_finding_ids from M5-T06 creator_note");
  assert(
    enrich.retrieval_context === syn.retrieval_mode,
    `enrichment retrieval_context ${enrich.retrieval_context} should match synthesis ${syn.retrieval_mode}`,
  );
  assert(Array.isArray(enrich.major_arcs) && enrich.major_arcs.length >= 1, "major_arcs");
  assert(
    (enrich.coverage_gaps?.length ?? 0) + (enrich.ambiguity_notes?.length ?? 0) > 0,
    "expected coverage_gaps or ambiguity_notes from upstream honesty signals",
  );

  const chRes = await fetch(
    `${BASE}/api/v1/creator/stories/${storyId}/research/jobs/${jobId}/chronology`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const ch = await j(chRes);
  assert(chRes.ok, `GET chronology ${chRes.status}`);
  const ev = ch.data?.chronology?.events ?? [];
  assert(ch.data?.chronology?.extraction_version === "m5-t06-v1", "chronology extraction_version must be m5-t06-v1");
  assert(ev.length >= 3, "expected multiple chronology rows (preamble + findings)");

  const preamble = ev.find((e) => e.context_label === "m5_t06.insufficient_or_package_honesty");
  assert(preamble, "missing M5-T06 preamble row");
  assert(
    typeof preamble.creator_note === "string" && preamble.creator_note.includes("m5_t06"),
    "preamble creator_note must carry m5_t06 provenance JSON",
  );

  const hasSourced = ev.some((e) => String(e.context_label).startsWith("m5_t06.candidate.sourced_claim:"));
  assert(hasSourced, "expected at least one m5_t06.candidate.sourced_claim row (synthesis-driven path)");

  const hasTemporalHonesty = ev.some((e) => typeof e.ambiguity_note === "string" && e.ambiguity_note.includes("[temporal]"));
  assert(hasTemporalHonesty, "expected [temporal] ambiguity_note on at least one event");

  if (syn.retrieval_mode === "live") {
    const wiki = pkg.data.candidate_sources.some(
      (s) => typeof s.source_url === "string" && s.source_url.includes("en.wikipedia.org"),
    );
    assert(wiki, "live retrieval: expected at least one en.wikipedia.org candidate URL");
  }

  // eslint-disable-next-line no-console
  console.log("OK: M5-T06 research → synthesis → chronology → M5-T07 draft enrichment e2e passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
