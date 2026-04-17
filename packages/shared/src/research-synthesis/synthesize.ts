import type {
  ResearchSynthesisCluster,
  ResearchSynthesisConfidence,
  ResearchSynthesisFinding,
  ResearchSynthesisPackageV1,
  ResearchSynthesisSourceInput,
} from "./types";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "./types";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function tierToConfidence(tier: string): ResearchSynthesisConfidence {
  if (tier === "high") return "high";
  if (tier === "medium") return "medium";
  return "low";
}

/**
 * Deterministic, non-LLM synthesis: structures retrieval/stub candidates into an inspectable package.
 * Every `sourced_claim` references at least one persisted candidate UUID.
 */
export function synthesizeResearchPackageV1(params: {
  retrievalMode: "stub" | "live";
  retrievalPartial: boolean;
  retrievalPartialNotes?: string;
  storyTitle: string;
  sources: readonly ResearchSynthesisSourceInput[];
}): ResearchSynthesisPackageV1 {
  const sorted = [...params.sources].sort((a, b) => a.positionIndex - b.positionIndex);
  const allIds = sorted.map((s) => s.id);
  const generated_at = new Date().toISOString();

  const findings: ResearchSynthesisFinding[] = [];
  const coverage_notes: string[] = [];
  const open_questions: string[] = [];

  open_questions.push("Which primary sources (non-Wikipedia) will anchor publish-ready claims?");
  open_questions.push("What dates or quantitative claims still need independent corroboration?");

  if (sorted.length === 0) {
    coverage_notes.push("No candidate sources were available to synthesize against.");
    findings.push({
      id: "finding-gap-empty",
      kind: "gap_note",
      text: "No `research_candidate_source` rows were present after persistence; synthesis cannot attach provenance.",
      supporting_research_candidate_source_ids: [],
      confidence: "low",
    });
    return {
      schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
      retrieval_mode: params.retrievalMode,
      retrieval_partial: params.retrievalPartial,
      retrieval_partial_notes: params.retrievalPartialNotes,
      generated_at,
      coverage_notes,
      open_questions,
      findings,
      clusters: [],
    };
  }

  if (params.retrievalMode === "stub") {
    coverage_notes.push(
      "Retrieval mode is stub (`example.invalid` URLs); synthesis is structural only and not grounded in live web evidence.",
    );
  } else {
    coverage_notes.push(
      "Retrieval mode is live (bounded Wikipedia search). Excerpts are search snippets only, not full article review.",
    );
  }

  if (params.retrievalPartial) {
    coverage_notes.push(
      `Retrieval was partial: ${clip(params.retrievalPartialNotes ?? "see risk flags on artifact", 400)}`,
    );
  }

  if (sorted.length === 1) {
    coverage_notes.push("Single-source package: corroboration across independent publishers is still missing.");
  }

  const sourcedIds: string[] = [];

  for (const s of sorted) {
    const excerpt = s.excerpt?.trim();
    const text = excerpt
      ? clip(`From «${s.sourceTitle}»: ${excerpt}`, 900)
      : clip(`Source «${s.sourceTitle}» is indexed (${clip(s.sourceUrl, 120)}); no excerpt text in this package.`, 900);

    const id = `finding-src-${s.positionIndex}`;
    findings.push({
      id,
      kind: "sourced_claim",
      text,
      supporting_research_candidate_source_ids: [s.id],
      confidence: excerpt ? tierToConfidence(s.reliabilityTier) : "low",
    });
    sourcedIds.push(id);
  }

  const titleList = sorted.map((s) => `«${clip(s.sourceTitle, 80)}»`).join("; ");
  findings.push({
    id: "finding-summary-0",
    kind: "synthesis_summary",
    text: clip(
      `Structured overview for “${clip(params.storyTitle, 160)}”: ${sorted.length} candidate row(s) in mode=${params.retrievalMode}. ` +
        `This summary is deterministic (M5-T05) and groups source titles only — it does not invent new facts.`,
      1200,
    ),
    supporting_research_candidate_source_ids: allIds,
    confidence: params.retrievalMode === "live" ? "medium" : "low",
  });

  if (params.retrievalMode === "stub") {
    findings.push({
      id: "finding-gap-stub",
      kind: "gap_note",
      text: "Stub URLs are placeholders; replace with live retrieval-backed candidates before treating this package as web-grounded.",
      supporting_research_candidate_source_ids: allIds,
      confidence: "low",
    });
  }

  if (params.retrievalPartial) {
    findings.push({
      id: "finding-gap-partial-retrieval",
      kind: "gap_note",
      text: clip(`Retrieval returned a partial hit set: ${params.retrievalPartialNotes ?? ""}`, 900),
      supporting_research_candidate_source_ids: allIds,
      confidence: "low",
    });
  }

  const cluster: ResearchSynthesisCluster = {
    id: "cluster-primary-candidates",
    label: "Primary candidate bundle",
    summary: clip(`Sources bundled by job: ${titleList}`, 1500),
    member_finding_ids: sourcedIds,
    supporting_research_candidate_source_ids: allIds,
  };

  return {
    schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
    retrieval_mode: params.retrievalMode,
    retrieval_partial: params.retrievalPartial,
    retrieval_partial_notes: params.retrievalPartialNotes,
    generated_at,
    coverage_notes,
    open_questions,
    findings,
    clusters: [cluster],
  };
}
