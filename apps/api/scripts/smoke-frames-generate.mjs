#!/usr/bin/env node
/**
 * M1-T11 smoke: POST /creator/stories/:id/frames/generate
 * Requires: API up, DATABASE_URL, JWT_SECRET, migrations deployed.
 *
 *   API_URL=http://127.0.0.1:3001 node scripts/smoke-frames-generate.mjs
 */

const BASE = process.env.API_URL ?? "http://127.0.0.1:3001";

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
    throw new Error(`Non-JSON ${res.status}: ${t.slice(0, 400)}`);
  }
}

const briefBody = {
  subject: "Smoke Frame Subject",
  story_type: "biography",
  research_brief: "A grounded non-fiction story about the subject's public arc.",
  desired_angle: "How context and constraints shaped outcomes.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

async function main() {
  const email = `smoke-frames-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Smoke" }),
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
  assert(create.ok, `create ${create.status}`);
  const storyId = createJson.data.story_id;
  assert(createJson.data.story_state === "drafting_brief", "initial state drafting_brief");

  const gen1 = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `smoke-${storyId}-a`,
    },
    body: JSON.stringify({ replace_existing_unselected_frames: false }),
  });
  const g1 = await j(gen1);
  assert(gen1.ok, `generate ${gen1.status} ${JSON.stringify(g1)}`);
  assert(g1.data.story_state === "awaiting_framing_choice", "state after generate");
  assert(Array.isArray(g1.data.frame_drafts) && g1.data.frame_drafts.length === 3, "3 frame drafts");
  assert(g1.meta?.reused_existing === false, "first run not reused");
  assert(g1.data.frame_drafts[0].status === "proposed", "frame proposed");

  const gen2 = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const g2 = await j(gen2);
  assert(gen2.ok, `generate idempotent ${gen2.status}`);
  assert(g2.meta?.reused_existing === true, "second call reuses");
  assert(g2.data.frame_drafts.length === 3, "same 3 frames");

  const gen3 = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replace_existing_unselected_frames: true }),
  });
  const g3 = await j(gen3);
  assert(gen3.ok, `replace generate ${gen3.status}`);
  assert(g3.meta?.reused_existing === false, "replace creates new");
  assert(g3.data.frame_drafts.length === 3, "3 new frames");

  console.log("OK: frames generate smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
