#!/usr/bin/env node
/**
 * M5-T29 — Staging: live Railway proof that homepage + reader trust copy honesty strings from the web bundle are deployed,
 * plus API health fingerprint. Uses staging web origin (env or default from scripts/lib/staging-web-origin.mjs).
 *
 * Requires: `pnpm exec playwright install chromium` once per machine.
 *
 * Usage: pnpm verify:staging:canonical-ux-copy-honesty
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

function extractViteMainIndexPaths(html) {
  const paths = new Set();
  const re = /(?:src|href)=["'](\/assets\/index-[^"']+\.js)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) paths.add(m[1]);
  }
  return [...paths];
}

async function fetchBundleHonestyMarkers(webOrigin) {
  const base = webOrigin.replace(/\/$/, "");
  const homeRes = await fetch(`${base}/`);
  const html = await homeRes.text();
  const paths = extractViteMainIndexPaths(html);
  if (paths.length === 0) {
    return { ok: false, reason: "no index.js path in index.html", homeStatus: homeRes.status };
  }
  const markers = {
    discoverHonestyTestId: "homepage-discover-honesty-note",
    discoverHonestyPhrase: "editorial discovery list",
    trustPhrase: "does not independently verify",
  };
  for (const p of paths) {
    const assetUrl = new URL(p, `${base}/`).href;
    const jsRes = await fetch(assetUrl);
    const js = await jsRes.text();
    const hit =
      js.includes(markers.discoverHonestyTestId) &&
      js.includes(markers.discoverHonestyPhrase) &&
      js.includes(markers.trustPhrase);
    if (hit) {
      return {
        ok: true,
        homeStatus: homeRes.status,
        asset_href: assetUrl,
        asset_bytes: js.length,
        markers,
      };
    }
  }
  return { ok: false, reason: "no bundle contained M5-T29 honesty markers", paths_tried: paths.length, homeStatus: homeRes.status };
}

async function playwrightHomeAndReader(webOrigin) {
  let chromiumMod;
  try {
    chromiumMod = await import("playwright");
  } catch (e) {
    return {
      ok: false,
      blocked: true,
      reason: "pnpm exec playwright install chromium",
      error: String(e?.message ?? e),
    };
  }
  const { chromium } = chromiumMod;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const home = `${webOrigin.replace(/\/$/, "")}/`;
    await page.goto(home, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="homepage-discover-honesty-note"]', { state: "visible", timeout: 60_000 });
    const note = await page.locator('[data-testid="homepage-discover-honesty-note"]').innerText();
    const homeOk = note.includes("editorial discovery list") && note.includes("not an endorsement");

    let readerOk = true;
    let readerSkip = "no public slug from discover";
    const discoverRes = await fetch(`${STAGING_API}/api/v1/stories/discover?limit=3`);
    const dj = await discoverRes.json();
    const first = dj?.data?.stories?.[0]?.slug;
    if (typeof first === "string" && first.trim()) {
      const slug = first.trim();
      await page.goto(`${webOrigin.replace(/\/$/, "")}/stories/${encodeURIComponent(slug)}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      const trust = page.locator(".public-trust-explainer");
      await trust.waitFor({ state: "visible", timeout: 60_000 });
      const trustText = await trust.innerText();
      readerOk =
        trustText.includes("does not independently verify") &&
        trustText.includes("creator-attributed");
      readerSkip = slug;
    }

    return { ok: homeOk && readerOk, blocked: false, home_note_snippet: note.slice(0, 220), reader: readerSkip };
  } finally {
    await browser.close();
  }
}

async function main() {
  const { resolveStagingWebOrigin, describeStagingWebOriginResolution } = await import("./lib/staging-web-origin.mjs");
  const webOrigin = resolveStagingWebOrigin();
  const originMeta = describeStagingWebOriginResolution();

  /** @type {{ step: string, target: string, verdict: string, detail?: unknown }[]} */
  const steps = [];

  {
    const url = `${STAGING_API}/api/v1/health`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    const sha = body?.deployment?.git_commit_sha ?? null;
    const ok = res.status === 200 && body?.ok === true && typeof sha === "string" && sha.length >= 7;
    steps.push({
      step: "0 — GET api health (deploy fingerprint)",
      target: url,
      verdict: ok ? "passed on staging" : "failed",
      detail: { git_commit_sha: sha },
    });
    if (!ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const b = await fetchBundleHonestyMarkers(webOrigin);
    steps.push({
      step: "1 — Fetch staging web bundle for M5-T29 copy markers",
      target: webOrigin,
      verdict: b.ok ? "passed on staging" : "failed",
      detail: b,
    });
    if (!b.ok) {
      console.error("\nBundle probe detail:", JSON.stringify(b, null, 2));
      printTable(steps);
      process.exit(1);
    }
  }

  {
    const dom = await playwrightHomeAndReader(webOrigin);
    const verdict =
      dom.blocked === true ? "blocked on staging" : dom.ok ? "passed on staging" : "failed";
    steps.push({
      step: "2 — Playwright: homepage honesty note + reader trust explainer (when a public slug exists)",
      target: `${webOrigin}/`,
      verdict,
      detail: dom,
    });
    if (dom.blocked || !dom.ok) {
      printTable(steps);
      process.exit(1);
    }
  }

  steps.push({
    step: "3 — Staging web origin resolution",
    target: "meta",
    verdict: "passed on staging",
    detail: originMeta,
  });

  printTable(steps);
  console.log("\nM5-T29 staging verify: UX/copy honesty markers present on live staging web + API health OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
