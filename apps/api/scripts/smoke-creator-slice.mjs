#!/usr/bin/env node
/**
 * Manual / CI smoke for M1-T06–T08 creator slice.
 * Requires: API running (e.g. pnpm dev), DATABASE_URL applied, JWT_SECRET set, migrations deployed.
 *
 * Usage:
 *   DATABASE_URL=... JWT_SECRET=... pnpm --filter @storywall/api exec node scripts/smoke-creator-slice.mjs
 *   API_URL=http://127.0.0.1:3001 node scripts/smoke-creator-slice.mjs
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
    throw new Error(`Non-JSON response ${res.status}: ${t.slice(0, 500)}`);
  }
}

const briefBody = {
  subject: "Smoke Test Subject",
  story_type: "biography",
  research_brief: "Research line for smoke.",
  desired_angle: "Angle line.",
  time_scope_mode: "entire_history",
  audience: "general",
  narrative_intent: "documentary",
  imagery_mode: "selective_editorial",
  source_inputs: [{ url: "https://example.com" }],
  writing_style_preference: "documentary",
  creation_mode: "ai_first",
};

async function main() {
  const health = await fetch(`${BASE}/health`);
  assert(health.ok, `/health should be ok, got ${health.status}`);

  const noAuthMe = await fetch(`${BASE}/api/v1/creator/me`);
  assert(
    noAuthMe.status === 401,
    `GET /creator/me without token should 401, got ${noAuthMe.status}`,
  );

  const noAuthCreate = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(briefBody),
  });
  assert(
    noAuthCreate.status === 401,
    `POST /creator/stories without token should 401, got ${noAuthCreate.status}`,
  );

  const emailA = `smoke-a-${Date.now()}@example.test`;
  const emailB = `smoke-b-${Date.now()}@example.test`;
  const password = "smokepass123";

  const regA = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailA,
      password,
      displayName: "Smoke A",
    }),
  });
  const regAJson = await j(regA);
  assert(regA.ok, `register A ${regA.status} ${JSON.stringify(regAJson)}`);
  const tokenA = regAJson.data.access_token;
  const creatorIdA = regAJson.data.creator.id;

  const regB = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailB,
      password,
      displayName: "Smoke B",
    }),
  });
  const regBJson = await j(regB);
  assert(regB.ok, `register B ${regB.status}`);
  const tokenB = regBJson.data.access_token;

  const me = await fetch(`${BASE}/api/v1/creator/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const meJson = await j(me);
  assert(me.ok && meJson.data.creator.id === creatorIdA, "GET /creator/me should match registered creator");

  const rejectBodyCreatorId = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...briefBody, creator_id: "00000000-0000-4000-8000-000000000001" }),
  });
  assert(
    rejectBodyCreatorId.status === 400,
    `POST with creator_id in body should 400 (whitelist), got ${rejectBodyCreatorId.status}`,
  );

  const create = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(briefBody),
  });
  const createJson = await j(create);
  assert(create.ok, `create story ${create.status} ${JSON.stringify(createJson)}`);
  const storyId = createJson.data.story_id;
  const brief = createJson.data.story_brief;
  assert(brief.creator_id === creatorIdA, "story_brief.creator_id must equal JWT creator");
  assert(createJson.data.story_state === "drafting_brief", "workflow should be drafting_brief");
  assert(!("creator_id" in briefBody), "create body must not send creator_id (slice uses auth only)");

  const ifMatch = brief.updated_at;

  const patchNoMatch = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ research_brief: "patched research" }),
  });
  const patchNoMatchJson = await j(patchNoMatch);
  assert(
    patchNoMatch.status === 400,
    `PATCH without If-Match should be 400, got ${patchNoMatch.status} ${JSON.stringify(patchNoMatchJson)}`,
  );

  const patchStale = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
      "If-Match": "2000-01-01T00:00:00.000Z",
    },
    body: JSON.stringify({ research_brief: "should conflict" }),
  });
  const patchStaleJson = await j(patchStale);
  assert(
    patchStale.status === 409,
    `stale If-Match should 409, got ${patchStale.status}`,
  );
  assert(
    patchStaleJson.error?.code === "conflict",
    "409 should include error.code conflict",
  );
  assert(
    patchStaleJson.error?.details?.story_brief,
    "409 should include latest story_brief snapshot",
  );

  const patchForbidden = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
      "If-Match": ifMatch,
    },
    body: JSON.stringify({ research_brief: "evil" }),
  });
  const patchForbiddenJson = await j(patchForbidden);
  assert(
    patchForbidden.status === 403,
    `other creator PATCH should 403, got ${patchForbidden.status} ${JSON.stringify(patchForbiddenJson)}`,
  );

  const nullRequired = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
      "If-Match": ifMatch,
    },
    body: JSON.stringify({ subject: null }),
  });
  const nullReqJson = await j(nullRequired);
  assert(
    nullRequired.status === 400,
    `subject: null should 400, got ${nullRequired.status}`,
  );
  assert(
    nullReqJson.error?.code === "validation_failed",
    "null on required field should validation_failed",
  );

  const patchOk = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
      "If-Match": ifMatch,
    },
    body: JSON.stringify({
      research_brief: "Updated research after conflict checks.",
      audience: null,
      time_scope_start: "1990-01-01",
      time_scope_end: "2000-01-01",
    }),
  });
  const patchOkJson = await j(patchOk);
  assert(patchOk.ok, `PATCH ok ${patchOk.status} ${JSON.stringify(patchOkJson)}`);
  const brief2 = patchOkJson.data.story_brief;
  const ifMatch2 = brief2.updated_at;
  assert(
    patchOkJson.meta?.saved_at === ifMatch2,
    "meta.saved_at should match new updated_at",
  );
  assert(brief2.audience === null, "audience null clear should persist as null");
  assert(brief2.time_scope_start?.startsWith("1990"), "time_scope_start should be set");

  const clearDates = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
      "If-Match": ifMatch2,
    },
    body: JSON.stringify({
      time_scope_start: null,
      time_scope_end: null,
    }),
  });
  const clearJson = await j(clearDates);
  assert(clearDates.ok, `clear dates ${clearDates.status}`);
  assert(
    clearJson.data.story_brief.time_scope_start === null &&
      clearJson.data.story_brief.time_scope_end === null,
    "null should clear optional date bounds",
  );

  const clearJsonCol = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/brief`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
      "If-Match": clearJson.data.story_brief.updated_at,
    },
    body: JSON.stringify({ source_inputs: null }),
  });
  const clearJ = await j(clearJsonCol);
  assert(clearJsonCol.ok, `clear source_inputs ${clearJsonCol.status}`);
  assert(
    clearJ.data.story_brief.source_inputs === null,
    "source_inputs clear should return null",
  );

  assert(
    clearJ.data.story_state === "drafting_brief",
    "workflow should stay drafting_brief",
  );

  console.log("OK: creator slice smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
