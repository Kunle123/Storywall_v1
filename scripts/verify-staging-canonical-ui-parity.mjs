#!/usr/bin/env node
/**
 * M5-T30 — Staging: live Railway proof of UI parity tokens (CSS bundle) + Playwright checks for editorial rail on
 * homepage discover, reader trust explainer, and timeline section when a public story has events.
 *
 * Usage: pnpm verify:staging:canonical-ui-parity
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

function extractStylesheetHrefs(html) {
  const out = [];
  const re = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const hm = /href=["']([^"']+)["']/i.exec(tag);
    if (hm?.[1]) out.push(hm[1]);
  }
  return out;
}

function extractModuleScriptSrcs(html) {
  const out = [];
  const re = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

async function fetchCssHasParityTokens(webOrigin) {
  const base = webOrigin.replace(/\/$/, "");
  const homeRes = await fetch(`${base}/`);
  const html = await homeRes.text();
  const hrefs = extractStylesheetHrefs(html);
  for (const h of hrefs) {
    const url = new URL(h, `${base}/`).href;
    const r = await fetch(url);
    const css = await r.text();
    if (css.includes("--sw-editorial-surface") && css.includes(".homepage-discover-strip")) {
      return { ok: true, homeStatus: homeRes.status, css_href: url, css_bytes: css.length };
    }
  }
  return { ok: false, homeStatus: homeRes.status, stylesheets_tried: hrefs.length, reason: "CSS bundle missing M5-T30 tokens" };
}

async function fetchJsHasParityMarker(webOrigin) {
  const base = webOrigin.replace(/\/$/, "");
  const homeRes = await fetch(`${base}/`);
  const html = await homeRes.text();
  const srcs = extractModuleScriptSrcs(html);
  for (const s of srcs) {
    const url = new URL(s, `${base}/`).href;
    const r = await fetch(url);
    const js = await r.text();
    if (js.includes("data-sw-parity") && js.includes("m5-t30-v1")) {
      return { ok: true, js_href: url, js_bytes: js.length };
    }
  }
  return { ok: false, reason: "JS bundle missing data-sw-parity marker", scripts_tried: srcs.length };
}

async function playwrightParity(webOrigin) {
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
    const home = `${webOrigin.replace(/\/$/, "")}/`;
    await page.goto(home, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="homepage-discover-strip"]', { state: "visible", timeout: 60_000 });
    const strip = page.locator('[data-testid="homepage-discover-strip"]');
    const attr = await strip.getAttribute("data-sw-parity");
    const bl = await strip.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth || "0"));
    const homeOk = attr === "m5-t30-v1" && bl >= 2;

    const discoverRes = await fetch(`${STAGING_API}/api/v1/stories/discover?limit=5`);
    const dj = await discoverRes.json();
    const slug = typeof dj?.data?.stories?.[0]?.slug === "string" ? dj.data.stories[0].slug.trim() : "";

    let readerOk = true;
    let readerDetail = "skipped — no public slug";
    if (slug) {
      await page.goto(`${webOrigin.replace(/\/$/, "")}/stories/${encodeURIComponent(slug)}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForSelector('[data-testid="public-trust-explainer"]', { state: "visible", timeout: 60_000 });
      const trust = page.locator('[data-testid="public-trust-explainer"]');
      const tbl = await trust.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth || "0"));
      const trustOk = tbl >= 2;
      const timeline = page.locator('[data-testid="public-story-timeline-section"]');
      const timelineCount = await timeline.count();
      let timelineOk = true;
      if (timelineCount > 0) {
        const tbl2 = await timeline.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth || "0"));
        timelineOk = tbl2 >= 2;
      }
      readerOk = trustOk && timelineOk;
      readerDetail = { slug, trust_border_px: tbl, timeline_present: timelineCount > 0 };
    }

    return { ok: homeOk && readerOk, blocked: false, home_border_left_px: bl, data_sw_parity: attr, reader: readerDetail };
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
    steps.push({ step: "0 — API health", target: url, verdict: ok ? "passed on staging" : "failed", detail: body?.deployment });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchCssHasParityTokens(web);
    steps.push({
      step: "1 — Deployed CSS contains M5-T30 editorial tokens",
      target: web,
      verdict: r.ok ? "passed on staging" : "failed",
      detail: r,
    });
    if (!r.ok) {
      console.error(JSON.stringify(r, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await fetchJsHasParityMarker(web);
    steps.push({
      step: "2 — Deployed JS contains parity sentinel (HomePage)",
      target: web,
      verdict: r.ok ? "passed on staging" : "failed",
      detail: r,
    });
    if (!r.ok) {
      console.error(JSON.stringify(r, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const r = await playwrightParity(web);
    const verdict = r.blocked ? "blocked on staging" : r.ok ? "passed on staging" : "failed";
    steps.push({ step: "3 — Playwright: editorial rail widths + data attribute", target: `${web}/`, verdict, detail: r });
    if (r.blocked || !r.ok) {
      console.error(JSON.stringify(r, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  steps.push({
    step: "4 — Staging web origin",
    target: "meta",
    verdict: "passed on staging",
    detail: meta,
  });

  printTable(steps);
  console.log("\nM5-T30 staging verify: UI parity bundle + live DOM checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
