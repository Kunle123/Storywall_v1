/**
 * M5-T07 — deterministic draft enrichment from M5-T05 synthesis + M5-T06 chronology rows.
 * M5-T08 — provenance + support_status on every enrichment node (deterministic; no LLM).
 */

import { parseResearchSynthesisPackageV1 } from "../research-synthesis/parse";
import type { ResearchSynthesisPackageV1 } from "../research-synthesis/types";
import type {
  ChronologyEventEnrichmentInput,
  DraftEnrichmentAmbiguityNode,
  DraftEnrichmentCoverageGapNode,
  DraftEnrichmentKeyEvent,
  DraftEnrichmentMajorArc,
  DraftEnrichmentPackageV1,
  DraftEnrichmentSuggestedSection,
  DraftEnrichmentSummarySpineNode,
  EnrichmentNodeProvenance,
  ProvenanceSupportStatus,
} from "./types";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "./types";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function uniqueStrings(items: readonly string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function emptyProvenance(): EnrichmentNodeProvenance {
  return { synthesis_finding_ids: [], chronology_event_ids: [], research_candidate_source_ids: [] };
}

function mergeProv(...parts: EnrichmentNodeProvenance[]): EnrichmentNodeProvenance {
  const f = new Set<string>();
  const c = new Set<string>();
  const s = new Set<string>();
  for (const p of parts) {
    p.synthesis_finding_ids.forEach((x) => f.add(x));
    p.chronology_event_ids.forEach((x) => c.add(x));
    p.research_candidate_source_ids.forEach((x) => s.add(x));
  }
  return {
    synthesis_finding_ids: [...f],
    chronology_event_ids: [...c],
    research_candidate_source_ids: [...s],
  };
}

/** Parse `creator_note` JSON from M5-T06 chronology rows for `finding_id` linkage */
export function linkedFindingIdsFromCreatorNote(creatorNote: string | null): string[] {
  if (!creatorNote) return [];
  try {
    const o = JSON.parse(creatorNote) as { m5_t06?: { finding_id?: string | null } };
    const id = o?.m5_t06?.finding_id;
    if (typeof id === "string" && id.trim().length > 0) return [id.trim()];
  } catch {
    /* ignore */
  }
  return [];
}

function chronologyIdsForFindingIds(
  findingIds: readonly string[],
  events: readonly ChronologyEventEnrichmentInput[],
): string[] {
  const out = new Set<string>();
  for (const e of events) {
    const linked = linkedFindingIdsFromCreatorNote(e.creatorNote);
    if (linked.some((id) => findingIds.includes(id))) out.add(e.id);
  }
  return [...out];
}

function chronologyIdsAtPositions(
  positions: readonly number[],
  events: readonly ChronologyEventEnrichmentInput[],
): string[] {
  const out = new Set<string>();
  for (const p of positions) {
    const e = events.find((x) => x.positionIndex === p);
    if (e) out.add(e.id);
  }
  return [...out];
}

function sourcesAtPositions(
  positions: readonly number[],
  events: readonly ChronologyEventEnrichmentInput[],
): string[] {
  const acc: string[] = [];
  for (const p of positions) {
    const e = events.find((x) => x.positionIndex === p);
    if (e) acc.push(...e.supportingCandidateSourceIds);
  }
  return uniqueStrings(acc, 64);
}

function keyEventSupportStatus(ev: {
  supporting_research_candidate_source_ids: readonly string[];
  linked_synthesis_finding_ids: readonly string[];
}): { support_status: ProvenanceSupportStatus; weak: string | null } {
  const sup = ev.supporting_research_candidate_source_ids.length;
  const syn = ev.linked_synthesis_finding_ids.length;
  if (sup >= 2 && syn >= 1) return { support_status: "fully_source_backed", weak: null };
  if ((sup >= 1 && syn >= 1) || sup >= 2)
    return {
      support_status: "partially_source_backed",
      weak: sup < 2 ? "Fewer than two independent candidate sources attached to this chronology row." : null,
    };
  if (sup >= 1)
    return {
      support_status: "chronology_thin_sources",
      weak: "Chronology candidate without linked synthesis finding id (or single-source only).",
    };
  return {
    support_status: "unresolved_weak",
    weak: "No supporting research_candidate_source UUIDs on this chronology row.",
  };
}

function arcSupportStatus(
  arc: Pick<DraftEnrichmentMajorArc, "origin" | "member_finding_ids" | "supporting_research_candidate_source_ids">,
  pkg: ResearchSynthesisPackageV1 | null,
): { support_status: ProvenanceSupportStatus; weak: string | null } {
  if (arc.origin === "chronology_only") {
    return {
      support_status: "chronology_thin_sources",
      weak: "No M5-T05 synthesis package; arc is inferred from legacy chronology/evidence heuristics only.",
    };
  }
  const srcN = arc.supporting_research_candidate_source_ids.length;
  if (!pkg) {
    return { support_status: "unresolved_weak", weak: "Synthesis package missing for arc audit." };
  }
  const memberFindings = pkg.findings.filter((f) => arc.member_finding_ids.includes(f.id));
  const allMembersHaveSources =
    memberFindings.length > 0 &&
    memberFindings.every((f) => f.supporting_research_candidate_source_ids.length > 0);
  if (srcN >= 2 && allMembersHaveSources) return { support_status: "fully_source_backed", weak: null };
  if (srcN >= 1 && memberFindings.length > 0)
    return {
      support_status: "partially_source_backed",
      weak: srcN < 2 ? "Arc has limited multi-publisher breadth on supporting_candidate_source rows." : null,
    };
  if (srcN >= 1) return { support_status: "partially_source_backed", weak: "Some synthesis members lack per-finding source UUIDs." };
  return { support_status: "unresolved_weak", weak: "Arc lacks supporting candidate source UUIDs in synthesis cluster." };
}

function sectionSupportStatus(
  sec: Pick<
    DraftEnrichmentSuggestedSection,
    "linked_synthesis_finding_ids" | "linked_chronology_position_indexes"
  >,
): { support_status: ProvenanceSupportStatus; weak: string | null } {
  const sf = sec.linked_synthesis_finding_ids.length;
  const ci = sec.linked_chronology_position_indexes.length;
  if (sf >= 1 && ci >= 1) return { support_status: "partially_source_backed", weak: null };
  if (sf >= 1) return { support_status: "partially_source_backed", weak: "Section grounded in synthesis only (no linked chronology positions resolved)." };
  if (ci >= 1)
    return {
      support_status: "chronology_thin_sources",
      weak: "Section ordering references chronology rows without synthesis finding linkage.",
    };
  return { support_status: "unresolved_weak", weak: "Sparse linkage between synthesis and chronology for this section." };
}

function isPreambleRow(e: ChronologyEventEnrichmentInput): boolean {
  return e.contextLabel === "m5_t06.insufficient_or_package_honesty";
}

function isOmissionRow(e: ChronologyEventEnrichmentInput): boolean {
  return Boolean(e.contextLabel?.includes("bounded_omission"));
}

function majorArcsFromSynthesis(
  pkg: ResearchSynthesisPackageV1 | null,
  storyTitle: string,
  events: readonly ChronologyEventEnrichmentInput[],
): DraftEnrichmentMajorArc[] {
  const base = (() => {
    if (!pkg) {
      return [
        {
          id: "arc-chronology-only",
          label: "Chronology-derived spine",
          summary: clip(
            `No M5-T05 synthesis package was available; arcs are inferred only from chronology and evidence summary for “${clip(storyTitle, 120)}”.`,
            900,
          ),
          member_finding_ids: [] as string[],
          supporting_research_candidate_source_ids: [] as string[],
          origin: "chronology_only" as const,
        },
      ];
    }
    if (pkg.clusters.length > 0) {
      return pkg.clusters.map((c) => ({
        id: c.id,
        label: c.label,
        summary: clip(c.summary, 1500),
        member_finding_ids: [...c.member_finding_ids],
        supporting_research_candidate_source_ids: [...c.supporting_research_candidate_source_ids],
        origin: "synthesis_cluster" as const,
      }));
    }
    const sourced = pkg.findings.filter((f) => f.kind === "sourced_claim").map((f) => f.id);
    const allSourceIds = uniqueStrings(
      pkg.findings.flatMap((f) => [...f.supporting_research_candidate_source_ids]),
      64,
    );
    return [
      {
        id: "arc-sourced-bundle",
        label: "Sourced excerpt spine",
        summary: clip(
          `${sourced.length} sourced synthesis finding(s) bundle candidate claims for “${clip(storyTitle, 120)}”.`,
          900,
        ),
        member_finding_ids: sourced,
        supporting_research_candidate_source_ids: allSourceIds,
        origin: "synthesis_sourced_bundle" as const,
      },
    ];
  })();

  return base.map((a) => {
    const synIds = [...a.member_finding_ids];
    const chIds = chronologyIdsForFindingIds(synIds, events);
    const prov: EnrichmentNodeProvenance = {
      synthesis_finding_ids: synIds,
      chronology_event_ids: chIds,
      research_candidate_source_ids: [...a.supporting_research_candidate_source_ids],
    };
    const { support_status, weak } = arcSupportStatus(a, pkg);
    return { ...a, provenance: prov, support_status, weak_support_explanation: weak };
  });
}

function suggestedSectionsFromSynthesis(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): DraftEnrichmentSuggestedSection[] {
  const sections: DraftEnrichmentSuggestedSection[] = [];
  let secIdx = 0;
  if (pkg) {
    for (const f of pkg.findings) {
      if (f.kind === "synthesis_summary") {
        const positions = events
          .filter((e) => linkedFindingIdsFromCreatorNote(e.creatorNote).includes(f.id))
          .map((e) => e.positionIndex);
        const prov = mergeProv(
          {
            synthesis_finding_ids: [f.id],
            chronology_event_ids: chronologyIdsAtPositions(positions, events),
            research_candidate_source_ids: sourcesAtPositions(positions, events),
          },
          {
            synthesis_finding_ids: [],
            chronology_event_ids: [],
            research_candidate_source_ids: [...f.supporting_research_candidate_source_ids],
          },
        );
        const row: Omit<DraftEnrichmentSuggestedSection, "support_status" | "weak_support_explanation"> = {
          id: `sec:synthesis:${f.id}`,
          title: "Structured overview (synthesis)",
          rationale: clip(
            `Editorial overview from M5-T05 synthesis_summary ${f.id} (excerpt from finding text): ${clip(f.text, 280)}`,
            520,
          ),
          linked_synthesis_finding_ids: [f.id],
          linked_chronology_position_indexes: positions,
          provenance: prov,
        };
        const st = sectionSupportStatus(row);
        sections.push({ ...row, support_status: st.support_status, weak_support_explanation: st.weak });
      }
    }
    const gapFindings = pkg.findings.filter((g) => g.kind === "gap_note").map((g) => g.id);
    if (gapFindings.length > 0) {
      const positions = events
        .filter((e) => e.contextLabel?.includes("gap_note") || e.contextLabel?.includes("coverage"))
        .map((e) => e.positionIndex);
      const prov = mergeProv(
        {
          synthesis_finding_ids: gapFindings,
          chronology_event_ids: chronologyIdsAtPositions(positions, events),
          research_candidate_source_ids: sourcesAtPositions(positions, events),
        },
        {
          synthesis_finding_ids: [],
          chronology_event_ids: [],
          research_candidate_source_ids: uniqueStrings(
            gapFindings.flatMap((gid) => {
              const gf = pkg.findings.find((x) => x.id === gid);
              return gf ? [...gf.supporting_research_candidate_source_ids] : [];
            }),
            32,
          ),
        },
      );
      const row: Omit<DraftEnrichmentSuggestedSection, "support_status" | "weak_support_explanation"> = {
        id: `sec:gaps:${secIdx++}`,
        title: "Coverage, gaps, and follow-up research",
        rationale: "Derived from synthesis gap_note findings and package coverage notes.",
        linked_synthesis_finding_ids: gapFindings,
        linked_chronology_position_indexes: positions,
        provenance: prov,
      };
      const st = sectionSupportStatus(row);
      sections.push({ ...row, support_status: st.support_status, weak_support_explanation: st.weak });
    }
  }
  const sourcedIdx = events
    .filter((e) => e.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"))
    .map((e) => e.positionIndex);
  if (sourcedIdx.length > 0) {
    const prov: EnrichmentNodeProvenance = {
      synthesis_finding_ids: [],
      chronology_event_ids: chronologyIdsAtPositions(sourcedIdx, events),
      research_candidate_source_ids: sourcesAtPositions(sourcedIdx, events),
    };
    const row: Omit<DraftEnrichmentSuggestedSection, "support_status" | "weak_support_explanation"> = {
      id: `sec:timeline:${secIdx++}`,
      title: "Timeline candidates (from research)",
      rationale:
        "Sections align with M5-T06 sourced_claim chronology rows for editorial ordering (not verified dates).",
      linked_synthesis_finding_ids: [],
      linked_chronology_position_indexes: sourcedIdx,
      provenance: prov,
    };
    const st = sectionSupportStatus(row);
    sections.push({ ...row, support_status: st.support_status, weak_support_explanation: st.weak });
  }
  if (sections.length === 0) {
    const positions = events.filter((e) => e.positionIndex > 0).map((e) => e.positionIndex);
    const prov: EnrichmentNodeProvenance = {
      synthesis_finding_ids: [],
      chronology_event_ids: chronologyIdsAtPositions(positions, events),
      research_candidate_source_ids: sourcesAtPositions(positions, events),
    };
    const row: Omit<DraftEnrichmentSuggestedSection, "support_status" | "weak_support_explanation"> = {
      id: "sec:fallback:0",
      title: "Opening narrative",
      rationale: "Fallback when synthesis sections are sparse; expand with additional research.",
      linked_synthesis_finding_ids: [],
      linked_chronology_position_indexes: positions,
      provenance: prov,
    };
    const st = sectionSupportStatus(row);
    sections.push({ ...row, support_status: st.support_status, weak_support_explanation: st.weak });
  }
  return sections.slice(0, 12);
}

function buildKeyEvents(events: readonly ChronologyEventEnrichmentInput[]): DraftEnrichmentKeyEvent[] {
  const out: DraftEnrichmentKeyEvent[] = [];
  for (const e of events) {
    if (e.positionIndex === 0 && isPreambleRow(e)) continue;
    if (isOmissionRow(e)) continue;
    const synLinks = linkedFindingIdsFromCreatorNote(e.creatorNote);
    const prov: EnrichmentNodeProvenance = {
      synthesis_finding_ids: synLinks,
      chronology_event_ids: [e.id],
      research_candidate_source_ids: [...e.supportingCandidateSourceIds],
    };
    const base = {
      chronology_event_id: e.id,
      position_index: e.positionIndex,
      headline: clip(e.headline, 240),
      summary_clip: clip(e.summary, 1200),
      event_type: e.eventType,
      context_label: e.contextLabel,
      supporting_research_candidate_source_ids: [...e.supportingCandidateSourceIds],
      linked_synthesis_finding_ids: synLinks,
      claim_risk_level: e.claimRiskLevel,
      confidence_state: e.confidenceState,
      ambiguity_carryforward: e.ambiguityNote ? clip(e.ambiguityNote, 2000) : null,
      provenance: prov,
    };
    const { support_status, weak } = keyEventSupportStatus(base);
    out.push({ ...base, support_status, weak_support_explanation: weak });
  }
  return out;
}

function buildCoverageGapNodes(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): DraftEnrichmentCoverageGapNode[] {
  const preamble = events.find((e) => isPreambleRow(e));
  const nodes: DraftEnrichmentCoverageGapNode[] = [];
  let idx = 0;
  if (pkg) {
    for (const note of pkg.coverage_notes) {
      const text = clip(note, 800);
      const prov = mergeProv(
        { synthesis_finding_ids: [], chronology_event_ids: preamble ? [preamble.id] : [], research_candidate_source_ids: [] },
        emptyProvenance(),
      );
      nodes.push({
        id: `cov:package_note:${idx++}`,
        text,
        provenance: prov,
        support_status: "partially_source_backed",
        weak_support_explanation:
          "Package-level coverage note aggregates job posture; not a single attributable excerpt claim.",
      });
    }
    for (const f of pkg.findings) {
      if (f.kind === "gap_note") {
        const ch = chronologyIdsForFindingIds([f.id], events);
        const prov: EnrichmentNodeProvenance = {
          synthesis_finding_ids: [f.id],
          chronology_event_ids: ch,
          research_candidate_source_ids: uniqueStrings([...f.supporting_research_candidate_source_ids], 32),
        };
        nodes.push({
          id: `cov:gap_finding:${f.id}`,
          text: clip(f.text, 800),
          provenance: prov,
          support_status: prov.research_candidate_source_ids.length >= 1 ? "partially_source_backed" : "chronology_thin_sources",
          weak_support_explanation: "Gap notes document limits; treat as research follow-ups, not verified facts.",
        });
      }
    }
    for (const q of pkg.open_questions) {
      nodes.push({
        id: `cov:open_question:${idx++}`,
        text: clip(q, 500),
        provenance: {
          synthesis_finding_ids: [],
          chronology_event_ids: preamble ? [preamble.id] : [],
          research_candidate_source_ids: [],
        },
        support_status: "partially_source_backed",
        weak_support_explanation: "Open question from synthesis package (editorial prompt, not sourced claim).",
      });
    }
  }
  for (const e of events) {
    if (e.contextLabel?.includes("coverage.gap_note") || e.contextLabel?.includes("insufficient")) {
      nodes.push({
        id: `cov:chronology:${e.id}`,
        text: clip(e.summary, 600),
        provenance: {
          synthesis_finding_ids: linkedFindingIdsFromCreatorNote(e.creatorNote),
          chronology_event_ids: [e.id],
          research_candidate_source_ids: [...e.supportingCandidateSourceIds],
        },
        support_status:
          e.supportingCandidateSourceIds.length > 0 ? "chronology_thin_sources" : "unresolved_weak",
        weak_support_explanation: "Chronology gap/coverage row; corroborate before treating as publishable scope.",
      });
    }
  }
  const seen = new Set<string>();
  const dedup: DraftEnrichmentCoverageGapNode[] = [];
  for (const n of nodes) {
    const k = `${n.id}|${n.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(n);
    if (dedup.length >= 28) break;
  }
  return dedup;
}

function buildAmbiguityNodes(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): DraftEnrichmentAmbiguityNode[] {
  const nodes: DraftEnrichmentAmbiguityNode[] = [];
  let idx = 0;
  if (pkg?.retrieval_partial && pkg.retrieval_partial_notes) {
    const text = clip(`Retrieval partial: ${pkg.retrieval_partial_notes}`, 800);
    nodes.push({
      id: `amb:retrieval_partial:${idx++}`,
      text,
      provenance: { synthesis_finding_ids: [], chronology_event_ids: [], research_candidate_source_ids: [] },
      support_status: "partially_source_backed",
      weak_support_explanation: "Bounded retrieval returned a partial hit set.",
    });
  }
  for (const e of events) {
    if (e.ambiguityNote && e.ambiguityNote.trim()) {
      nodes.push({
        id: `amb:chronology:${e.id}`,
        text: clip(e.ambiguityNote, 1200),
        provenance: {
          synthesis_finding_ids: linkedFindingIdsFromCreatorNote(e.creatorNote),
          chronology_event_ids: [e.id],
          research_candidate_source_ids: [...e.supportingCandidateSourceIds],
        },
        support_status:
          e.supportingCandidateSourceIds.length >= 2 && linkedFindingIdsFromCreatorNote(e.creatorNote).length >= 1
            ? "partially_source_backed"
            : e.supportingCandidateSourceIds.length >= 1
              ? "chronology_thin_sources"
              : "unresolved_weak",
        weak_support_explanation: "Ambiguity / temporal honesty text carried forward from chronology extraction.",
      });
    }
  }
  const seen = new Set<string>();
  const dedup: DraftEnrichmentAmbiguityNode[] = [];
  for (const n of nodes) {
    const k = `${n.id}|${n.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(n);
    if (dedup.length >= 24) break;
  }
  return dedup;
}

function buildSummarySpine(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
  storyTitle: string,
): string {
  const summaryFinding = pkg?.findings.find((f) => f.kind === "synthesis_summary");
  const preamble = events.find((e) => isPreambleRow(e));
  const sourcedHeadlines = events
    .filter((e) => e.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"))
    .slice(0, 4)
    .map((e) => clip(e.headline, 160));
  const blocks = [
    clip(`Story: “${clip(storyTitle, 160)}”`, 400),
    summaryFinding ? clip(summaryFinding.text, 900) : null,
    preamble ? clip(preamble.summary, 700) : null,
    sourcedHeadlines.length ? `Candidate spine headlines: ${sourcedHeadlines.join(" · ")}` : null,
  ].filter(Boolean);
  return clip(blocks.join("\n\n"), 4000);
}

function buildSummarySpineNode(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
  spineText: string,
): DraftEnrichmentSummarySpineNode {
  const summaryFinding = pkg?.findings.find((f) => f.kind === "synthesis_summary");
  const preamble = events.find((e) => isPreambleRow(e));
  const sourced = events.filter((e) => e.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"));
  const prov = mergeProv(
    summaryFinding
      ? {
          synthesis_finding_ids: [summaryFinding.id],
          chronology_event_ids: chronologyIdsForFindingIds([summaryFinding.id], events),
          research_candidate_source_ids: uniqueStrings([...summaryFinding.supporting_research_candidate_source_ids], 32),
        }
      : emptyProvenance(),
    preamble
      ? {
          synthesis_finding_ids: [],
          chronology_event_ids: [preamble.id],
          research_candidate_source_ids: uniqueStrings([...preamble.supportingCandidateSourceIds], 32),
        }
      : emptyProvenance(),
    {
      synthesis_finding_ids: [],
      chronology_event_ids: sourced.map((e) => e.id),
      research_candidate_source_ids: uniqueStrings(sourced.flatMap((e) => [...e.supportingCandidateSourceIds]), 48),
    },
  );
  const hasSynthesis = Boolean(summaryFinding);
  const hasPreamble = Boolean(preamble);
  const support_status: ProvenanceSupportStatus =
    hasSynthesis && prov.chronology_event_ids.length > 0 && prov.research_candidate_source_ids.length >= 2
      ? "partially_source_backed"
      : hasSynthesis || hasPreamble
        ? "chronology_thin_sources"
        : "unresolved_weak";
  return {
    id: "summary:spine",
    text: spineText,
    provenance: prov,
    support_status,
    weak_support_explanation:
      support_status === "partially_source_backed" && prov.research_candidate_source_ids.length >= 2
        ? null
        : "Summary spine merges multiple upstream fragments; verify claims independently before publication.",
  };
}

/**
 * Deterministic enrichment: no LLM. M5-T08: every surfaced node includes provenance + support_status.
 */
export function buildDraftEnrichmentPackageV1(params: {
  storyId: string;
  researchJobId: string;
  storyTitle: string;
  researchSynthesisPackage: unknown;
  chronologyExtractionVersion: string;
  chronologyEvents: readonly ChronologyEventEnrichmentInput[];
}): DraftEnrichmentPackageV1 {
  const pkg = parseResearchSynthesisPackageV1(params.researchSynthesisPackage);
  const generated_at = new Date().toISOString();
  const retrieval_partial = pkg?.retrieval_partial ?? false;
  const retrieval_context: DraftEnrichmentPackageV1["retrieval_context"] = pkg?.retrieval_mode ?? "unknown";

  const summary_spine = buildSummarySpine(pkg, params.chronologyEvents, params.storyTitle);
  const major_arcs = majorArcsFromSynthesis(pkg, params.storyTitle, params.chronologyEvents);
  const suggested_sections = suggestedSectionsFromSynthesis(pkg, params.chronologyEvents);
  const key_events = buildKeyEvents(params.chronologyEvents);
  const coverage_gaps = buildCoverageGapNodes(pkg, params.chronologyEvents);
  const ambiguity_notes = buildAmbiguityNodes(pkg, params.chronologyEvents);
  const summary_spine_node = buildSummarySpineNode(pkg, params.chronologyEvents, summary_spine);

  return {
    schema_version: DRAFT_ENRICHMENT_SCHEMA_VERSION,
    story_id: params.storyId,
    research_job_id: params.researchJobId,
    generated_at,
    retrieval_context,
    retrieval_partial,
    not_publishable_narrative_note:
      "M5-T07 draft enrichment is creator-workflow scaffolding derived from bounded research synthesis and chronology candidates. It is not a publish-ready article, does not assert complete chronology, and must be edited with primary sources before publication.",
    provenance_trace_note:
      "M5-T08: each major_arc, suggested_section, key_event, coverage_gap, ambiguity_note, and summary_spine_node carries provenance (synthesis finding ids, chronology event ids, research_candidate_source ids) plus support_status. Absence of an id in a list means that upstream link was not established—do not infer corroboration.",
    synthesis_schema_version: pkg?.schema_version ?? null,
    chronology_extraction_version: params.chronologyExtractionVersion,
    summary_spine,
    summary_spine_node,
    major_arcs,
    suggested_sections,
    key_events,
    coverage_gaps,
    ambiguity_notes,
  };
}
