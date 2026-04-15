#!/usr/bin/env node
/**
 * M2-T01: POST /research/run idempotent replay (frozen first outcome), GET job poll,
 * worker restores pre-research workflow (awaiting vs ready). Requires Redis + worker.
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

function assertAcceptedReplayEquals(first, replay) {
  assert(first.data.story_id === replay.data.story_id, "replay story_id");
  assert(first.data.job_id === replay.data.job_id, "replay job_id");
  assert(first.data.story_state === replay.data.story_state, "replay story_state must match first accept");
  assert(first.data.job_status === replay.data.job_status, "replay job_status must match first accept");
  assert(first.data.story_state === "researching" && first.data.job_status === "pending", "first accept snapshot");
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
  const storyA = createJson.data.story_id;

  const genA = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert((await j(genA)).ok, "generate A");

  const idemAwait = `m2-await-${storyA}`;
  const runAwait = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemAwait,
    },
    body: JSON.stringify(runBody),
  });
  const runAwaitJson = await j(runAwait);
  assert(runAwait.ok, `research from awaiting ${runAwait.status}`);
  assert(runAwaitJson.data.story_state === "researching", "awaiting path: researching");
  assert(runAwaitJson.data.job_status === "pending", "awaiting path: pending");
  const jobAwait = runAwaitJson.data.job_id;

  await pollJob(token, jobAwait, 15000);

  const framesAwait = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyA}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assert(framesAwait.data.story_state === "awaiting_framing_choice", "worker restores awaiting (no draft gate bypass)");

  const replayAwait = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemAwait,
    },
    body: JSON.stringify(runBody),
  });
  const replayAwaitJson = await j(replayAwait);
  assert(replayAwait.ok, "replay awaiting path");
  assert(replayAwaitJson.meta?.idempotency_replayed === true, "idem replay flag");
  assertAcceptedReplayEquals(runAwaitJson, replayAwaitJson);

  const list = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyA}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const frameId = list.data.frame_drafts[0].id;
  const idemSelect = `m2-sel-${storyA}`;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemSelect,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  assert((await j(sel)).ok, "select frame");

  const idemResearch = `m2-res-${storyA}`;
  const run = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemResearch,
    },
    body: JSON.stringify(runBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research run ${run.status}`);
  assert(runJson.data.story_state === "researching", "ready path: researching");
  assert(runJson.data.job_status === "pending", "ready path: pending");
  const jobId = runJson.data.job_id;

  await pollJob(token, jobId, 15000);

  const framesAfter = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyA}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assert(framesAfter.data.story_state === "ready_for_edit", "ready path: back to ready_for_edit");

  const replay = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemResearch,
    },
    body: JSON.stringify(runBody),
  });
  const replayJson = await j(replay);
  assert(replay.ok, "replay ready path");
  assert(replayJson.meta?.idempotency_replayed === true, "idem replay ready");
  assertAcceptedReplayEquals(runJson, replayJson);

  const bad = await fetch(`${BASE}/api/v1/creator/stories/${storyA}/research/run`, {
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
