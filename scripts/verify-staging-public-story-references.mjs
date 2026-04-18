#!/usr/bin/env node
/**
 * M5-T31 — Staging: `GET /api/v1/stories/:slug/references` + reader surfaces (story page index card + full refs page),
 * for public → unlisted → private visibility.
 *
 * Web origin: M5-T29 resolution. Requires Playwright: `pnpm exec playwright install chromium`.
 *
 * Usage: pnpm verify:staging:public-story-references
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
import { describeStagingWebOriginResolution } from "./lib/staging-web-origin.mjs";

async function getFraming(token, storyId) {
  const url = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/framing`;
  const { status, body } = await fetchJson("GET", url, { token });
  const d = body?.data;
  return { status, body, draft: d?.story_draft ?? null, liveVis: d?.live_story_visibility ?? null, wf: d?.story_state };
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
      idempotencyKey: `m5t31-reval-${attempt}-${Date.now()}`,
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
    idempotencyKey: `m5t31-vis-${visibility_target}-${Date.now()}`,
    ifMatch: draft.last_edited_at,
  });
  const ok = st === 200 && b?.ok === true;
  record(stepLabel, "PATCH", url, st, ok ? "passed on staging" : "attempted on staging but failed", redactForLog(b));
  return ok;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (e) {
    return { error: String(/** @type {Error} */ (e)?.message ?? e) };
  }
}

