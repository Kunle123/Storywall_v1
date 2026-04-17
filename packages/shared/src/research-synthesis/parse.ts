import type {
  ResearchSynthesisCluster,
  ResearchSynthesisFinding,
  ResearchSynthesisPackageV1,
} from "./types";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "./types";

function parseFinding(raw: unknown): ResearchSynthesisFinding | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.trim().length === 0) return null;
  if (o.kind !== "sourced_claim" && o.kind !== "synthesis_summary" && o.kind !== "gap_note") return null;
  if (typeof o.text !== "string") return null;
  if (!Array.isArray(o.supporting_research_candidate_source_ids)) return null;
  const ids: string[] = [];
  for (const x of o.supporting_research_candidate_source_ids) {
    if (typeof x !== "string" || x.trim().length === 0) return null;
    ids.push(x);
  }
  if (o.confidence !== "low" && o.confidence !== "medium" && o.confidence !== "high") return null;
  return {
    id: o.id,
    kind: o.kind,
    text: o.text,
    supporting_research_candidate_source_ids: ids,
    confidence: o.confidence,
  };
}

function parseCluster(raw: unknown): ResearchSynthesisCluster | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (typeof o.label !== "string") return null;
  if (typeof o.summary !== "string") return null;
  if (!Array.isArray(o.member_finding_ids)) return null;
  if (!Array.isArray(o.supporting_research_candidate_source_ids)) return null;
  const member: string[] = [];
  for (const x of o.member_finding_ids) {
    if (typeof x !== "string") return null;
    member.push(x);
  }
  const sup: string[] = [];
  for (const x of o.supporting_research_candidate_source_ids) {
    if (typeof x !== "string") return null;
    sup.push(x);
  }
  return {
    id: o.id,
    label: o.label,
    summary: o.summary,
    member_finding_ids: member,
    supporting_research_candidate_source_ids: sup,
  };
}

function parseStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") return null;
    out.push(x);
  }
  return out;
}

/**
 * Parse persisted JSON into `ResearchSynthesisPackageV1`, or `null` when absent/invalid/legacy schema.
 * Browser-safe; deterministic validation only.
 */
export function parseResearchSynthesisPackageV1(raw: unknown): ResearchSynthesisPackageV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema_version !== RESEARCH_SYNTHESIS_SCHEMA_VERSION) return null;
  if (o.retrieval_mode !== "stub" && o.retrieval_mode !== "live") return null;
  if (typeof o.retrieval_partial !== "boolean") return null;
  if (typeof o.generated_at !== "string" || o.generated_at.trim().length === 0) return null;

  const coverage_notes = parseStringArray(o.coverage_notes);
  const open_questions = parseStringArray(o.open_questions);
  if (!coverage_notes || !open_questions) return null;
  if (!Array.isArray(o.findings) || !Array.isArray(o.clusters)) return null;

  const findings: ResearchSynthesisFinding[] = [];
  for (const f of o.findings) {
    const parsed = parseFinding(f);
    if (!parsed) return null;
    findings.push(parsed);
  }

  const clusters: ResearchSynthesisCluster[] = [];
  for (const c of o.clusters) {
    const parsed = parseCluster(c);
    if (!parsed) return null;
    clusters.push(parsed);
  }

  const partialNotes =
    typeof o.retrieval_partial_notes === "string" && o.retrieval_partial_notes.trim().length > 0
      ? o.retrieval_partial_notes
      : undefined;

  return {
    schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
    retrieval_mode: o.retrieval_mode,
    retrieval_partial: o.retrieval_partial,
    retrieval_partial_notes: partialNotes,
    generated_at: o.generated_at,
    coverage_notes,
    open_questions,
    findings,
    clusters,
  };
}
