#!/usr/bin/env node
/**
 * M5-T28 — Staging: same discover/visibility contract as M5-T27, plus deployed web bundle proves
 * HomePage wires `GET /api/v1/stories/discover` (SPA: fetch `/` + main `index-*.js` for `homepage-discover-strip` + `stories/discover`).
 *
 * Staging web origin: `STORYWALL_STAGING_WEB_ORIGIN` or default `https://frontend-staging-423b.up.railway.app` (see apps/api/src/main.ts CORS).
 *
 * Usage: pnpm verify:staging:homepage-discover-strip
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
      idempotencyKey: `m5t28-reval-${attempt}-${Date.now()}`,
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

async function patchDraftVisibility(token, storyId, visibility_target, record, stepLabel) {
  const { draft } = await getFraming(token, storyId);
  if (!draft?.last_edited_at) {
    record(stepLabel, "PATCH", "—", null, "blocked on staging", null, "No draft.");
    return false;
  }
  const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/draft`;
  const { status: st, body: b } = await fetchJson("PATCH", url, {
    token,
    body: { visibility_target },
    idempotencyKey: `m5t28-vis-${visibility_target}-${Date.now()}`,
    ifMatch: draft.last_edited_at,
  });
  const ok = st === 200 && b?.ok === true;
  record(stepLabel, "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
  return ok;
}

function slugInDiscover(body, slug) {
  const stories = body?.data?.stories;
  if (!Array.isArray(stories)) return false;
  return stories.some((s) => s.slug === slug);
}

/** Fetch staging web `/` and main JS bundle; prove M5-T28 HomePage code is deployed (not runtime DOM). */
async function probeHomepageDiscoverBundle(webOrigin) {
  const base = webOrigin.replace(/\/$/, "");
  const homeRes = await fetch(`${base}/`);
  const html = await homeRes.text();
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!m) {
    return {
      ok: false,
      homeStatus: homeRes.status,
      reason: "Could not find /assets/index-*.js script in index.html",
    };
  }
  const assetUrl = new URL(m[1], `${base}/`).href;
  const jsRes = await fetch(assetUrl);
  const js = await jsRes.text();
  const hasStrip = js.includes("homepage-discover-strip");
  const hasDiscoverPath = js.includes("stories/discover");
  return {
    ok: hasStrip && hasDiscoverPath,
    homeStatus: homeRes.status,
    assetStatus: jsRes.status,
    asset_href: assetUrl,
    hasStrip,
    hasDiscoverPath,
  };
}

async function main() {
  const STAGING_WEB = (process.env.STORYWALL_STAGING_WEB_ORIGIN ?? "https://frontend-staging-423b.up.railway.app").replace(
    /\/$/,
    "",
  );
  const marker = `m5-t28-home-${Date.now()}`;
  const email = `staging-home-disc-${Date.now()}@example.test`;
  const password = "StagingHomeDiscover9!";

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
      body: { email, password, displayName: "M5-T28 homepage discover" },
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
        subject: `${marker} subject`,
        story_type: "biography",
        research_brief: "Brief for discover verify.",
        desired_angle: "Discover verify angle.",
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
      body: { notes: "M5-T28" },
      idempotencyKey: `m5t28-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T28" },
      idempotencyKey: `m5t28-r-${Date.now()}`,
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
      idempotencyKey: `m5t28-sel-${Date.now()}`,
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
      idempotencyKey: `m5t28-asm-${Date.now()}`,
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
        "Idempotency-Key": `m5t28-publish1-${Date.now()}`,
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
    record("11 — POST publish (first publish, public)", "POST", url, res.status, ok ? "passed on staging" : "attempted on staging but failed", rb.parsed ?? rb.raw);
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
    record("13 — GET public by slug (public live)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? { title: r.body?.data?.title } : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  const discoverUrl = `${STAGING_BASE}/api/v1/stories/discover?limit=200`;
  {
    const r = await fetchJson("GET", discoverUrl, {});
    const contract = r.body?.data?.discovery_contract;
    const listed = slugInDiscover(r.body, storySlug);
    const ok =
      r.status === 200 &&
      r.body?.ok === true &&
      typeof contract === "string" &&
      contract.length > 0 &&
      listed;
    record(
      "14 — GET /api/v1/stories/discover (expect fresh public story listed)",
      "GET",
      discoverUrl,
      r.status,
      ok ? "passed on staging" : r.status === 404 ? "blocked on staging" : "attempted on staging but failed",
      ok
        ? { discovery_contract_preview: contract.slice(0, 120), slug_listed: listed, story_count: r.body?.data?.stories?.length }
        : r.body,
      r.status === 404 ? "Deploy API with GET /api/v1/stories/discover (M5-T27+)." : undefined,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const probe = await probeHomepageDiscoverBundle(STAGING_WEB);
    const ok = probe.ok === true;
    record(
      "15 — GET staging web `/` + main bundle (HomePage discover wiring deployed)",
      "GET",
      STAGING_WEB,
      probe.homeStatus ?? null,
      ok ? "passed on staging" : "attempted on staging but failed",
      {
        asset_status: probe.assetStatus,
        has_homepage_discover_testid: probe.hasStrip,
        has_stories_discover_fetch: probe.hasDiscoverPath,
        ...(probe.reason ? { reason: probe.reason } : {}),
        ...(probe.asset_href ? { asset_href: probe.asset_href } : {}),
      },
      "SPA: bundle must include discover fetch + strip markers; which slugs render follows API discover (step 14), not initial HTML.",
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await patchDraftVisibility(token, storyId, "unlisted", record, "16 — PATCH draft visibility_target unlisted"))) {
    printTable(steps);
    process.exit(1);
  }

  if (!(await republish(token, storyId, record, "17", "m5t28-pub-unlisted"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record("18 — GET public by slug (unlisted still readable)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? {} : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJson("GET", discoverUrl, {});
    const absent = r.status === 200 && r.body?.ok === true && !slugInDiscover(r.body, storySlug);
    record(
      "19 — GET discover (unlisted story must be absent)",
      "GET",
      discoverUrl,
      r.status,
      absent ? "passed on staging" : "attempted on staging but failed",
      { slug_absent_from_discover: absent, story_count: r.body?.data?.stories?.length },
    );
    if (!absent) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await patchDraftVisibility(token, storyId, "private", record, "20 — PATCH draft visibility_target private"))) {
    printTable(steps);
    process.exit(1);
  }

  if (!(await republish(token, storyId, record, "21", "m5t28-pub-private"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 404;
    record("22 — GET public by slug (private — expect 404)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", { status: r.status });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJson("GET", discoverUrl, {});
    const absent = r.status === 200 && r.body?.ok === true && !slugInDiscover(r.body, storySlug);
    record(
      "23 — GET discover (private story still absent)",
      "GET",
      discoverUrl,
      r.status,
      absent ? "passed on staging" : "attempted on staging but failed",
      { slug_absent_from_discover: absent },
    );
    if (!absent) {
      printTable(steps);
      process.exit(1);
    }
  }

  record(
    "24 — Next creator action",
    "—",
    "—",
    null,
    "passed on staging",
    {
      staging_web_origin: STAGING_WEB,
      homepage_route: "GET / (SPA loads discover strip client-side)",
      discovery_route: "GET /api/v1/stories/discover",
      slug_read_route: "GET /api/v1/stories/:slug",
      contract:
        "HomePage uses discover API; list is public-only. Unlisted/private omitted from discover; unlisted slug-readable until private.",
      next: "Restore public visibility via draft + checks + update-live if you want the story discoverable again on homepage.",
    },
  );

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T28 staging verify: homepage discover strip + API contract passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
