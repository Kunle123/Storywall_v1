/**
 * M2-T03 — deterministic chronology extraction from persisted research package (artifact + candidates).
 * M5-T06 — when `research_synthesis_package` (M5-T05) is present, chronology candidates are derived from
 * synthesis findings with provenance to `research_candidate_source` UUIDs; legacy heuristics remain fallback.
 *
 * String literal types mirror Prisma enums — keep in sync with apps/api/prisma/schema.prisma.
 */

import { parseResearchSynthesisPackageV1 } from "./research-synthesis/parse";
import type { ResearchSynthesisFinding, ResearchSynthesisPackageV1 } from "./research-synthesis/types";

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

export const CHRONOLOGY_EXTRACTION_VERSION = "m5-t06-v1" as const;

export type ResearchArtifactExtractionInput = {
  evidencePackageSummary: string;
  candidateEventHints: unknown;
  riskFlags: unknown;
  /** Persisted M5-T05 JSON; parsed when schema matches. */
  researchSynthesisPackage?: unknown;
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
  /** Optional JSON trace for provenance (M5-T06); null in legacy extraction path. */
  creatorNote: string | null;
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

function m5T06CreatorNote(parts: Record<string, string | undefined | null>): string {
  return JSON.stringify({ m5_t06: parts });
}

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

function headlineFromFindingText(text: string): string {
  const t = text.trim();
  if (!t) return "Synthesis finding";
  const firstLine = t.split("\n")[0]?.trim() ?? t;
  const sentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() ?? firstLine;
  return clip(sentence || firstLine, 120);
}

function confidenceFromFindingConfidence(c: ResearchSynthesisFinding["confidence"]): EventConfidenceState {
  if (c === "high") return "mostly_verified";
  return "emerging";
}

function temporalAmbiguityPrefix(): string {
  return (
    "[temporal] No calendar dates were inferred (event_date_precision=unknown). " +
    "Ordering follows the M5-T05 synthesis finding list as a research-order hint only — not verified chronology, causality, or sequence certainty."
  );
}

function buildPreambleRow(
  pkg: ResearchSynthesisPackageV1,
  sources: ResearchCandidateSourceExtractionInput[],
  risk: ReturnType<typeof parseRiskSeverity>,
): ChronologyExtractionRow {
  const lines: string[] = [
    `Chronology stage (M5-T06) consumed research_synthesis_package schema=${pkg.schema_version}, retrieval_mode=${pkg.retrieval_mode}.`,
  ];
  if (pkg.retrieval_mode === "stub") {
    lines.push("Stub retrieval: synthesis and chronology are structural placeholders, not live-web-grounded timelines.");
  }
  if (pkg.retrieval_partial) {
    lines.push(
      `Retrieval was partial${pkg.retrieval_partial_notes ? `: ${clip(pkg.retrieval_partial_notes, 400)}` : "."}`,
    );
  }
  if (pkg.coverage_notes.length > 0) {
    lines.push(`Coverage notes: ${clip(pkg.coverage_notes.join(" | "), 1200)}`);
  }
  if (sources.length === 0) {
    lines.push("Insufficient chronology substrate: no persisted candidate sources on this job.");
  } else if (sources.length === 1) {
    lines.push("Single-source job: corroboration across independent publishers is still missing.");
  }
  if (risk.notes.length > 0) {
    lines.push(`Artifact risk context: ${clip(risk.notes.join(" "), 500)}`);
  }

  const supporting = sources.slice(0, 4).map((s) => s.id);
  const sourceDensity = deriveSourceDensity(supporting);
  const confidenceState = deriveConfidence(supporting, sources);
  const claimRiskLevel =
    pkg.retrieval_mode === "stub" || sources.length === 0 || risk.hasHigh ? "high" : "medium";

  return {
    headline: "Chronology coverage (M5-T06)",
    summary: clip(lines.join("\n\n"), 4000),
    creatorNote: m5T06CreatorNote({
      stage: "package_preamble",
      synthesis_schema: pkg.schema_version,
      retrieval_mode: pkg.retrieval_mode,
    }),
    eventType: "context_note",
    contextLabel: "m5_t06.insufficient_or_package_honesty",
    significanceLevel: "major",
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
    supportingCandidateSourceIds: supporting,
    ambiguityNote:
      claimRiskLevel === "high"
        ? clip(`${temporalAmbiguityPrefix()} Package-level honesty: elevated risk or stub/low-source context.`, 2000)
        : clip(temporalAmbiguityPrefix(), 2000),
  };
}

function isInsufficientCoverageGap(f: ResearchSynthesisFinding): boolean {
  return (
    f.kind === "gap_note" &&
    (f.id.includes("empty") ||
      f.text.includes("No `research_candidate_source`") ||
      f.text.toLowerCase().includes("no candidate sources were available"))
  );
}

function buildRowForSynthesisFinding(
  f: ResearchSynthesisFinding,
  pkg: ResearchSynthesisPackageV1,
  sources: ResearchCandidateSourceExtractionInput[],
  risk: ReturnType<typeof parseRiskSeverity>,
  filteredSupport: string[],
  opts: { isFirstSourcedTurningPoint: boolean },
): ChronologyExtractionRow {
  const headline = headlineFromFindingText(f.text);
  const summary = clip(f.text, 4000);

  let eventType: EventDraftKind;
  let contextLabel: string;
  let significanceLevel: SignificanceLevel;
  let claimRiskLevel: ClaimRiskLevel;

  if (f.kind === "sourced_claim") {
    eventType = opts.isFirstSourcedTurningPoint ? "turning_point" : "standard";
    contextLabel = `m5_t06.candidate.sourced_claim:${f.id}`;
    significanceLevel = "standard";
    if (risk.hasHigh || pkg.retrieval_mode === "stub" || filteredSupport.length === 0) {
      claimRiskLevel = "high";
    } else {
      claimRiskLevel = "medium";
    }
  } else if (f.kind === "synthesis_summary") {
    eventType = "synthesis";
    contextLabel = `m5_t06.non_event.synthesis_summary:${f.id}`;
    significanceLevel = "major";
    claimRiskLevel = pkg.retrieval_mode === "stub" ? "high" : "medium";
  } else {
    eventType = "context_note";
    contextLabel = isInsufficientCoverageGap(f)
      ? `m5_t06.coverage.gap_note:${f.id}`
      : `m5_t06.non_event.gap_note:${f.id}`;
    significanceLevel = "minor";
    claimRiskLevel = pkg.retrieval_mode === "stub" || isInsufficientCoverageGap(f) ? "high" : "medium";
  }

  const sourceDensity = deriveSourceDensity(filteredSupport);
  const confidenceState = confidenceFromFindingConfidence(f.confidence);
  const riskTail =
    risk.notes.length > 0 && (claimRiskLevel === "high" || confidenceState === "emerging")
      ? ` Artifact flags: ${clip(risk.notes.join(" "), 400)}`
      : "";

  let ambiguityNote: string | null;
  if (f.kind === "sourced_claim") {
    const missing =
      filteredSupport.length === 0 && f.supporting_research_candidate_source_ids.length > 0
        ? " Supporting UUIDs on the finding did not match any candidate row on this job (provenance filtered)."
        : filteredSupport.length === 0
          ? " No supporting candidate UUIDs on this finding."
          : "";
    ambiguityNote = clip(`${temporalAmbiguityPrefix()}${missing}${riskTail}`, 2000);
  } else if (f.kind === "synthesis_summary") {
    ambiguityNote = clip(
      `[non-event synthesis] This row reflects a deterministic package summary (M5-T05), not a dated historical event. ${temporalAmbiguityPrefix()}${riskTail}`,
      2000,
    );
  } else {
    const cov = isInsufficientCoverageGap(f)
      ? "[coverage gap] Insufficient research rows for a grounded timeline; treat chronology as sparse."
      : "[non-temporal gap] Synthesis gap note — not an extracted dated event.";
    ambiguityNote = clip(`${cov} ${temporalAmbiguityPrefix()}${riskTail}`, 2000);
  }

  return {
    headline,
    summary,
    creatorNote: m5T06CreatorNote({
      finding_id: f.id,
      finding_kind: f.kind,
      synthesis_schema: pkg.schema_version,
    }),
    eventType,
    contextLabel,
    significanceLevel,
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
    supportingCandidateSourceIds: filteredSupport,
    ambiguityNote,
  };
}

function buildChronologyFromSynthesisPackage(
  artifact: ResearchArtifactExtractionInput,
  pkg: ResearchSynthesisPackageV1,
  sources: ResearchCandidateSourceExtractionInput[],
): ChronologyExtractionRow[] {
  const valid = new Set(sources.map((s) => s.id));
  const risk = parseRiskSeverity(artifact.riskFlags);

  const maxFindings = 15;
  const slice = pkg.findings.slice(0, maxFindings);
  const sourcedClaimIds = slice.filter((f) => f.kind === "sourced_claim").map((f) => f.id);
  const firstSourcedId = sourcedClaimIds[0] ?? null;
  const multiSourced = sourcedClaimIds.length >= 2;

  const rows: ChronologyExtractionRow[] = [buildPreambleRow(pkg, sources, risk)];

  for (const f of slice) {
    const filtered = f.supporting_research_candidate_source_ids.filter((id) => valid.has(id));
    const isFirstSourcedTurningPoint = multiSourced && f.kind === "sourced_claim" && f.id === firstSourcedId;
    rows.push(buildRowForSynthesisFinding(f, pkg, sources, risk, filtered, { isFirstSourcedTurningPoint }));
  }

  if (pkg.findings.length > maxFindings) {
    const omitted = pkg.findings.length - maxFindings;
    rows.push({
      headline: "Additional synthesis findings omitted",
      summary: clip(
        `${omitted} further M5-T05 finding(s) were not promoted to chronology rows to keep extraction bounded. Inspect research_synthesis_package JSON for the full inspectable set.`,
        4000,
      ),
      creatorNote: m5T06CreatorNote({ stage: "omitted_findings", synthesis_schema: pkg.schema_version }),
      eventType: "context_note",
      contextLabel: "m5_t06.bounded_omission",
      significanceLevel: "minor",
      eventDateStart: null,
      eventDateEnd: null,
      eventDatePrecision: "unknown",
      displayDate: null,
      yearAnchor: null,
      intervalNote: null,
      locationName: null,
      mediaKind: "none",
      sourceDensity: deriveSourceDensity(sources.slice(0, 2).map((s) => s.id)),
      confidenceState: "emerging",
      claimRiskLevel: "low",
      supportingCandidateSourceIds: sources.slice(0, 2).map((s) => s.id),
      ambiguityNote: clip(temporalAmbiguityPrefix(), 2000),
    });
  }

  return rows;
}

function buildLegacyChronologyRows(
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

/**
 * Build ordered, timeline-ready chronology rows from research outputs (deterministic).
 * When a valid M5-T05 synthesis package is present, M5-T06 derives candidates from findings + provenance.
 */
export function buildChronologyEventsFromResearchPackage(
  artifact: ResearchArtifactExtractionInput,
  sources: ResearchCandidateSourceExtractionInput[],
): ChronologyExtractionRow[] {
  const pkg = parseResearchSynthesisPackageV1(artifact.researchSynthesisPackage);
  if (pkg !== null) {
    return buildChronologyFromSynthesisPackage(artifact, pkg, sources);
  }
  return buildLegacyChronologyRows(artifact, sources);
}
