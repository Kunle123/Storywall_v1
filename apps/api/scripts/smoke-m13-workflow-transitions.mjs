#!/usr/bin/env node
/**
 * M1-T13: verify story_workflow_transition rows for create → generate → select (and no extra row on select replay).
 * Requires: API, DB with migration, DATABASE_URL for Prisma.
 */

import { PrismaClient } from "@prisma/client";

const BASE = process.env.API_URL ?? "http://127.0.0.1:3001";
const prisma = new PrismaClient();

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
  subject: "M13 Workflow Subject",
  story_type: "biography",
  research_brief: "Research line for workflow smoke.",
  desired_angle: "Angle for workflow smoke.",
  time_scope_mode: "entire_history",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  creation_mode: "ai_first",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is required for Prisma verification");
  }

  const email = `smoke-m13-${Date.now()}@example.test`;
  const password = "smokepass123";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M13" }),
  });
  const regJson = await j(reg);
  assert(reg.ok, `register ${reg.status}`);
  const token = regJson.data.access_token;
  const creatorId = regJson.data.creator.id;

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
  const idemKey = `m13-${storyId}`;

  const sel = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  assert((await j(sel)).ok, "select");

  let rows = await prisma.storyWorkflowTransition.findMany({
    where: { storyId },
    orderBy: { createdAt: "asc" },
  });
  assert(rows.length === 3, `expected 3 transitions, got ${rows.length}`);
  assert(rows[0].trigger === "create_story" && rows[0].fromWorkflowState === null && rows[0].toWorkflowState === "drafting_brief", "create_story row");
  assert(rows[0].actorType === "creator" && rows[0].actorId === creatorId, "create actor");
  assert(
    rows[1].trigger === "frames_generate" &&
      rows[1].fromWorkflowState === "drafting_brief" &&
      rows[1].toWorkflowState === "awaiting_framing_choice",
    "generate row",
  );
  assert(
    rows[2].trigger === "frames_select" &&
      rows[2].fromWorkflowState === "awaiting_framing_choice" &&
      rows[2].toWorkflowState === "ready_for_edit",
    "select row",
  );

  const replay = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/select`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
  });
  assert((await j(replay)).ok, "replay");

  rows = await prisma.storyWorkflowTransition.findMany({ where: { storyId } });
  assert(rows.length === 3, `after idempotent replay still 3 transitions, got ${rows.length}`);

  await prisma.$disconnect();
  console.log("OK: M1-T13 workflow transition persistence smoke passed.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
