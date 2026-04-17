import type { AiRuntimeSurface } from "./types";

/** When `on`, rate limits apply; when `off`, calls are blocked earlier by surface anyway. */
export type AiPolicyEnforcementMode = "off" | "on";

/**
 * Operational guardrails for future provider HTTP (M5-T02).
 * Values are always defined for health/API parity; enforcement toggles with `surface`.
 */
export type AiRuntimeOperationalPolicy = {
  enforcement: AiPolicyEnforcementMode;
  /** Upper bound for a single provider HTTP round-trip (ms). */
  timeoutMs: number;
  /** Retries after the first attempt (transport ticket); 0 = no retries. */
  maxRetries: number;
  /** Sliding window size (ms), default one minute. */
  windowMs: number;
  /** Max completed provider calls allowed per rolling `windowMs` (per process). */
  maxCallsPerWindow: number;
};

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Derive operational policy from env + runtime surface.
 * Secrets are never parsed here.
 */
export function parseAiRuntimeOperationalPolicy(
  env: Record<string, string | undefined>,
  surface: AiRuntimeSurface,
): AiRuntimeOperationalPolicy {
  const enforcement: AiPolicyEnforcementMode = surface === "armed" ? "on" : "off";

  const timeoutMs = clampInt(env.STORYWALL_AI_HTTP_TIMEOUT_MS, 60_000, 1_000, 300_000);
  const maxRetries = clampInt(env.STORYWALL_AI_MAX_RETRIES, 2, 0, 10);
  const windowMs = clampInt(env.STORYWALL_AI_RATE_LIMIT_WINDOW_MS, 60_000, 10_000, 3_600_000);
  const maxCallsPerWindow = clampInt(env.STORYWALL_AI_MAX_CALLS_PER_WINDOW, 30, 1, 10_000);

  return {
    enforcement,
    timeoutMs,
    maxRetries,
    windowMs,
    maxCallsPerWindow,
  };
}

/**
 * Sliding-window limiter (per process). Used by API and worker independently.
 * Does not persist across restarts (intentional first pass).
 */
export class AiCallRateLimiter {
  private stamps: number[] = [];

  constructor(private readonly policy: AiRuntimeOperationalPolicy) {}

  resetForTests(): void {
    this.stamps = [];
  }

  /**
   * Reserve a slot if policy allows. Does not consume when returning false.
   */
  tryConsume(): { ok: true } | { ok: false; retry_after_ms: number } {
    if (this.policy.enforcement === "off") {
      return { ok: true };
    }
    const now = Date.now();
    const windowStart = now - this.policy.windowMs;
    this.stamps = this.stamps.filter((t) => t > windowStart);
    if (this.stamps.length >= this.policy.maxCallsPerWindow) {
      const oldest = this.stamps[0]!;
      const retryAfter = Math.max(0, oldest + this.policy.windowMs - now);
      return { ok: false, retry_after_ms: retryAfter };
    }
    this.stamps.push(now);
    return { ok: true };
  }
}