/** Story page → open full references → h1 matches published title (M5-T31 index card or legacy link). */
async function playwrightReaderReferencesJourney(webOrigin, storySlug, expectedTitle) {
  const mod = await loadPlaywright();
  if ("error" in mod) {
    return { ok: false, blocked: true, reason: "pnpm exec playwright install chromium", error: mod.error };
  }
  const { chromium } = mod;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const base = webOrigin.replace(/\/$/, "");
    if (/["'\\<>]/.test(storySlug)) return { ok: false, blocked: false, reason: "slug unsafe for selector" };
    const path = `/stories/${encodeURIComponent(storySlug)}`;
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("article.public-story-page h1.public-story-title", { state: "visible", timeout: 60_000 });
    const idx = page.locator('[data-testid="public-story-references-index"]');
    const idxCount = await idx.count();
    let mode = "legacy";
    if (idxCount > 0) {
      await idx.getByRole("link", { name: /Open full references index/i }).waitFor({ state: "visible", timeout: 90_000 });
      await idx.getByRole("link", { name: /Open full references index/i }).click();
      mode = "index-card";
    } else {
      await page.getByRole("link", { name: /View all references/i }).first().waitFor({ state: "visible", timeout: 90_000 });
      await page.getByRole("link", { name: /View all references/i }).first().click();
    }
    await page.waitForURL(/\/references/, { timeout: 60_000 });
    await page.waitForSelector("article.public-story-refs-page h1.public-story-title", { state: "visible", timeout: 60_000 });
    const refH1 = ((await page.locator("article.public-story-refs-page h1.public-story-title").first().textContent()) ?? "").trim();
    const ok = refH1 === String(expectedTitle).trim();
    return { ok, blocked: false, ref_page_h1: refH1, expected_title: expectedTitle, mode };
  } finally {
    await browser.close();
  }
}

async function playwrightReferencesPageUnavailable(webOrigin, storySlug) {
  const mod = await loadPlaywright();
  if ("error" in mod) {
    return { ok: false, blocked: true, reason: "pnpm exec playwright install chromium", error: mod.error };
  }
  const { chromium } = mod;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const base = webOrigin.replace(/\/$/, "");
    await page.goto(`${base}/stories/${encodeURIComponent(storySlug)}/references`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("heading", { name: "References unavailable", exact: true }).waitFor({ state: "visible", timeout: 60_000 });
    const testId = await page.locator('[data-testid="public-story-refs-unavailable"]').count();
    return { ok: true, blocked: false, has_refs_unavailable_testid: testId > 0 };
  } finally {
    await browser.close();
  }
}

function refCounts(body) {
  const d = body?.data;
  if (!d) return { sources: 0, timelineRefs: 0 };
  const sources = Array.isArray(d.sources) ? d.sources.length : 0;
  const timelineRefs = Array.isArray(d.events)
    ? d.events.reduce((acc, ev) => acc + (Array.isArray(ev.references) ? ev.references.length : 0), 0)
    : 0;
  return { sources, timelineRefs };
}

async function main() {
  const originMeta = describeStagingWebOriginResolution();
  const STAGING_WEB = originMeta.origin;
  console.log("\n" + "#".repeat(72));
  console.log("M5-T31 — public story references (staging)");
  console.log("Web:", STAGING_WEB);
  console.log("API:", STAGING_BASE);
  console.log("#".repeat(72));

  const marker = `m5-t31-refs-${Date.now()}`;
  const email = `staging-refs-t31-${Date.now()}@example.test`;
  const password = "StagingPublicRefs9!";

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
  let expectedTitle = "";

  {
    const url = `${STAGING_BASE}/api/v1/auth/register`;
    const { status, body } = await fetchJson("POST", url, {
      body: { email, password, displayName: "M5-T31 public references" },
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
        research_brief: "Brief for public references verify.",
        desired_angle: "Refs verify angle.",
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
      body: { notes: "M5-T31" },
      idempotencyKey: `m5t31-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T31" },
      idempotencyKey: `m5t31-r-${Date.now()}`,
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
      idempotencyKey: `m5t31-sel-${Date.now()}`,
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
      idempotencyKey: `m5t31-asm-${Date.now()}`,
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
        "Idempotency-Key": `m5t31-publish1-${Date.now()}`,
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
    expectedTitle = ok ? String(r.body?.data?.title ?? "") : "";
    record("13 — GET public by slug (public live, capture title)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? { title: expectedTitle } : r.body);
    if (!ok || !expectedTitle) {
      printTable(steps);
      process.exit(1);
    }
  }

  const referencesUrl = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}/references`;
  {
    const r = await fetchJson("GET", referencesUrl, {});
    const counts = refCounts(r.body);
    const ok = r.status === 200 && r.body?.ok === true && r.body?.data?.slug === storySlug;
    record(
      "14 — GET public references (public live)",
      "GET",
      referencesUrl,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok ? { ...counts, slug: r.body?.data?.slug } : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const pr = await playwrightReaderReferencesJourney(STAGING_WEB, storySlug, expectedTitle);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "15 — Playwright: reader story → full references page (title matches)",
      "BROWSER",
      `${STAGING_WEB}/stories/${storySlug} → /references`,
      null,
      verdict,
      pr,
      pr.blocked ? pr.reason : "Uses Open full references index (M5-T31) or legacy View all references; refs page h1 must match API story title.",
    );
    if (pr.blocked || !pr.ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await patchDraftVisibility(token, storyId, "unlisted", record, "16 — PATCH draft visibility_target unlisted"))) {
    printTable(steps);
    process.exit(1);
  }
  if (!(await republish(token, storyId, record, "17", "m5t31-pub-unlisted"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record("18 — GET public by slug (unlisted)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? { title: r.body?.data?.title } : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJson("GET", referencesUrl, {});
    const counts = refCounts(r.body);
    const ok = r.status === 200 && r.body?.ok === true;
    record(
      "19 — GET public references (unlisted)",
      "GET",
      referencesUrl,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      ok ? counts : r.body,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const pr = await playwrightReaderReferencesJourney(STAGING_WEB, storySlug, expectedTitle);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "20 — Playwright: unlisted reader references journey still works",
      "BROWSER",
      `${STAGING_WEB}/stories/${storySlug} → /references`,
      null,
      verdict,
      pr,
      pr.blocked ? pr.reason : undefined,
    );
    if (pr.blocked || !pr.ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  if (!(await patchDraftVisibility(token, storyId, "private", record, "21 — PATCH draft visibility_target private"))) {
    printTable(steps);
    process.exit(1);
  }
  if (!(await republish(token, storyId, record, "22", "m5t31-pub-private"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 404;
    record("23 — GET public by slug (private — API 404)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", { status: r.status });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJson("GET", referencesUrl, {});
    const ok = r.status === 404;
    record(
      "24 — GET public references (private — API 404)",
      "GET",
      referencesUrl,
      r.status,
      ok ? "passed on staging" : "attempted on staging but failed",
      { status: r.status },
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const pr = await playwrightReferencesPageUnavailable(STAGING_WEB, storySlug);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "25 — Playwright: /references shows References unavailable (private)",
      "BROWSER",
      `${STAGING_WEB}/stories/${encodeURIComponent(storySlug)}/references`,
      null,
      verdict,
      pr,
      pr.blocked ? pr.reason : "After web deploy with M5-T31, expect data-testid=public-story-refs-unavailable.",
    );
    if (pr.blocked || !pr.ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  record(
    "26 — Next creator action",
    "—",
    "—",
    null,
    "passed on staging",
    {
      staging_web_origin: STAGING_WEB,
      references_route: "GET /api/v1/stories/:slug/references",
      reader_surfaces: "Story page index card + /stories/:slug/references page",
      after_public: "References follow live visibility; republish to change.",
      after_unlisted: "Slug + references remain for anonymous direct URLs; public discover omits story.",
      after_private: "Restore public or unlisted + republish to reopen anonymous story and references.",
    },
  );

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T31 staging verify: public story references passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
