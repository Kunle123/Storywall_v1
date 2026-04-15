#!/usr/bin/env node
/**
 * M2-T01: POST /research/run + GET /jobs/:id + worker completion (requires Redis + worker running for full pass).
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

const briefBody = {
  subject: "M2 Research Subject",
  story_type: "biography",
  research_brief: "Research line.",
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
  notes: "Smoke notes",
};

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

async function main() {
  const email = `smoke-m2-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M2" }),
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
  assert((await j(gen)).ok, "generate");

  const list = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const frameId = list.data.frame_drafts[0].id;
  const idemSelect = `m2-sel-${storyId}`;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemSelect,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  assert((await j(sel)).ok, "select frame");

  const idemResearch = `m2-res-${storyId}`;
  const run = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemResearch,
    },
    body: JSON.stringify(runBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research run ${run.status} ${JSON.stringify(runJson)}`);
  assert(runJson.data.story_state === "researching", "story researching");
  assert(runJson.data.job_status === "pending", "job pending");
  const jobId = runJson.data.job_id;

  const polled = await pollJob(token, jobId, 15000);
  assert(polled.status === "succeeded", "job succeeded");

  const framesAfter = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assert(framesAfter.data.story_state === "ready_for_edit", "back to ready_for_edit after worker");

  const replay = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemResearch,
    },
    body: JSON.stringify(runBody),
  });
  const replayJson = await j(replay);
  assert(replay.ok, "replay");
  assert(replayJson.meta?.idempotency_replayed === true, "idempotent replay");

  const bad = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemResearch,
    },
    body: JSON.stringify({ ...runBody, notes: "different" }),
  });
  const badJson = await j(bad);
  assert(bad.status === 409, "mismatch 409");
  assert(badJson.error?.code === "idempotency_key_mismatch", "mismatch code");

  console.log("OK: M2-T01 research orchestration smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
