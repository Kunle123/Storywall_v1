#!/usr/bin/env node
/**
 * Browser-parity CORS check: the web app sends `Idempotency-Key` on POST …/frames/generate.
 * Node-based staging verifiers do not enforce CORS; the browser does — this script catches
 * missing `Access-Control-Allow-Headers` entries that block the creator brief page.
 *
 * Usage: pnpm verify:staging:cors-idempotency-header
 *
 * Env: STAGING_API_BASE (optional, default Railway staging API).
 */

const STAGING_API_BASE = (
  process.env.STAGING_API_BASE ?? "https://api-staging-1de1.up.railway.app"
).replace(/\/$/, "");

const WEB_ORIGIN =
  process.env.STAGING_WEB_ORIGIN ?? "https://frontend-staging-423b.up.railway.app";

async function main() {
  const url = `${STAGING_API_BASE}/api/v1/creator/stories/00000000-0000-0000-0000-000000000001/frames/generate`;
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: WEB_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type, authorization, idempotency-key",
    },
  });

  const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
  const normalized = allowHeaders.toLowerCase();
  const hasIdem = normalized.includes("idempotency-key");

  console.log("OPTIONS", url);
  console.log("access-control-allow-headers:", allowHeaders || "(empty)");
  console.log("Verdict:", hasIdem ? "PASS — Idempotency-Key allowed for browser CORS" : "FAIL — add Idempotency-Key to API CORS allowedHeaders");

  process.exit(hasIdem ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
