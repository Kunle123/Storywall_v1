#!/usr/bin/env node
/**
 * M5-T25 — Staging: full first publish (shared prep) then post-publish draft edit, frozen public read,
 * validation again, POST …/publish republish, public slug shows new content.
 *
 * Contract: update-live reuses POST /api/v1/creator/stories/:storyId/publish when lifecycle is published
 * and workflow is ready_to_publish (after checks). Same warning-ack rules as first publish.
 *
 * Usage: pnpm verify:staging:live-story-update
 */

import {
  STAGING_BASE,
  POLL_MS,
  MAX_WAIT_MS,
  isHttpSuccess,
  readBody,
  redactForLog,
  safeJson,
  sleep,
  printTable,
  fetchJson,
  ensurePublishableValidation,
} from "./lib/m5-staging-publish-prep.mjs";

async function getFramingDraft(token, storyId) {
  const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
  const { status, body } = await fetchJson("GET", url, { token });
  const d = body?.data;
  return { status, body, draft: d?.story_draft ?? null, wf: d?.story_state, life: d?.story_lifecycle_status };
}

async function fetchPublicStory(slug) {
  const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(slug)}`;
  return fetchJson("GET", url, {});
}

/**
 * After post-publish edits, re-run checks until ready_to_publish or give up.
 * @param {(s: string, m: string, u: string, st: number | null, v: string, b: unknown, n?: string) => void} record
 */
async function runValidationForRepublish(token, storyId, record, stepPrefix) {
  let overall = null;
  let wf = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/run`;
    const { status, body } = await fetchJson("POST", url, {
      token,
      body: {
        run_type: "full",
        include_style_checks: true,
        include_imagery_checks: true,
        include_dispute_checks: true,
      },
      idempotencyKey: `m5t25-reval-${attempt}-${Date.now()}`,
    });
    const d = body?.data;
    const ok =
      isHttpSuccess(status) &&
      body?.ok === true &&
      d?.overall_result &&
      (d?.story_state === "blocked" || d?.story_state === "ready_to_publish");
    record(
      attempt === 1 ? `${stepPrefix} — POST validation/run` : `${stepPrefix}b — POST validation/run (retry)`,
      "POST",
      url,
      status,
      ok ? "passed on staging" : "attempted on staging but failed",
      body,
    );
    if (!ok) return null;
    overall = d.overall_result;
    wf = d.story_state;
    if (wf === "ready_to_publish") break;
    await sleep(1500);
  }
  return { overall_result: overall, story_state: wf };
}

