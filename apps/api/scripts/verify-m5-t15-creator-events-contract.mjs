#!/usr/bin/env node
/**
 * M5-T15 — GET /api/v1/creator/stories/:storyId/events must not 404 for an owned story
 * before a story draft exists; returns 200 with an empty events list and honest meta.
 *
 * Requires a running API (default http://127.0.0.1:3001). Example:
 *   API_URL=http://127.0.0.1:3001 pnpm --filter @storywall/api run verify:m5-t15
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
    throw new Error(String(res.status) + " " + t.slice(0, 400));
  }
}

const briefBody = {
  subject: "M5-T15 events contract subject",
  story_type: "biography",
  research_brief: "Brief line for contract check.",
  desired_angle: "Angle.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

async function main() {
  const email = `m5-t15-${Date.now()}@example.test`;
  const password = "verifypass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M5-T15" }),
  });
  const regJson = await j(reg);
  assert(reg.ok, `register ${reg.status}: ${JSON.stringify(regJson).slice(0, 200)}`);
  const token = regJson.data.access_token;

  const create = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(briefBody),
  });
  const createJson = await j(create);
  assert(create.ok, `create story ${create.status}`);
  const storyId = createJson.data.story_id;

  const listBefore = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listBeforeJson = await j(listBefore);
  assert(listBefore.status === 200, `expected 200 before draft, got ${listBefore.status}: ${JSON.stringify(listBeforeJson)}`);
  assert(Array.isArray(listBeforeJson.data?.events), "data.events must be an array");
  assert(listBeforeJson.data.events.length === 0, "events must be empty before draft shell");
  assert(listBeforeJson.data.story_state === "drafting_brief", "story_state should reflect workspace");
  assert(
    listBeforeJson.meta?.event_list_scope === "no_story_draft",
    `meta.event_list_scope should be no_story_draft, got ${JSON.stringify(listBeforeJson.meta)}`,
  );

  const gen = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const genJson = await j(gen);
  assert(gen.ok, `frames generate ${gen.status}: ${JSON.stringify(genJson).slice(0, 300)}`);

  const listAfter = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listAfterJson = await j(listAfter);
  assert(listAfter.status === 200, `expected 200 after frames/generate, got ${listAfter.status}`);
  assert(Array.isArray(listAfterJson.data?.events), "data.events must remain an array");
  assert(listAfterJson.data.events.length === 0, "framing generate does not create story_draft — events stay empty until frame select");
  assert(
    listAfterJson.data.story_state === "awaiting_framing_choice",
    `expected awaiting_framing_choice after generate, got ${listAfterJson.data.story_state}`,
  );
  assert(
    listAfterJson.meta?.event_list_scope === "no_story_draft",
    "meta should still disclose no draft row (truthful) until POST …/frames/select creates the shell",
  );

  console.log(
    "verify-m5-t15: OK — GET …/events is 200 through create + frames/generate; empty list + no_story_draft meta until select creates draft.",
  );
}

main().catch((e) => {
  const cause = e?.cause;
  if (cause && typeof cause === "object" && "code" in cause && cause.code === "ECONNREFUSED") {
    console.error(`verify-m5-t15: no API at ${BASE} (connection refused). Start the API, then: pnpm verify:m5-t15`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
