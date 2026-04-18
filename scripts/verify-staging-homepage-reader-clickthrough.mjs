#!/usr/bin/env node
/**
 * M5-T30 — Staging: homepage discover strip → click → `/stories/:slug` reader (GET …/stories/:slug),
 * then unlisted (strip absent, slug still readable), then private (anonymous unavailable).
 *
 * Web origin: `STORYWALL_STAGING_WEB_ORIGIN` / `STORYWALL_STAGING_FRONTEND_ORIGIN` or
 * `scripts/lib/staging-web-origin.mjs` default. Requires Playwright: `pnpm exec playwright install chromium`.
 *
 * Usage: pnpm verify:staging:homepage-reader-clickthrough
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
      idempotencyKey: `m5t30-reval-${attempt}-${Date.now()}`,
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
    idempotencyKey: `m5t30-vis-${visibility_target}-${Date.now()}`,
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

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (e) {
    return { error: String(/** @type {Error} */ (e)?.message ?? e) };
  }
}

/** Homepage → click discover link → reader: URL, article root, title matches API. */
async function playwrightHomeToReader(webOrigin, storySlug, expectedTitle) {
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
    const discoverWait = page.waitForResponse(
      (r) => r.request().method() === "GET" && r.status() === 200 && /\/api\/v1\/stories\/discover/.test(r.url()),
      { timeout: 90_000 },
    );
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await discoverWait;
    await page.waitForSelector('[data-testid="homepage-discover-strip"]', { timeout: 60_000 });
    await page.locator(`[data-discover-slug="${storySlug}"] a.homepage-discover-strip__link`).first().click();
    await page.waitForURL((u) => u.pathname === `/stories/${storySlug}` || u.pathname === `/stories/${encodeURIComponent(storySlug)}`, {
      timeout: 60_000,
    });
    // M5-T30: prefer new test ids when deployed; fall back to public reader layout for older bundles.
    await page.waitForSelector("article.public-story-page h1.public-story-title", { state: "visible", timeout: 60_000 });
    const h1 = (await page.locator("h1.public-story-title").first().textContent())?.trim() ?? "";
    const titleOk = h1 === String(expectedTitle).trim();
    const articleTestId = await page.locator('[data-testid="public-story-article"]').count();
    return {
      ok: titleOk,
      blocked: false,
      final_url: page.url(),
      h1_public_story_title: h1,
      expected_title: expectedTitle,
      deployed_has_public_story_article_testid: articleTestId > 0,
    };
  } finally {
    await browser.close();
  }
}

/** After unlisted: browser discover omits slug and homepage DOM has no row. */
async function playwrightHomepageOmitsSlug(webOrigin, storySlug) {
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
    const discoverWait = page.waitForResponse(
      (r) => r.request().method() === "GET" && r.status() === 200 && /\/api\/v1\/stories\/discover/.test(r.url()),
      { timeout: 90_000 },
    );
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const dr = await discoverWait;
    const dj = await dr.json();
    const listed = slugInDiscover(dj, storySlug);
    await page.waitForSelector('[data-testid="homepage-discover-strip"]', { timeout: 60_000 });
    const domCount = await page.locator(`[data-discover-slug="${storySlug}"]`).count();
    return {
      ok: !listed && domCount === 0,
      blocked: false,
      slug_listed_in_browser_discover_json: listed,
      dom_rows_for_slug: domCount,
    };
  } finally {
    await browser.close();
  }
}