async function main() {
  const email = `staging-live-update-${Date.now()}@example.test`;
  const password = "StagingLiveUpdate9!";

  /** @type {{ step: string, method: string, url: string, status: number | null, verdict: string, body: unknown, notes?: string }[]} */
  const steps = [];

  function record(step, method, url, status, verdict, body, notes) {
    steps.push({ step, method, url, status, verdict, body, notes });
    console.log("\n" + "=".repeat(72));
    console.log(step);
    console.log(`Verdict: ${verdict}`);
    console.log(`${method} ${url}`);
    console.log("Status:", status);
    console.log("Response:", safeJson(redactForLog(body)));
    if (notes) console.log("Notes:", notes);
  }

  let token = null;
  let storyId = null;
  let storySlug = null;
  let researchJobId = null;
  let frameId = null;
  let assembleJobId = null;

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const { status, body } = await fetchJson("POST", url, {
      body: { email, password, displayName: "M5-T25 live story update" },
    });
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("1 — Register", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!token) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No JWT.");
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/auth/login`;
    const { status, body } = await fetchJson("POST", url, {
      body: { email, password },
    });
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("2 — Login", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const { status, body } = await fetchJson("POST", url, {
      token,
      body: {
        subject: "M5-T25 live update subject",
        story_type: "biography",
        research_brief: "Brief for live update verify.",
        desired_angle: "Live update verify angle.",
        time_scope_mode: "entire_history",
        narrative_intent: "explanatory",
        imagery_mode: "selective_editorial",
        creation_mode: "ai_first",
      },
    });
    const ok = isHttpSuccess(status) && body?.data?.story_id;
    if (ok) {
      storyId = body.data.story_id;
      storySlug = body.data?.slug ?? null;
    }
    record("3 — Create story", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }
  if (!storyId) {
    printTable(steps);
    process.exit(1);
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/generate`;
    const r = await fetchJson("POST", u, {
      token,
      body: { notes: "M5-T25" },
      idempotencyKey: `m5t25-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T25" },
      idempotencyKey: `m5t25-r-${Date.now()}`,
    });
    if (r.body?.data?.job_id) researchJobId = r.body.data.job_id;
    record("5 — POST research", "POST", u, r.status, researchJobId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  if (!researchJobId) {
    printTable(steps);
    process.exit(1);
  }

  const pollResearchUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(researchJobId)}`;
  let polled = false;
  const rDeadline = Date.now() + MAX_WAIT_MS;
  for (let i = 0; Date.now() < rDeadline; i++) {
    const r = await fetchJson("GET", pollResearchUrl, { token });
    if (r.status === 200 && r.body?.ok && r.body?.data?.status === "succeeded") {
      record("6 — Poll research succeeded", "GET", pollResearchUrl, r.status, "passed on staging", { iterations: i + 1 });
      polled = true;
      break;
    }
    if (r.body?.data?.status === "failed" || r.body?.data?.status === "cancelled") {
      record("6 — Poll research", "GET", pollResearchUrl, r.status, "attempted on staging but failed", r.body);
      printTable(steps);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
  if (!polled) {
    record("6 — Poll research", "GET", pollResearchUrl, null, "attempted on staging but failed", { error: "timeout" });
    printTable(steps);
    process.exit(1);
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const proposed = (r.body?.data?.frame_drafts ?? []).filter((f) => f.status === "proposed");
    if (proposed[0]?.id) frameId = proposed[0].id;
    record("7 — GET framing", "GET", u, r.status, frameId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/frames/select`;
    const r = await fetchJson("POST", u, {
      token,
      body: { frame_id: frameId, selection_mode: "accept" },
      idempotencyKey: `m5t25-sel-${Date.now()}`,
    });
    record("8 — POST frames/select", "POST", u, r.status, r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft/assemble`;
    const r = await fetchJson("POST", u, {
      token,
      body: {
        mode: "full_regeneration",
        preserve_creator_notes: true,
        preserve_manual_event_positions: false,
        preserve_approved_images: true,
      },
      idempotencyKey: `m5t25-asm-${Date.now()}`,
    });
    if (r.body?.data?.job_id) assembleJobId = r.body.data.job_id;
    record("9 — POST draft/assemble", "POST", u, r.status, assembleJobId ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  if (!assembleJobId) {
    printTable(steps);
    process.exit(1);
  }

  const asmPollUrl = `${STAGING_BASE}/api/v1/creator/jobs/${encodeURIComponent(assembleJobId)}`;
  let asmOk = false;
  const asmDeadline = Date.now() + MAX_WAIT_MS;
  for (let i = 0; Date.now() < asmDeadline; i++) {
    const r = await fetchJson("GET", asmPollUrl, { token });
    if (r.status === 200 && r.body?.ok && r.body?.data?.status === "succeeded" && r.body?.data?.kind === "draft_assemble") {
      record("10 — Poll draft assembly succeeded", "GET", asmPollUrl, r.status, "passed on staging", { iterations: i + 1 });
      asmOk = true;
      break;
    }
    await sleep(POLL_MS);
  }
  if (!asmOk) {
    record("10 — Poll draft assembly", "GET", asmPollUrl, null, "attempted on staging but failed", { error: "timeout" });
    printTable(steps);
    process.exit(1);
  }

  const valOutcome = await ensurePublishableValidation(token, storyId, steps, record);
  if (!valOutcome || valOutcome.story_state !== "ready_to_publish") {
    record("E — Publishable validation (pre-first-publish)", "—", "—", null, "blocked on staging", valOutcome, null);
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/latest`;
    const r = await fetchJson("GET", url, { token });
    record("11 — GET validation/latest", "GET", url, r.status, r.status === 200 && r.body?.ok ? "passed on staging" : "attempted on staging but failed", {
      overall: r.body?.data?.validation_report?.overall_result,
    });
  }

  const warnFirst = valOutcome.overall_result === "warn";
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/publish`;
    const publishBody = warnFirst ? { acknowledge_validation_warnings: true } : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `m5t25-publish1-${Date.now()}`,
      },
      body: JSON.stringify(publishBody),
    });
    const rb = await readBody(res);
    const d = rb.parsed?.data;
    const ok =
      isHttpSuccess(res.status) &&
      rb.parsed?.ok === true &&
      d?.story_state === "published" &&
      d?.story_status === "published";
    record("12 — POST publish (first publish)", "POST", url, res.status, ok ? "passed on staging" : "attempted on staging but failed", rb.parsed ?? rb.raw);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const slug = r.body?.data?.story_slug ?? storySlug;
    storySlug = slug ?? storySlug;
    record("13 — GET framing (post-first-publish)", "GET", u, r.status, r.status === 200 ? "passed on staging" : "attempted on staging but failed", {
      story_state: r.body?.data?.story_state,
      story_lifecycle_status: r.body?.data?.story_lifecycle_status,
      story_slug: storySlug,
    });
  }

  if (!storySlug) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No slug.");
    printTable(steps);
    process.exit(1);
  }

  let liveBaselineConclusion = "";
  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    liveBaselineConclusion = (r.body?.data?.conclusion ?? "").trim();
    const ok = r.status === 200 && r.body?.ok === true && liveBaselineConclusion.length > 0;
    record(
      "14 — GET public (baseline frozen conclusion)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok
        ? { conclusion_len: liveBaselineConclusion.length, conclusion_preview: liveBaselineConclusion.slice(0, 120) }
        : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  const updateMarker = `M5-T25 LIVE MARKER ${Date.now()} — visible on public slug only after update-live.`;
  {
    const { draft, status, body } = await getFramingDraft(token, storyId);
    if (!draft?.last_edited_at) {
      record("15 — PATCH draft (post-publish edit)", "PATCH", "—", status, "attempted on staging but failed", body, "No draft.");
      printTable(steps);
      process.exit(1);
    }
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: { conclusion: updateMarker },
      idempotencyKey: `m5t25-postpub-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record("15 — PATCH draft conclusion (working draft after publish)", "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchPublicStory(storySlug);
    const c = (r.body?.data?.conclusion ?? "").trim();
    const frozen = c === liveBaselineConclusion;
    record(
      "16 — GET public (expect unchanged frozen snapshot)",
      "GET",
      url,
      r.status,
      frozen ? "passed on staging" : "attempted on staging but failed",
      {
        public_conclusion_preview: c.slice(0, 140),
        matches_pre_edit_baseline: frozen,
        expected_baseline_preview: liveBaselineConclusion.slice(0, 140),
      },
      "Draft was edited; anonymous read must still show last publish until republish.",
    );
    if (!frozen) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const wf = r.body?.data?.story_state;
    const ok = r.status === 200 && wf === "published";
    record("17 — GET framing (workflow after draft edit)", "GET", u, r.status, ok ? "passed on staging" : "attempted on staging but failed", {
      story_state: wf,
      note: "Working draft changed; workflow stays published until checks advance it.",
    });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  const reval = await runValidationForRepublish(token, storyId, record, "18");
  if (!reval || reval.story_state !== "ready_to_publish") {
    record("18 — Republish validation outcome", "—", "—", null, "blocked on staging", reval, "Expected ready_to_publish after post-publish checks.");
    printTable(steps);
    process.exit(1);
  }

  let warnSecond = false;
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/latest`;
    const r = await fetchJson("GET", url, { token });
    warnSecond = r.body?.data?.validation_report?.overall_result === "warn";
    record("19 — GET validation/latest (pre-republish)", "GET", url, r.status, r.status === 200 && r.body?.ok ? "passed on staging" : "attempted on staging but failed", {
      overall: r.body?.data?.validation_report?.overall_result,
    });
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/publish`;
    const publishBody = warnSecond ? { acknowledge_validation_warnings: true } : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `m5t25-republish-${Date.now()}`,
      },
      body: JSON.stringify(publishBody),
    });
    const rb = await readBody(res);
    const d = rb.parsed?.data;
    const ok =
      isHttpSuccess(res.status) &&
      rb.parsed?.ok === true &&
      d?.story_state === "published" &&
      d?.story_status === "published";
    record(
      "20 — POST publish (update live / republish — same route as first publish)",
      "POST",
      url,
      res.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      rb.parsed ?? rb.raw,
      warnSecond ? "acknowledge_validation_warnings: true" : "pass path",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchPublicStory(storySlug);
    const c = (r.body?.data?.conclusion ?? "").trim();
    const live = c.includes("M5-T25 LIVE MARKER");
    record(
      "21 — GET public (expect new conclusion live)",
      "GET",
      url,
      r.status,
      live ? "passed on staging" : "attempted on staging but failed",
      { conclusion_preview: c.slice(0, 160), contains_marker: live },
    );
    if (!live) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const wf = r.body?.data?.story_state;
    const life = r.body?.data?.story_lifecycle_status;
    const ok = r.status === 200 && wf === "published" && life === "published";
    record(
      "22 — GET framing + next creator action",
      "GET",
      u,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        story_state: wf,
        story_lifecycle_status: life,
        next_supported_action:
          "Working draft can be edited again in the Draft tab; public readers stay on this snapshot until you run checks and POST …/publish again (UI: Update live story). Public slug unchanged.",
        slug: storySlug,
        update_live_contract:
          "POST /api/v1/creator/stories/:storyId/publish with Idempotency-Key; requires latest validation and ready_to_publish while story_status is published; optional acknowledge_validation_warnings when overall_result is warn.",
      },
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T25 staging verify: first publish + post-publish live update passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
