/**
 * M5-T08 — flat creator-audit index derived from `DraftEnrichmentPackageV1` (no deep client parsing required).
 */

import type { DraftEnrichmentPackageV1 } from "./types";

export const DRAFT_ENRICHMENT_PROVENANCE_INDEX_VERSION = "m5-t08-trace-v1" as const;

export type DraftEnrichmentProvenanceIndexNode = {
  node_kind: "summary_spine" | "major_arc" | "suggested_section" | "key_event" | "coverage_gap" | "ambiguity_note";
  node_id: string;
  support_status: string;
  provenance: {
    synthesis_finding_ids: readonly string[];
    chronology_event_ids: readonly string[];
    research_candidate_source_ids: readonly string[];
  };
  title_or_headline: string | null;
  text_clip: string;
  weak_support_explanation: string | null;
};

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Returns null for legacy packages (e.g. `m5-t07-v1`) so clients can branch safely.
 */
export function buildDraftEnrichmentProvenanceIndex(raw: unknown): {
  schema_version: typeof DRAFT_ENRICHMENT_PROVENANCE_INDEX_VERSION;
  story_id: string;
  research_job_id: string;
  nodes: DraftEnrichmentProvenanceIndexNode[];
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Partial<DraftEnrichmentPackageV1>;
  if (p.schema_version !== "m5-t08-v1" || !p.story_id || !p.research_job_id) return null;

  const pkg = raw as DraftEnrichmentPackageV1;
  const nodes: DraftEnrichmentProvenanceIndexNode[] = [];

  nodes.push({
    node_kind: "summary_spine",
    node_id: pkg.summary_spine_node.id,
    support_status: pkg.summary_spine_node.support_status,
    provenance: { ...pkg.summary_spine_node.provenance },
    title_or_headline: "Summary spine",
    text_clip: clip(pkg.summary_spine_node.text, 400),
    weak_support_explanation: pkg.summary_spine_node.weak_support_explanation,
  });

  for (const a of pkg.major_arcs) {
    nodes.push({
      node_kind: "major_arc",
      node_id: a.id,
      support_status: a.support_status,
      provenance: { ...a.provenance },
      title_or_headline: a.label,
      text_clip: clip(a.summary, 320),
      weak_support_explanation: a.weak_support_explanation,
    });
  }
  for (const s of pkg.suggested_sections) {
    nodes.push({
      node_kind: "suggested_section",
      node_id: s.id,
      support_status: s.support_status,
      provenance: { ...s.provenance },
      title_or_headline: s.title,
      text_clip: clip(s.rationale, 320),
      weak_support_explanation: s.weak_support_explanation,
    });
  }
  for (const k of pkg.key_events) {
    nodes.push({
      node_kind: "key_event",
      node_id: k.chronology_event_id,
      support_status: k.support_status,
      provenance: { ...k.provenance },
      title_or_headline: k.headline,
      text_clip: clip(k.summary_clip, 320),
      weak_support_explanation: k.weak_support_explanation,
    });
  }
  for (const g of pkg.coverage_gaps) {
    nodes.push({
      node_kind: "coverage_gap",
      node_id: g.id,
      support_status: g.support_status,
      provenance: { ...g.provenance },
      title_or_headline: null,
      text_clip: clip(g.text, 320),
      weak_support_explanation: g.weak_support_explanation,
    });
  }
  for (const n of pkg.ambiguity_notes) {
    nodes.push({
      node_kind: "ambiguity_note",
      node_id: n.id,
      support_status: n.support_status,
      provenance: { ...n.provenance },
      title_or_headline: null,
      text_clip: clip(n.text, 320),
      weak_support_explanation: n.weak_support_explanation,
    });
  }

  return {
    schema_version: DRAFT_ENRICHMENT_PROVENANCE_INDEX_VERSION,
    story_id: pkg.story_id,
    research_job_id: pkg.research_job_id,
    nodes,
  };
}
