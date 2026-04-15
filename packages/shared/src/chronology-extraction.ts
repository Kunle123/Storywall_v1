/**
 * M2-T03 — deterministic chronology extraction from persisted research package (artifact + candidates).
 * Sources: storywall_editor_cms_input_model.md §12 (event shape), trust posture from storywall_publishing_and_trust_standard.md.
 *
 * String literal types mirror Prisma enums — keep in sync with apps/api/prisma/schema.prisma.
 */

type ReliabilityTier = "high" | "medium" | "low" | "unrated";
type EventDraftKind =
  | "standard"
  | "turning_point"
  | "context_note"
  | "synthesis"
  | "chatter"
  | "corroboration_cluster";
type SignificanceLevel = "minor" | "standard" | "major" | "critical";
type EventDatePrecision =
  | "year"
  | "month"
  | "day"
  | "time"
  | "approximate"
  | "unknown";
type EventMediaKind = "image" | "video" | "document" | "map" | "none";
type EventSourceDensity = "none" | "low" | "medium" | "high";
type EventConfidenceState =
  | "verified"
  | "mostly_verified"
  | "emerging"
  | "disputed"
  | "retracted";
type ClaimRiskLevel = "low" | "medium" | "high";

export const CHRONOLOGY_EXTRACTION_VERSION = "m2-t03-v1" as const;

export type ResearchArtifactExtractionInput = {
  evidencePackageSummary: string;
  candidateEventHints: unknown;
  riskFlags: unknown;
};

export type ResearchCandidateSourceExtractionInput = {
  id: string;
  positionIndex: number;
  sourceTitle: string;
  excerpt: string | null;
  relevanceNote: string;
  reliabilityTier: ReliabilityTier;
};

export type ChronologyExtractionRow = {
  headline: string;
  summary: string;
  creatorNote: null;
  eventType: EventDraftKind;
  contextLabel: string | null;
  significanceLevel: SignificanceLevel;
  eventDateStart: null;
  eventDateEnd: null;
  eventDatePrecision: EventDatePrecision;
  displayDate: null;
  yearAnchor: null;
  intervalNote: null;
  locationName: null;
  mediaKind: EventMediaKind;
  sourceDensity: EventSourceDensity;
  confidenceState: EventConfidenceState;
  claimRiskLevel: ClaimRiskLevel;
  /** UUIDs of `research_candidate_source` rows supporting this event */
  supportingCandidateSourceIds: string[];
  ambiguityNote: string | null;
};

function parseHints(raw: unknown): Array<{ label: string; detail: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ label: string; detail: string }> = [];
  for (const x of raw) {
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const o = x as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : "hint";
      const detail =
        typeof o.detail === "string"
          ? o.detail
          : typeof o.hint === "string"
            ? o.hint
            : "";
      if (detail.trim().length > 0) {
        out.push({ label, detail: detail.trim() });
      }
    }
  }
  return out.slice(0, 8);
}

function parseRiskSeverity(raw: unknown): { hasHigh: boolean; notes: string[] } {
  const notes: string[] = [];
  let hasHigh = false;
  if (!Array.isArray(raw)) return { hasHigh, notes };
  for (const x of raw) {
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const o = x as Record<string, unknown>;
      if (o.severity === "high") hasHigh = true;
      const d = typeof o.detail === "string" ? o.detail : typeof o.message === "string" ? o.message : "";
      if (d) notes.push(d);
    }
  }
  return { hasHigh, notes };
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function fallbackBodiesFromSummary(summary: string): Array<{ headline: string; detail: string }> {
  const t = summary.trim();
  if (!t) {
    return [
      { headline: "Research scope", detail: "Initial chronology placeholder derived from the evidence package." },
      { headline: "Follow-up verification", detail: "Additional dates and claims should be verified against primary sources." },
    ];
  }
  const parts = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return [
      { headline: clip(parts[0].split("\n")[0] ?? "Opening context", 120), detail: parts[0] },
      { headline: clip(parts[1].split("\n")[0] ?? "Further context", 120), detail: parts[1] },
    ];
  }
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  if (sentences.length >= 2) {
    return [
      { headline: clip(sentences[0], 120), detail: sentences[0] },
      { headline: clip(sentences[1], 120), detail: sentences[1] },
    ];
  }
  return [
    { headline: "Evidence package overview", detail: clip(t, 800) },
    { headline: "Verification note", detail: "Timeline dates are not inferred in M2-T03; assign precise dates during editorial review." },
  ];
}

