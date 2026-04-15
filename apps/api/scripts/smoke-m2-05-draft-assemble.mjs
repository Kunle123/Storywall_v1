#!/usr/bin/env node
/**
 * M2-T05: POST /draft/assemble after frame select + research + chronology (Redis + worker).
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
    if (data.data.status === "failed") fail(`job failed: ${data.data.error_message}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  fail("timeout waiting for job");
}

const briefBody = {
  subject: "M2-T05 Draft Assembly Subject",
  story_type: "biography",
  research_brief: "Research line for draft assembly smoke.",
  desired_angle: "Angle.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

const researchBody = {
  mode: "full",
  respect_existing_manual_events: true,
  respect_existing_sources: true,
  notes: "M2-T05 smoke research",
};

const assembleBody = {
  mode: "full_regeneration",
  preserve_creator_notes: true,
  preserve_manual_event_positions: false,
  preserve_approved_images: true,
};

async function main() {
  const email = `smoke-m2-05-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M2-T05" }),
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

  const list = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const frameId = list.data.frame_drafts[0].id;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m2-05-sel-${storyId}`,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const selJson = await j(sel);
  assert(sel.ok, `select ${sel.status}`);
  assert(selJson.data.story_state === "ready_for_edit", "ready_for_edit after select");

  const run = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/research/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m2-05-res-${storyId}`,
    },
    body: JSON.stringify(researchBody),
  });
  const runJson = await j(run);
  assert(run.ok, `research ${run.status}`);
  const researchJobId = runJson.data.job_id;
  await pollJob(token, researchJobId, 25000);

  const asm = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/draft/assemble`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m2-05-asm-${storyId}`,
    },
    body: JSON.stringify(assembleBody),
  });
  const asmJson = await j(asm);
  assert(asm.ok, `assemble ${asm.status} ${JSON.stringify(asmJson.error)}`);
  assert(asmJson.data.story_state === "assembling_draft", "assembling_draft");
  assert(asmJson.meta?.async_job?.kind === "draft_assemble", "async kind");
  const draftJobId = asmJson.data.job_id;

  const polled = await pollJob(token, draftJobId, 30000);
  assert(polled.kind === "draft_assemble", "poll kind");
  assert(polled.status === "succeeded", "assemble succeeded");

  const replay = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/draft/assemble`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m2-05-asm-${storyId}`,
    },
    body: JSON.stringify(assembleBody),
  });
  const replayJson = await j(replay);
  assert(replay.ok, "idem replay assemble");
  assert(replayJson.meta?.idempotency_replayed === true, "idem replay flag");
  assert(replayJson.data.job_id === draftJobId, "idem same job id");

  console.log("OK: M2-T05 draft assembly smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
