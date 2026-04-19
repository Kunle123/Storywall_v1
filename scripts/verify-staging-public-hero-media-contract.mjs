#!/usr/bin/env node
/**
 * Post-canonical — Staging: public story JSON includes frozen hero/media fields; live reader exposes `data-hero-state`
 * and optional timeline figure hooks.
 *
 * Usage: pnpm verify:staging:public-hero-media-contract
 */

const STAGING_API = "https://api-staging-1de1.up.railway.app";

function printTable(steps) {
  console.log("\n## Summary table\n");
  console.log("| Step | Target | Verdict |");
  console.log("|------|--------|---------|");
  for (const s of steps) {
    console.log(`| ${s.step} | ${s.target} | ${s.verdict} |`);
  }
}

function assertMediaContract(data) {
  const errs = [];
  for (const key of ["imagery_mode", "hero_image_url", "hero_image_alt", "hero_image_credit"]) {
    if (!(key in data)) errs.push(`missing top-level field: ${key}`);
  }
  if (data.imagery_mode !== null && typeof data.imagery_mode !== "string") {
    errs.push("imagery_mode must be string or null");
  }
  for (const hk of ["hero_image_url", "hero_image_alt", "hero_image_credit"]) {
    if (data[hk] !== null && typeof data[hk] !== "string") errs.push(`${hk} must be string or null`);
  }
  if (!Array.isArray(data.events)) errs.push("events must be array");
  else if (data.events.length > 0) {
    const ev0 = data.events[0];
    if (!ev0 || typeof ev0 !== "object") errs.push("events[0] invalid");
    else if (!("primary_image" in ev0)) errs.push("events[0] missing primary_image");
    else if (ev0.primary_image !== null && typeof ev0.primary_image !== "object") {
      errs.push("events[0].primary_image must be object or null");
    } else if (ev0.primary_image && typeof ev0.primary_image.url !== "string") {
      errs.push("events[0].primary_image.url must be string when object present");
    }
  }
  return errs;
}

async function playwrightHeroState(webOrigin, slug) {
  let chromiumMod;
  try {
    chromiumMod = await import("playwright");
  } catch (e) {
    return { ok: false, blocked: true, reason: "pnpm exec playwright install chromium", error: String(e?.message ?? e) };
  }
  const { chromium } = chromiumMod;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `${webOrigin.replace(/\/$/, "")}/stories/${encodeURIComponent(slug)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="public-story-article"]', { state: "visible", timeout: 60_000 });
    const article = page.locator('[data-testid="public-story-article"]');
    const heroState = await article.getAttribute("data-hero-state");
    const allowed = new Set(["image", "typographic", "empty"]);
    const ok = typeof heroState === "string" && allowed.has(heroState);
    const rendition = await page.locator(".public-story-hero-band").first().getAttribute("data-hero-rendition");
    return { ok, blocked: false, heroState, rendition, url };
  } finally {
    await browser.close();
  }
}

async function main() {
  const { resolveStagingWebOrigin, describeStagingWebOriginResolution } = await import("./lib/staging-web-origin.mjs");
  const web = resolveStagingWebOrigin();
  const meta = describeStagingWebOriginResolution();

  /** @type {{ step: string, target: string, verdict: string, detail?: unknown }[]} */
  const steps = [];

  {
    const url = `${STAGING_API}/api/v1/health`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body?.ok === true;
    steps.push({ step: "0 — API health", target: url, verdict: ok ? "passed on staging" : "failed", detail: body });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  const discoverRes = await fetch(`${STAGING_API}/api/v1/stories/discover?limit=5`);
  const dj = await discoverRes.json();
  const slug =
    typeof dj?.data?.stories?.[0]?.slug === "string" ? dj.data.stories[0].slug.trim() : "";
  if (!slug) {
    steps.push({
      step: "1 — GET discover",
      target: `${STAGING_API}/api/v1/stories/discover?limit=5`,
      verdict: "failed",
      detail: "no public slug",
    });
    printTable(steps);
    process.exit(1);
  }

  {
    const url = `${STAGING_API}/api/v1/stories/${encodeURIComponent(slug)}`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    const data = body?.data;
    const okEnvelope = res.status === 200 && body?.ok === true && data && typeof data === "object";
    const errs = okEnvelope ? assertMediaContract(data) : ["bad response"];
    const ok = okEnvelope && errs.length === 0;
    steps.push({
      step: "1 — GET public story media contract",
      target: url,
      verdict: ok ? "passed on staging" : "failed",
      detail: okEnvelope ? { slug, field_errors: errs } : { status: res.status, body },
    });
    if (!ok) {
      console.error(JSON.stringify(steps[steps.length - 1].detail, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await playwrightHeroState(web, slug);
    const verdict = r.blocked ? "blocked on staging" : r.ok ? "passed on staging" : "failed";
    steps.push({
      step: "2 — Playwright: reader `data-hero-state`",
      target: `${web}/stories/${encodeURIComponent(slug)}`,
      verdict,
      detail: r,
    });
    if (r.blocked || !r.ok) {
      console.error(JSON.stringify(r, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  steps.push({
    step: "3 — Staging web origin",
    target: "meta",
    verdict: "passed on staging",
    detail: meta,
  });

  printTable(steps);
  console.log("\nPost-canonical staging verify: public hero/media contract + reader hero-state passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
