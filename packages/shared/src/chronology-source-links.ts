/**
 * M2-T04 — evidentiary links between chronology extracted events and research candidate sources.
 * Relationship semantics align with storywall_publishing_and_trust_standard.md §5.3 (meaningful evidence paths).
 */

export type ChronologySourceRelationKind =
  | "documents"
  | "corroborates"
  | "contextualizes"
  | "incidental"
  | "disputes";

export type ResearchCandidateSourceLinkInput = {
  id: string;
  reliabilityTier: "high" | "medium" | "low" | "unrated";
  relevanceNote: string;
};

/**
 * Deterministic rows for `chronology_event_source_link` from an event's supporting candidate IDs.
 * - First strong source → documents (primary path); weak/unrated → contextualizes with lower sufficiency weight.
 * - Additional sources → corroborates where independent; incidental when duplicate or weak-only paths.
 */
export function buildChronologyEventSourceLinkRows(params: {
  chronologyExtractedEventId: string;
  storyId: string;
  researchJobId: string;
  candidateSourceIds: string[];
  sourceById: Map<string, ResearchCandidateSourceLinkInput>;
}): Array<{
  chronologyExtractedEventId: string;
  researchCandidateSourceId: string;
  storyId: string;
  researchJobId: string;
  relationKind: ChronologySourceRelationKind;
  countsTowardSufficiency: boolean;
  orderingIndex: number;
  rationaleNote: string;
}> {
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const id of params.candidateSourceIds) {
    if (typeof id !== "string" || !params.sourceById.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  const out: Array<{
    chronologyExtractedEventId: string;
    researchCandidateSourceId: string;
    storyId: string;
    researchJobId: string;
    relationKind: ChronologySourceRelationKind;
    countsTowardSufficiency: boolean;
    orderingIndex: number;
    rationaleNote: string;
  }> = [];

  orderedIds.forEach((sourceId, orderingIndex) => {
    const src = params.sourceById.get(sourceId);
    if (!src) return;

    const tier = src.reliabilityTier;
    const strong = tier === "high" || tier === "medium";
    const weak = tier === "low" || tier === "unrated";

    let relationKind: ChronologySourceRelationKind;
    let countsTowardSufficiency: boolean;
    let rationaleNote: string;

    if (orderingIndex === 0) {
      if (strong) {
        relationKind = "documents";
        countsTowardSufficiency = true;
        rationaleNote =
          "Primary evidence path: source tier supports treating this as documentation of the event (trust standard §5.3).";
      } else if (tier === "low") {
        relationKind = "contextualizes";
        countsTowardSufficiency = true;
        rationaleNote =
          "Contextual support: lower-tier source still material to interpretation; verify before publication (trust standard §5.3).";
      } else {
        relationKind = "corroborates";
        countsTowardSufficiency = false;
        rationaleNote =
          "Weak corroboration only until reliability is reviewed; does not alone satisfy sufficiency (trust standard §5.3).";
      }
    } else if (orderingIndex === 1) {
      relationKind = "corroborates";
      countsTowardSufficiency = strong;
      rationaleNote = strong
        ? "Independent corroboration from a second reference."
        : "Secondary reference with limited weight until verified.";
    } else {
      relationKind = weak ? "incidental" : "corroborates";
      countsTowardSufficiency = strong && !weak;
      rationaleNote = weak
        ? "Additional reference flagged as incidental for this claim until relevance is confirmed."
        : "Additional corroborating reference.";
    }

    if (detectDisputeSignal(src.relevanceNote)) {
      relationKind = "disputes";
      countsTowardSufficiency = false;
      rationaleNote =
        "Potential dispute or contradiction signal in relevance text; requires editorial review (trust standard §5.3).";
    }

    out.push({
      chronologyExtractedEventId: params.chronologyExtractedEventId,
      researchCandidateSourceId: sourceId,
      storyId: params.storyId,
      researchJobId: params.researchJobId,
      relationKind,
      countsTowardSufficiency,
      orderingIndex,
      rationaleNote,
    });
  });

  return out;
}

function detectDisputeSignal(note: string): boolean {
  const t = note.toLowerCase();
  return (
    /\bdisput(e|ed|es)\b/.test(t) ||
    /\bcontradict/.test(t) ||
    /\bden(y|ies|ied)\b/.test(t) ||
    /\bcontested\b/.test(t)
  );
}
