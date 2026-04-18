#!/usr/bin/env node
/**
 * M5-T26 — Staging: first publish (public) → PATCH draft visibility_target alone does not change anonymous read
 * until checks + POST …/publish → private removes GET /api/v1/stories/:slug → public/unlisted restores it.
 *
 * Requires API with `live_story_visibility` on GET …/framing and deferred story.visibility on draft PATCH when published.
 *
 * Usage: pnpm verify:staging:published-visibility-transition
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

async function getFraming(token, storyId) {
  const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
  const { status, body } = await fetchJson("GET", url, { token });
  const d = body?.data;
  return {
    status,
    body,
    draft: d?.story_draft ?? null,
    liveVis: d?.live_story_visibility ?? null,
    wf: d?.story_state,
    life: d?.story_lifecycle_status,
  };
}

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
      idempotencyKey: `m5t26-reval-${attempt}-${Date.now()}`,
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

async function republish(token, storyId, record, stepName, idemPrefix) {
  const reval = await runValidationForRepublish(token, storyId, record, `${stepName}-val`);
  if (!reval || reval.story_state !== "ready_to_publish") {
    record(`${stepName} — validation for republish`, "—", "—", null, "blocked on staging", reval, null);
    return false;
  }
  let warnSecond = false;
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/validation/latest`;
    const r = await fetchJson("GET", url, { token });
    warnSecond = r.body?.data?.validation_report?.overall_result === "warn";
    record(`${stepName} — GET validation/latest`, "GET", url, r.status, r.status === 200 && r.body?.ok ? "passed on staging" : "attempted on staging but failed", {
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
        "Idempotency-Key": `${idemPrefix}-${Date.now()}`,
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
    record(`${stepName} — POST publish (update live)`, "POST", url, res.status, ok ? "passed on staging" : "attempted on staging but failed", rb.parsed ?? rb.raw);
    return ok;
  }
}

async function main() {
  const email = `staging-vis-transition-${Date.now()}@example.test`;
  const password = "StagingVisTransition9!";

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
      body: { email, password, displayName: "M5-T26 visibility transition" },
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
    const { status, body } = await fetchJson("POST", url, { body: { email, password } });
    const ok = isHttpSuccess(status) && body?.data?.access_token;
    if (ok) token = body.data.access_token;
    record("2 — Login", "POST", url, status, ok ? "passed on staging" : "attempted on staging but failed", body);
  }

  {
    const url = `${STAGING_BASE}/api/v1/creator/stories`;
    const { status, body } = await fetchJson("POST", url, {
      token,
      body: {
        subject: "M5-T26 visibility transition subject",
        story_type: "biography",
        research_brief: "Brief for visibility verify.",
        desired_angle: "Visibility verify angle.",
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
      body: { notes: "M5-T26" },
      idempotencyKey: `m5t26-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T26" },
      idempotencyKey: `m5t26-r-${Date.now()}`,
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
      idempotencyKey: `m5t26-sel-${Date.now()}`,
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
      idempotencyKey: `m5t26-asm-${Date.now()}`,
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

  const warnFirst = valOutcome.overall_result === "warn";
  {
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/publish`;
    const publishBody = warnFirst ? { acknowledge_validation_warnings: true } : {};
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `m5t26-publish1-${Date.now()}`,
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
    record("11 — POST publish (first publish)", "POST", url, res.status, ok ? "passed on staging" : "attempted on staging but failed", rb.parsed ?? rb.raw);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    storySlug = r.body?.data?.story_slug ?? storySlug;
    record("12 — GET framing (post-first-publish)", "GET", u, r.status, r.status === 200 ? "passed on staging" : "attempted on staging but failed", {
      story_slug: storySlug,
      live_story_visibility: r.body?.data?.live_story_visibility,
      draft_visibility: r.body?.data?.story_draft?.visibility_target,
    });
  }

  if (!storySlug) {
    record("blocked", "—", "—", null, "blocked on staging", null, "No slug.");
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record("13 — GET public (expect 200 when live is public)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? { title: r.body?.data?.title } : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const draft = r.body?.data?.story_draft;
    const liveVis = r.body?.data?.live_story_visibility;
    const hasField = liveVis !== null && liveVis !== undefined;
    const aligned = hasField && liveVis === "public" && draft?.visibility_target === "public";
    record(
      "14 — GET framing (live_story_visibility contract)",
      "GET",
      u,
      r.status,
      aligned ? "passed on staging" : "blocked on staging",
      { live_story_visibility: liveVis, draft_visibility_target: draft?.visibility_target },
      hasField ? undefined : "API must expose data.live_story_visibility (M5-T26). Redeploy API.",
    );
    if (!aligned) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const { draft } = await getFraming(token, storyId);
    if (!draft?.last_edited_at) {
      record("15 — PATCH draft visibility private (draft only)", "PATCH", "—", null, "blocked on staging", null, "No draft.");
      printTable(steps);
      process.exit(1);
    }
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: { visibility_target: "private" },
      idempotencyKey: `m5t26-vispriv-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record("15 — PATCH draft visibility_target private", "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const r = await fetchJson("GET", u, { token });
    const draft = r.body?.data?.story_draft;
    const liveVis = r.body?.data?.live_story_visibility;
    const ok = draft?.visibility_target === "private" && liveVis === "public";
    record(
      "16 — GET framing (draft private, live still public)",
      "GET",
      u,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { draft_visibility_target: draft?.visibility_target, live_story_visibility: liveVis },
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record(
      "17 — GET public (still 200 before update-live — frozen live gate)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok ? { note: "Anonymous read uses last-published visibility until republish." } : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await republish(token, storyId, record, "18", "m5t26-pub-private"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 404;
    record(
      "19 — GET public (expect 404 when live is private)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok ? { note: "Private removes anonymous read for this slug." } : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const { draft } = await getFraming(token, storyId);
    if (!draft?.last_edited_at) {
      printTable(steps);
      process.exit(1);
    }
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: { visibility_target: "public" },
      idempotencyKey: `m5t26-vispub-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record("20 — PATCH draft visibility_target public", "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const stillHidden = r.status === 404;
    record(
      "21 — GET public (still 404 until republish — draft intent alone)",
      "GET",
      url,
      r.status,
      stillHidden ? "passed on staging" : "attempted on staging but failed",
      { status: r.status },
    );
    if (!stillHidden) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await republish(token, storyId, record, "22", "m5t26-pub-public"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record("23 — GET public (200 after live returns public)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? {} : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const { draft } = await getFraming(token, storyId);
    if (!draft?.last_edited_at) {
      printTable(steps);
      process.exit(1);
    }
    const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
    const { status: st, body: b } = await fetchJson("PATCH", url, {
      token,
      body: { visibility_target: "unlisted" },
      idempotencyKey: `m5t26-visunl-${Date.now()}`,
      ifMatch: draft.last_edited_at,
    });
    const ok = st === 200 && b?.ok === true;
    record("24 — PATCH draft visibility_target unlisted", "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record(
      "25 — GET public (still 200 — live gate unchanged until republish)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok ? { note: "Live visibility still public; draft unlisted intent not applied to readers yet." } : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await republish(token, storyId, record, "26", "m5t26-pub-unlisted"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
    const fr = await fetchJson("GET", u, { token });
    const liveVis = fr.body?.data?.live_story_visibility;
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true && liveVis === "unlisted";
    record(
      "27 — GET public + framing (unlisted live — still readable by slug)",
      "GET",
      url,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { live_story_visibility: liveVis },
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  record(
    "28 — Next creator action",
    "—",
    "—",
    null,
    "passed on staging",
    {
      next: "Change working draft visibility_target when needed; run checks; Update live story (POST …/publish) so live_story_visibility and anonymous GET behavior match. Slug unchanged.",
    },
  );

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T26 staging verify: published visibility transitions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