function pickSourcesForEvent(
  eventIndex: number,
  sources: ResearchCandidateSourceExtractionInput[],
): string[] {
  if (sources.length === 0) return [];
  if (sources.length === 1) return [sources[0].id];
  return [sources[eventIndex % sources.length].id, sources[(eventIndex + 1) % sources.length].id];
}

function deriveSourceDensity(ids: string[]): EventSourceDensity {
  if (ids.length === 0) return "none";
  if (ids.length === 1) return "low";
  if (ids.length >= 3) return "high";
  return "medium";
}

function deriveConfidence(
  supportingIds: string[],
  sources: ResearchCandidateSourceExtractionInput[],
): EventConfidenceState {
  if (supportingIds.length === 0) return "emerging";
  const tiers = new Set(
    sources.filter((s) => supportingIds.includes(s.id)).map((s) => s.reliabilityTier),
  );
  if (tiers.has("low") || tiers.has("unrated")) return "emerging";
  if (tiers.has("medium")) return "mostly_verified";
  return "mostly_verified";
}

function deriveClaimRisk(hasHighRisk: boolean, supportingIds: string[]): ClaimRiskLevel {
  if (hasHighRisk) return "high";
  if (supportingIds.length === 0) return "high";
  return "medium";
}

function pickEventKind(count: number, index: number): EventDraftKind {
  if (count >= 3 && index === Math.floor(count / 2)) return "turning_point";
  return "standard";
}

function pickSignificance(count: number, index: number): SignificanceLevel {
  if (count <= 2 && (index === 0 || index === count - 1)) return "major";
  if (index === 0 || index === count - 1) return "major";
  return "standard";
}

/**
 * Build ordered, timeline-ready chronology rows from M2-T02 research outputs (deterministic).
 */
export function buildChronologyEventsFromResearchPackage(
  artifact: ResearchArtifactExtractionInput,
  sources: ResearchCandidateSourceExtractionInput[],
): ChronologyExtractionRow[] {
  const hints = parseHints(artifact.candidateEventHints);
  const risk = parseRiskSeverity(artifact.riskFlags);
  const bodies =
    hints.length > 0
      ? hints.map((h) => ({
          headline: clip(h.detail.split(/[.!?]/)[0]?.trim() || h.label, 120),
          detail: h.detail,
          contextLabel: h.label,
        }))
      : fallbackBodiesFromSummary(artifact.evidencePackageSummary).map((b, i) => ({
          headline: b.headline,
          detail: b.detail,
          contextLabel: i === 0 ? "Overview" : "Context",
        }));

  const n = bodies.length;
  return bodies.map((b, index) => {
    const supportingCandidateSourceIds = pickSourcesForEvent(index, sources);
    const sourceDensity = deriveSourceDensity(supportingCandidateSourceIds);
    const confidenceState = deriveConfidence(supportingCandidateSourceIds, sources);
    const claimRiskLevel = deriveClaimRisk(risk.hasHigh, supportingCandidateSourceIds);
    const ambiguityNote =
      risk.notes.length > 0 && (claimRiskLevel === "high" || confidenceState === "emerging")
        ? clip(risk.notes.join(" "), 500)
        : supportingCandidateSourceIds.length === 0
          ? "No candidate sources were attached to this event; corroboration is required before publication."
          : null;

    return {
      headline: b.headline || `Event ${index + 1}`,
      summary: clip(b.detail, 4000),
      creatorNote: null,
      eventType: pickEventKind(n, index),
      contextLabel: b.contextLabel ?? null,
      significanceLevel: pickSignificance(n, index),
      eventDateStart: null,
      eventDateEnd: null,
      eventDatePrecision: "unknown",
      displayDate: null,
      yearAnchor: null,
      intervalNote: null,
      locationName: null,
      mediaKind: "none",
      sourceDensity,
      confidenceState,
      claimRiskLevel,
      supportingCandidateSourceIds,
      ambiguityNote,
    };
  });
}