/** Direct `/stories/:slug` — expect published article or unavailable surface. */
async function playwrightDirectReader(webOrigin, storySlug, expectArticle, expectedTitleWhenArticle) {
  const mod = await loadPlaywright();
  if ("error" in mod) {
    return { ok: false, blocked: true, reason: "pnpm exec playwright install chromium", error: mod.error };
  }
  const { chromium } = mod;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const base = webOrigin.replace(/\/$/, "");
    const path = `/stories/${encodeURIComponent(storySlug)}`;
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (expectArticle) {
      await page.waitForSelector("article.public-story-page h1.public-story-title", { state: "visible", timeout: 60_000 });
      const h1 = (await page.locator("h1.public-story-title").first().textContent())?.trim() ?? "";
      const titleOk =
        expectedTitleWhenArticle && String(expectedTitleWhenArticle).trim().length > 0
          ? h1 === String(expectedTitleWhenArticle).trim()
          : h1.length > 0;
      return {
        ok: titleOk,
        blocked: false,
        final_url: page.url(),
        h1_public_story_title: h1,
        expect_article: true,
      };
    }
    await page.getByRole("heading", { name: "Story unavailable", exact: true }).waitFor({ state: "visible", timeout: 60_000 });
    const h1 = (await page.locator("h1.public-story-title").first().textContent())?.trim() ?? "";
    const unavailableOk = h1 === "Story unavailable";
    return {
      ok: unavailableOk,
      blocked: false,
      final_url: page.url(),
      h1_public_story_title: h1,
      expect_article: false,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const originMeta = describeStagingWebOriginResolution();
  const STAGING_WEB = originMeta.origin;
  console.log("\n" + "#".repeat(72));
  console.log("M5-T30 — homepage → reader clickthrough (staging)");
  console.log("Web:", STAGING_WEB);
  console.log("API:", STAGING_BASE);
  console.log("#".repeat(72));

  const marker = `m5-t30-reader-${Date.now()}`;
  const email = `staging-reader-t30-${Date.now()}@example.test`;
  const password = "StagingReaderClick9!";

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
      body: { email, password, displayName: "M5-T30 reader clickthrough" },
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
        research_brief: "Brief for reader clickthrough verify.",
        desired_angle: "Reader verify angle.",
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
      body: { notes: "M5-T30" },
      idempotencyKey: `m5t30-f-${Date.now()}`,
    });
    record("4 — POST frames/generate", "POST", u, r.status, isHttpSuccess(r.status) && r.body?.ok ? "passed on staging" : "attempted on staging but failed", r.body);
  }
  {
    const u = `${STAGING_BASE}/api/v1/creator/stories/${encodeURIComponent(storyId)}/research`;
    const r = await fetchJson("POST", u, {
      token,
      body: { mode: "full", respect_existing_manual_events: true, respect_existing_sources: true, notes: "M5-T30" },
      idempotencyKey: `m5t30-r-${Date.now()}`,
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
      idempotencyKey: `m5t30-sel-${Date.now()}`,
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
      idempotencyKey: `m5t30-asm-${Date.now()}`,
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
        "Idempotency-Key": `m5t30-publish1-${Date.now()}`,
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
      "14 — GET discover (expect fresh public story listed)",
      "GET",
      discoverUrl,
      r.status,
      ok ? "passed on staging" : r.status === 404 ? "blocked on staging" : "attempted on staging but failed",
      ok ? { discovery_contract_preview: contract.slice(0, 120), slug_listed: listed } : r.body,
      r.status === 404 ? "Deploy API discover (M5-T27+)." : undefined,
    );
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const pr = await playwrightHomeToReader(STAGING_WEB, storySlug, expectedTitle);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "15 — Playwright: homepage strip click → /stories/:slug reader shows same title",
      "BROWSER",
      `${STAGING_WEB}/ → /stories/${storySlug}`,
      null,
      verdict,
      pr,
      pr.blocked ? pr.reason : "Clicks homepage discover link; asserts /stories/:slug URL + article h1 matches GET …/stories/:slug title (optional data-testid when deployed).",
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
  if (!(await republish(token, storyId, record, "17", "m5t30-pub-unlisted"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 200 && r.body?.ok === true;
    record("18 — GET public by slug (unlisted still readable)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", ok ? { title: r.body?.data?.title } : r.body);
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJson("GET", discoverUrl, {});
    const absent = r.status === 200 && r.body?.ok === true && !slugInDiscover(r.body, storySlug);
    record(
      "19 — GET discover (unlisted absent from list)",
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

  {
    const pr = await playwrightHomepageOmitsSlug(STAGING_WEB, storySlug);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "20 — Playwright: homepage strip no longer lists slug after unlisted",
      "BROWSER",
      STAGING_WEB,
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

  {
    const pr = await playwrightDirectReader(STAGING_WEB, storySlug, true, expectedTitle);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "21 — Playwright: direct /stories/:slug still shows reader article (unlisted)",
      "BROWSER",
      `${STAGING_WEB}/stories/${encodeURIComponent(storySlug)}`,
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

  if (!(await patchDraftVisibility(token, storyId, "private", record, "22 — PATCH draft visibility_target private"))) {
    printTable(steps);
    process.exit(1);
  }
  if (!(await republish(token, storyId, record, "23", "m5t30-pub-private"))) {
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_BASE}/api/v1/stories/${encodeURIComponent(storySlug)}`;
    const r = await fetchJson("GET", url, {});
    const ok = r.status === 404;
    record("24 — GET public by slug (private — API 404)", "GET", url, r.status, ok ? "passed on staging" : "attempted on staging but failed", { status: r.status });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const pr = await playwrightDirectReader(STAGING_WEB, storySlug, false);
    const verdict = pr.blocked ? "blocked on staging" : pr.ok ? "passed on staging" : "attempted on staging but failed";
    record(
      "25 — Playwright: direct /stories/:slug shows honest unavailable (private)",
      "BROWSER",
      `${STAGING_WEB}/stories/${encodeURIComponent(storySlug)}`,
      null,
      verdict,
      pr,
      pr.blocked ? pr.reason : "Expect data-testid=public-story-unavailable and h1 Story unavailable (not a silent blank).",
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
      reader_route: "/stories/:slug → PublicStoryPage → GET /api/v1/stories/:slug",
      after_public: "Share homepage link or /stories/:slug; change draft visibility + republish to unlisted/private.",
      after_unlisted: "Story readable by slug only; restore public + republish to re-list on homepage strip.",
      after_private: "Anonymous cannot read; set visibility to public or unlisted, validate, republish to restore slug read.",
    },
  );

  printTable(steps);
  const failed = steps.some((s) => s.verdict === "attempted on staging but failed" || s.verdict === "blocked on staging");
  if (failed) process.exit(1);
  console.log("\nM5-T30 staging verify: homepage → reader clickthrough passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
