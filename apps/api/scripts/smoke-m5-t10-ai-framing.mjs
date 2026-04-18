#!/usr/bin/env node
/**
 * M5-T10 — narrow smoke: POST frames/generate returns `ai_framing_generation` (m5-t10-v1).
 *
 * With AI disabled: expects deterministic_scaffolding_fallback + failure metadata (honest).
 * With STORYWALL_AI_* armed + valid key: may return live_ai_backed (requires API env on server).
 *
 * Usage (API running):
 *   API_URL=http://127.0.0.1:3001 pnpm --filter @storywall/api exec node ./scripts/smoke-m5-t10-ai-framing.mjs
 */

const BASE = process.env.API_URL ?? "http://127.0.0.1:3001";

async function j(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`${res.status} ${t.slice(0, 400)}`);
  }
}

async function main() {
  const email = `m5t10-${Date.now()}@example.test`;
  const password = "smokepass123456";

  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "M5-T10 smoke" }),
  });
  const regJson = await j(reg);
  if (!reg.ok) throw new Error(`register ${reg.status} ${JSON.stringify(regJson)}`);
  const token = regJson.data.access_token;

  const create = await fetch(`${BASE}/api/v1/creator/stories`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: "Smoke subject",
      story_type: "biography",
      research_brief: "Short brief for framing smoke.",
      desired_angle: "Legacy and influence.",
      time_scope_mode: "entire_history",
      narrative_intent: "explanatory",
      imagery_mode: "selective_editorial",
      creation_mode: "ai_first",
    }),
  });
  const createJson = await j(create);
  if (!create.ok) throw new Error(`create ${create.status}`);
  const storyId = createJson.data.story_id;

  const gen = await fetch(`${BASE}/api/v1/creator/stories/${storyId}/frames/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const genJson = await j(gen);
  if (!gen.ok) throw new Error(`frames/generate ${gen.status} ${JSON.stringify(genJson)}`);

  const pkg = genJson.data?.ai_framing_generation;
  if (!pkg || pkg.schema_version !== "m5-t10-v1") {
    throw new Error(`missing ai_framing_generation: ${JSON.stringify(genJson.data)}`);
  }
  // eslint-disable-next-line no-console
  console.log(
    `OK M5-T10 smoke: generation_mode=${pkg.generation_mode} status=${pkg.status} provider=${pkg.provider} model=${pkg.model ?? "null"} options=${pkg.framing_options?.length ?? 0}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
