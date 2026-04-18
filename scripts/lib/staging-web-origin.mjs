/**
 * M5-T29 — canonical staging web origin for verification scripts.
 * Must stay aligned with `STAGING_FRONTEND_ORIGIN` in `apps/api/src/main.ts` (CORS allowlist).
 */
export const STAGING_WEB_ORIGIN_DEFAULT = "https://frontend-staging-423b.up.railway.app";

/**
 * @returns {string} Normalized origin (no trailing slash).
 */
export function resolveStagingWebOrigin() {
  const raw =
    process.env.STORYWALL_STAGING_WEB_ORIGIN?.trim() ||
    process.env.STORYWALL_STAGING_FRONTEND_ORIGIN?.trim() ||
    STAGING_WEB_ORIGIN_DEFAULT;
  return String(raw).replace(/\/$/, "");
}

/** @returns {{ explicit: boolean, env_key: string | null, origin: string }} */
export function describeStagingWebOriginResolution() {
  if (process.env.STORYWALL_STAGING_WEB_ORIGIN?.trim()) {
    return { explicit: true, env_key: "STORYWALL_STAGING_WEB_ORIGIN", origin: resolveStagingWebOrigin() };
  }
  if (process.env.STORYWALL_STAGING_FRONTEND_ORIGIN?.trim()) {
    return { explicit: true, env_key: "STORYWALL_STAGING_FRONTEND_ORIGIN", origin: resolveStagingWebOrigin() };
  }
  return { explicit: false, env_key: null, origin: resolveStagingWebOrigin() };
}
