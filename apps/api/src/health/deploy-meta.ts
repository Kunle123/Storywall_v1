/**
 * Optional deploy fingerprint for health endpoints (Railway / Vercel / GitHub Actions).
 * No secrets — commit SHA only when the platform injects it.
 */
export function deployMetaForHealth(): { git_commit_sha: string | null } {
  return {
    git_commit_sha:
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      null,
  };
}
