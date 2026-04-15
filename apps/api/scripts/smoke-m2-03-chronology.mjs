#!/usr/bin/env node
/**
 * M2-T03: after research job succeeds, GET …/research/jobs/:jobId/chronology returns
 * persisted extracted events (requires Redis + worker).
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
  subject: "M2-T03 Chronology Subject",
  story_type: "biography",
  research_brief: "Research line for chronology smoke.",
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
  notes: "M2-T03 smoke",
};

async function main() {
  const email = `smoke-m2-03-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M2-T03" }),
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
      "Idempotency-Key": `m2-03-chrono-${storyId}`,
    },
    body: JSON.stringify(runBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research run ${run.status}`);
  const jobId = runJson.data.job_id;

  await pollJob(token, jobId, 20000);

  const chRes = await fetch(
    `${BASE}/api/v1/creator/stories/${storyId}/research/jobs/${jobId}/chronology`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const ch = await j(chRes);
  assert(chRes.ok, `GET chronology ${chRes.status} ${JSON.stringify(ch.error)}`);
  assert(ch.data?.chronology?.extraction_version, "extraction_version");
  assert(Array.isArray(ch.data?.chronology?.events), "events array");
  assert(ch.data.chronology.events.length >= 2, "event count");
  const ev0 = ch.data.chronology.events[0];
  assert(ev0.headline && ev0.summary && ev0.event_type, "event shape");
  assert(Array.isArray(ev0.supporting_candidate_source_ids), "grounding ids");

  console.log("OK: M2-T03 chronology smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
