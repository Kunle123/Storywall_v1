#!/usr/bin/env node
/**
 * M1-T12: GET /frames + POST /frames/select after generate.
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
  assert(listJson.data.frame_drafts?.length >= 1, "list returns frames");
  const frameId = listJson.data.frame_drafts[0].id;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `m12-${storyId}`,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const selJson = await j(sel);
  assert(sel.ok, `select ${sel.status} ${JSON.stringify(selJson)}`);
  assert(selJson.data.story_state === "ready_for_edit", "ready_for_edit");
  assert(selJson.data.story_draft?.selected_frame_id === frameId, "draft points to frame");

  const list2 = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list2Json = await j(list2);
  assert(list2.ok, `list2 ${list2.status}`);
  const selected = list2Json.data.frame_drafts.find((f) => f.id === frameId);
  assert(selected?.status === "selected" && selected?.is_selected === true, "frame marked selected");

  const dup = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  const dupJson = await j(dup);
  assert(dup.status === 400, `duplicate select should 400, got ${dup.status}`);
  assert(dupJson.error?.code === "frame_already_selected" || dup.status === 400, "reject duplicate");

  console.log("OK: M1-T12 framing select smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
