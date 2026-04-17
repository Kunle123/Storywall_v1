import type { BoundedRetrievalPolicy } from "./policy-types";

export type { BoundedRetrievalPolicy, LiveBoundedRetrievalPolicy } from "./policy-types";

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * Parse bounded retrieval policy from host env (M5-T04).
 * Default is stub path (`mode=stub`) — no outbound HTTP unless explicitly enabled.
 */
export function parseBoundedRetrievalPolicyFromEnv(
  env: Record<string, string | undefined>,
): BoundedRetrievalPolicy {
  const enabled = env.STORYWALL_RETRIEVAL_ENABLED?.trim().toLowerCase() === "true";
  if (!enabled) {
    return { mode: "stub" };
  }

  const reasons: string[] = [];
  const timeoutMs = clampInt(env.STORYWALL_RETRIEVAL_TIMEOUT_MS, 12_000, 1_000, 60_000);
  const maxCandidates = clampInt(env.STORYWALL_RETRIEVAL_MAX_CANDIDATES, 4, 1, 10);
  const maxResponseBytes = clampInt(env.STORYWALL_RETRIEVAL_MAX_RESPONSE_BYTES, 400_000, 8_000, 2_000_000);
  const maxQueryChars = clampInt(env.STORYWALL_RETRIEVAL_MAX_QUERY_CHARS, 240, 16, 400);

  const hostsRaw = env.STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS?.trim();
  const allowedApiHosts = (hostsRaw
    ? hostsRaw.split(",").map((h) => h.trim().toLowerCase())
    : ["en.wikipedia.org"]
  ).filter(Boolean);

  if (allowedApiHosts.length === 0) {
    reasons.push(
      "STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS must list at least one hostname when retrieval is enabled.",
    );
  }

  const userAgent =
    env.STORYWALL_RETRIEVAL_USER_AGENT?.trim() ||
    "StorywallResearch/1.0 (+https://github.com/Kunle123/Storywall_v1)";

  if (reasons.length > 0) {
    return { mode: "invalid_live", reasons };
  }

  return {
    mode: "live",
    timeoutMs,
    maxCandidates,
    maxResponseBytes,
    maxQueryChars,
    allowedApiHosts,
    userAgent,
  };
}

export function formatBoundedRetrievalBootstrapLine(policy: BoundedRetrievalPolicy): string {
  if (policy.mode === "stub") {
    return `[storywall-retrieval] mode=stub`;
  }
  if (policy.mode === "invalid_live") {
    return `[storywall-retrieval] mode=invalid_live issues=${policy.reasons.length}`;
  }
  return `[storywall-retrieval] mode=live timeout_ms=${policy.timeoutMs} max_candidates=${policy.maxCandidates} max_response_bytes=${policy.maxResponseBytes} hosts=${policy.allowedApiHosts.join("|")}`;
}
