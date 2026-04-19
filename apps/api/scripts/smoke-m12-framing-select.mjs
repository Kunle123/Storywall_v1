#!/usr/bin/env node
/**
 * M1-T12: GET /frames + POST /frames/select after generate, including idempotent replay.
 * Requires: API, DB, migrations. API_URL default http://127.0.0.1:3001
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
  subject: "M12 Frame Subject",
  story_type: "biography",
  research_brief: "Research line for framing smoke.",
  desired_angle: "Angle for framing smoke.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

async function main() {
  const email = `smoke-m12-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M12" }),
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
  const genJson = await j(gen);
  assert(gen.ok, `generate ${gen.status}`);
  assert(genJson.data.story_state === "awaiting_framing_choice", "after generate");

  const list = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson = await j(list);
  assert(list.ok, `list ${list.status}`);
  assert(listJson.data.frame_drafts?.length >= 2, "need 2+ proposed frames for mismatch test");
  const frameId = listJson.data.frame_drafts[0].id;
  const frameId2 = listJson.data.frame_drafts[1].id;

  const idemKey = `m12-${storyId}`;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const selJson = await j(sel);
  assert(sel.ok, `select ${sel.status} ${JSON.stringify(selJson)}`);
  assert(selJson.data.story_state === "ready_for_edit", "ready_for_edit");
  assert(selJson.data.story_draft?.selected_frame_id === frameId, "draft points to frame");
  assert(selJson.meta?.idempotency_key === idemKey, "echo idempotency key");
  assert(selJson.meta?.idempotency_replayed !== true, "first call is not replay");

  const sections = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/sections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sectionsJson = await j(sections);
  assert(sections.ok, `sections ${sections.status}`);
  assert(Array.isArray(sectionsJson.data.sections), "sections array exists");
  assert(sectionsJson.data.sections.length > 0, "frame select should materialize section scaffold");

  const replay = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const replayJson = await j(replay);
  assert(replay.ok, `replay ${replay.status} ${JSON.stringify(replayJson)}`);
  assert(replayJson.data.story_state === "ready_for_edit", "replay state");
  assert(replayJson.data.story_draft?.id === selJson.data.story_draft?.id, "same story_draft id");
  assert(replayJson.data.story_draft?.selected_frame_id === frameId, "replay draft frame");
  assert(replayJson.meta?.idempotency_replayed === true, "replay flagged in meta");

  const mismatch = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ frame_id: frameId2, selection_mode: "accept" }),
  });
  const mismatchJson = await j(mismatch);
  assert(mismatch.status === 409, `same key different frame should 409, got ${mismatch.status}`);
  assert(mismatchJson.error?.code === "idempotency_key_mismatch", "idempotency_key_mismatch");

  const noKey = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const noKeyJson = await j(noKey);
  assert(noKey.status === 400, `missing key should 400, got ${noKey.status}`);
  assert(noKeyJson.error?.code === "idempotency_key_required", "idempotency_key_required");

  const createB = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...briefBody, subject: "Second story for no-key first select" }),
  });
  const createBJson = await j(createB);
  assert(createB.ok, `createB ${createB.status}`);
  const storyB = createBJson.data.story_id;
  const genB = await fetch(`${BASE}/api/v1/creator/stories/${storyB}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert((await j(genB)).ok, "genB");
  const listB = await j(
    await fetch(`${BASE}/api/v1/creator/stories/${storyB}/frames`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const fB = listB.data.frame_drafts[0].id;
  const firstNoKey = await fetch(`${BASE}/api/v1/creator/stories/${storyB}/frames/select`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ frame_id: fB, selection_mode: "accept" }),
  });
  const firstNoKeyJson = await j(firstNoKey);
  assert(firstNoKey.status === 400, `first select without key should 400, got ${firstNoKey.status}`);
  assert(firstNoKeyJson.error?.code === "idempotency_key_required", "required on first select too");

  console.log("OK: M1-T12 framing select + idempotency smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
