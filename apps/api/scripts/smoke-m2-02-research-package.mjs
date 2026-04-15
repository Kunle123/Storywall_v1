#!/usr/bin/env node
/**
 * M2-T02: after research job succeeds, GET …/research/jobs/:jobId/package returns
 * persisted artifact + structured candidate_sources (requires Redis + worker).
 */

const BASE = process.env.API_URL ?? "http://127.0.0.1:3001";

function fail(m) {
  console.error("FAIL:", m);
  process.exit(1);
}
function assert(c, m) {
  if (!c) fail(m);
}

async function j(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(String(res.status) + " " + t.slice(0, 300));
  }
}

async function pollJob(token, jobId, maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${BASE}/api/v1/creator/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await j(res);
    assert(res.ok, `poll job ${res.status}`);
    if (data.data.status === "succeeded") return data.data;
    if (data.data.status === "failed") fail("job failed");
    await new Promise((r) => setTimeout(r, 200));
  }
  fail("timeout waiting for job");
}

const briefBody = {
  subject: "M2-T02 Package Subject",
  story_type: "biography",
  research_brief: "Research line for package smoke.",
  desired_angle: "Angle.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

const runBody = {
  mode: "full",
  respect_existing_manual_events: true,
  respect_existing_sources: true,
  notes: "M2-T02 smoke",
};

async function main() {
  const email = `smoke-m2-02-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M2-T02" }),
  });
  const regJson = await j(reg);
  assert(reg.ok, `register ${reg.status}`);
  const token = regJson.data.access_token;

  const create = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(briefBody),
  });
  const createJson = await j(create);
  assert(create.ok, `create ${create.status}`);
  const storyId = createJson.data.story_id;

  const gen = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert((await j(gen)).ok, "generate frames");

  const run = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m2-02-pkg-${storyId}`,
    },
    body: JSON.stringify(runBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research run ${run.status}`);
  const jobId = runJson.data.job_id;

  await pollJob(token, jobId, 20000);

  const pkgRes = await fetch(
    `${BASE}/api/v1/creator/stories/${storyId}/research/jobs/${jobId}/package`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const pkg = await j(pkgRes);
  assert(pkgRes.ok, `GET package ${pkgRes.status} ${JSON.stringify(pkg.error)}`);
  assert(pkg.data?.job_status === "succeeded", "package job_status");
  assert(pkg.data?.artifact?.evidence_package_summary, "artifact summary");
  assert(Array.isArray(pkg.data?.artifact?.candidate_event_hints), "hints array");
  assert(Array.isArray(pkg.data?.artifact?.risk_flags), "risk_flags array");
  assert(pkg.data?.candidate_sources?.length >= 2, "candidate_sources count");
  const s0 = pkg.data.candidate_sources[0];
  assert(s0.source_url && s0.source_title && s0.relevance_note, "source shape");

  console.log("OK: M2-T02 research package smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
