/**
 * M5-T13 — user-facing lines that match backend capability (deterministic vs live vs fallback vs advisory).
 * Keep strings factual; avoid implying publishability or full AI authorship where the API does not support it.
 */

export type FramingGenerationPackageLike = {
  schema_version?: string;
  generation_mode?: string;
  status?: string;
  failure?: { code?: string; message?: string } | null;
};

export function framingCapabilitySummary(pkg: unknown): { title: string; body: string } | null {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return null;
  const p = pkg as FramingGenerationPackageLike;
  if (p.schema_version !== "m5-t10-v1") return null;

  const live = p.generation_mode === "live_ai_backed";
  const ok = p.status === "succeeded";
  const fallback = p.generation_mode === "deterministic_scaffolding_fallback" || p.status === "fallback_deterministic";

  if (live && ok) {
    return {
      title: "Framing batch: live model-assisted",
      body: "These candidates were produced through the configured AI runtime (OpenAI-compatible). They are still creator-selectable angles — not publish-ready copy or fully source-verified.",
    };
  }
  if (fallback) {
    return {
      title: "Framing batch: deterministic scaffolding",
      body: "Storywall used built-in framing templates because the live model path did not complete or the AI runtime is unavailable. Treat as starting points, not authoritative narrative.",
    };
  }
  return {
    title: "Framing batch: mixed or incomplete",
    body: "Check the framing audit package on the server if you need details; do not assume live model authorship.",
  };
}

export type EditorialReviewPackageLike = {
  schema_version?: string;
  review_mode?: string;
  status?: string;
  failure?: { code?: string; message?: string } | null;
};

export function editorialReviewCapabilitySummary(pkg: unknown): { modeLabel: string; statusLabel: string; fallbackNote: string | null } {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    return { modeLabel: "—", statusLabel: "—", fallbackNote: null };
  }
  const p = pkg as EditorialReviewPackageLike;
  if (p.schema_version !== "m5-t12-v1") {
    return { modeLabel: "—", statusLabel: "—", fallbackNote: null };
  }

  const modeLabel =
    p.review_mode === "live_ai_backed"
      ? "Live model-assisted review"
      : p.review_mode === "deterministic_honesty_fallback"
        ? "Honesty-based fallback (no live critique)"
        : String(p.review_mode ?? "unknown");

  const statusLabel =
    p.status === "succeeded"
      ? "Completed"
      : p.status === "fallback_deterministic"
        ? "Completed with fallback"
        : String(p.status ?? "unknown");

  const fallbackNote = p.failure
    ? `Details: ${p.failure.code ?? "unknown"} — ${String(p.failure.message ?? "").slice(0, 280)}${String(p.failure.message ?? "").length > 280 ? "…" : ""}`
    : null;

  return { modeLabel, statusLabel, fallbackNote };
}

/** What a finished Bull job produced — distinct from “AI wrote my story.” */
export function researchJobOutputExplainer(kind: "research_run" | "draft_assemble"): string {
  if (kind === "research_run") {
    return "This job writes the research package: optional bounded retrieval, then deterministic synthesis, chronology, and draft enrichment (rules + honesty signals) — not a single end-to-end live “story writer.”";
  }
  return "This job assembles a starter draft structure from chronology and framing — structural scaffolding for you to edit, not a finished published article.";
}
