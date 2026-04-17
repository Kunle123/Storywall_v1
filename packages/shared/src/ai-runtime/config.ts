import type { AiProviderKind, AiRuntimeSurface } from "./types";

export type AiRuntimeConfigSnapshot = {
  surface: AiRuntimeSurface;
  enabled: boolean;
  provider: AiProviderKind;
  baseUrl: string | null;
  defaultModel: string | null;
  /** True when a non-empty STORYWALL_AI_API_KEY is present (never log the value). */
  apiKeyPresent: boolean;
  misconfigurationReasons: string[];
};

function normalizeProvider(raw: string | undefined): AiProviderKind {
  const v = (raw ?? "none").trim().toLowerCase();
  if (v === "openai_compatible") return "openai_compatible";
  return "none";
}

/**
 * Parse AI runtime env in a single place for API, worker, and tests.
 * Secrets are never read from files here — only presence checks for validation.
 */
export function parseAiRuntimeConfigFromEnv(env: Record<string, string | undefined>): AiRuntimeConfigSnapshot {
  const enabled = env.STORYWALL_AI_RUNTIME_ENABLED?.trim().toLowerCase() === "true";
  const provider = normalizeProvider(env.STORYWALL_AI_PROVIDER);
  const baseUrl = env.STORYWALL_AI_BASE_URL?.trim() || null;
  const defaultModel = env.STORYWALL_AI_DEFAULT_MODEL?.trim() || null;
  const apiKeyPresent = Boolean(env.STORYWALL_AI_API_KEY?.trim());

  if (!enabled) {
    return {
      surface: "disabled",
      enabled: false,
      provider: "none",
      baseUrl: null,
      defaultModel: null,
      apiKeyPresent,
      misconfigurationReasons: [],
    };
  }

  const reasons: string[] = [];

  if (provider === "none") {
    reasons.push(
      "STORYWALL_AI_RUNTIME_ENABLED=true requires STORYWALL_AI_PROVIDER to be a wired provider (e.g. openai_compatible), not none.",
    );
  }

  if (provider === "openai_compatible") {
    if (!baseUrl) {
      reasons.push("STORYWALL_AI_BASE_URL is required when STORYWALL_AI_PROVIDER=openai_compatible.");
    }
    if (!apiKeyPresent) {
      reasons.push(
        "STORYWALL_AI_API_KEY must be set in the host environment when STORYWALL_AI_PROVIDER=openai_compatible (never commit the secret).",
      );
    }
  }

  if (reasons.length > 0) {
    return {
      surface: "misconfigured",
      enabled: true,
      provider,
      baseUrl,
      defaultModel,
      apiKeyPresent,
      misconfigurationReasons: reasons,
    };
  }

  return {
    surface: "armed",
    enabled: true,
    provider,
    baseUrl,
    defaultModel,
    apiKeyPresent,
    misconfigurationReasons: [],
  };
}

/** Single-line worker/API bootstrap log (no secrets). */
export function formatAiRuntimeBootstrapLogLine(cfg: AiRuntimeConfigSnapshot): string {
  const parts = [
    `[ai-runtime] surface=${cfg.surface}`,
    `provider=${cfg.provider}`,
    cfg.baseUrl ? `base_url_set=true` : `base_url_set=false`,
    `api_key_present=${cfg.apiKeyPresent}`,
    `transport=not_implemented_m5_t01`,
  ];
  if (cfg.misconfigurationReasons.length > 0) {
    parts.push(`issues=${cfg.misconfigurationReasons.length}`);
  }
  return parts.join(" ");
}
