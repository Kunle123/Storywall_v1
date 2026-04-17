import { describe, expect, it } from "vitest";
import { AiCallRateLimiter, parseAiRuntimeOperationalPolicy } from "./policy";

describe("parseAiRuntimeOperationalPolicy", () => {
  it("turns enforcement off when surface is disabled", () => {
    const p = parseAiRuntimeOperationalPolicy({}, "disabled");
    expect(p.enforcement).toBe("off");
  });

  it("turns enforcement on when surface is armed", () => {
    const p = parseAiRuntimeOperationalPolicy({}, "armed");
    expect(p.enforcement).toBe("on");
  });

  it("clamps timeout and retries", () => {
    const p = parseAiRuntimeOperationalPolicy(
      {
        STORYWALL_AI_HTTP_TIMEOUT_MS: "50",
        STORYWALL_AI_MAX_RETRIES: "99",
      },
      "armed",
    );
    expect(p.timeoutMs).toBe(1000);
    expect(p.maxRetries).toBe(10);
  });
});

describe("AiCallRateLimiter", () => {
  it("always allows when enforcement is off", () => {
    const p = parseAiRuntimeOperationalPolicy({}, "disabled");
    const lim = new AiCallRateLimiter(p);
    for (let i = 0; i < 5; i++) {
      expect(lim.tryConsume().ok).toBe(true);
    }
  });

  it("blocks after max calls in window", () => {
    const p = parseAiRuntimeOperationalPolicy(
      {
        STORYWALL_AI_MAX_CALLS_PER_WINDOW: "2",
        STORYWALL_AI_RATE_LIMIT_WINDOW_MS: "60000",
      },
      "armed",
    );
    const lim = new AiCallRateLimiter(p);
    expect(lim.tryConsume().ok).toBe(true);
    expect(lim.tryConsume().ok).toBe(true);
    const third = lim.tryConsume();
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.retry_after_ms).toBeGreaterThanOrEqual(0);
    }
  });
});
