import { describe, expect, it } from "vitest";
import { RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION } from "../draft-enrichment/honesty-summary";
import { buildFallbackEditorialReviewFromHonesty } from "./fallback-from-honesty";
import { AI_EDITORIAL_REVIEW_SCHEMA_VERSION } from "./types";

describe("buildFallbackEditorialReviewFromHonesty", () => {
  it("builds findings from honesty rollup and hints", () => {
    const honesty = {
      schema_version: RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION,
      narrative_generation_mode: "deterministic_scaffolding",
      provenance_traceability: "full_m5_t08",
      has_mixed_or_weak_support: true,
      publishable_narrative_posture: "creator_guidance_only",
      synthesis_retrieval_partial: true,
      support_status_rollup: {
        fully_source_backed: 0,
        partially_source_backed: 1,
        chronology_thin_sources: 2,
        unresolved_weak: 1,
        total_nodes: 10,
      },
      retrieval_depth: {
        tier: "partial" as const,
        evidence: {
          retrieval_mode: "live" as const,
          synthesis_retrieval_partial: true,
          candidate_source_count: 3,
          distinct_source_hosts: 1,
          synthesis_finding_count: 5,
          sourced_claim_finding_count: 3,
          synthesis_cluster_count: 1,
        },
        headline: "Retrieval depth: partial — bounded live retrieval reported incomplete coverage.",
        next_action: "Retry research with a clearer brief or wider scope, or add sources manually where gaps appear.",
      },
      synthesis_orchestration: {
        tier: "partial" as const,
        evidence: {
          finding_total: 6,
          sourced_claim_count: 3,
          gap_note_count: 1,
          synthesis_summary_count: 1,
          cluster_count: 1,
          cluster_member_link_count: 3,
        },
        consumer_alignment: {
          framing_live_prompt_includes_structured_brief: true,
          chronology_events_materialized: 4,
          draft_enrichment_package_materialized: true,
        },
        pipeline_materialization_coherent: true,
        headline: "Synthesis orchestration: partial — usable clusters and sourced claims exist.",
        next_action: "Proceed to framing selection.",
      },
      ui_hints: ["Check temporal anchors on early events."],
    };
    const out = buildFallbackEditorialReviewFromHonesty({
      storyId: "s",
      researchJobId: "j",
      honestyContext: honesty,
      draftEnrichmentPackage: null,
      framingReference: null,
      liveEnrichmentReference: null,
      provider: "none",
      promptTemplateKey: "review.editorial_grounded_draft_m5_t12_v1",
      promptVersion: "1.0.0",
    });
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.schema_version).toBe(AI_EDITORIAL_REVIEW_SCHEMA_VERSION);
    expect(out.review_mode).toBe("deterministic_honesty_fallback");
    expect(out.review_findings.length).toBeGreaterThanOrEqual(3);
    expect(out.failure?.code).toBe("editorial_review_used_honesty_fallback");
  });

  it("returns null when no derivable signals", () => {
    const honesty = {
      schema_version: RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION,
      narrative_generation_mode: "deterministic_scaffolding",
      provenance_traceability: "full_m5_t08",
      has_mixed_or_weak_support: false,
      publishable_narrative_posture: "creator_guidance_only",
      synthesis_retrieval_partial: false,
      support_status_rollup: {
        fully_source_backed: 5,
        partially_source_backed: 0,
        chronology_thin_sources: 0,
        unresolved_weak: 0,
        total_nodes: 5,
      },
      retrieval_depth: {
        tier: "solid" as const,
        evidence: {
          retrieval_mode: "live" as const,
          synthesis_retrieval_partial: false,
          candidate_source_count: 6,
          distinct_source_hosts: 3,
          synthesis_finding_count: 8,
          sourced_claim_finding_count: 6,
          synthesis_cluster_count: 1,
        },
        headline: "Retrieval depth: solid — bounded live retrieval produced enough diversified candidates.",
        next_action: "Proceed to framing and draft assembly while still verifying claims against primaries before publish.",
      },
      synthesis_orchestration: {
        tier: "solid" as const,
        evidence: {
          finding_total: 10,
          sourced_claim_count: 6,
          gap_note_count: 0,
          synthesis_summary_count: 1,
          cluster_count: 2,
          cluster_member_link_count: 8,
        },
        consumer_alignment: {
          framing_live_prompt_includes_structured_brief: true,
          chronology_events_materialized: 8,
          draft_enrichment_package_materialized: true,
        },
        pipeline_materialization_coherent: true,
        headline: "Synthesis orchestration: solid.",
        next_action: "Continue.",
      },
      ui_hints: [],
    };
    expect(
      buildFallbackEditorialReviewFromHonesty({
        storyId: "s",
        researchJobId: "j",
        honestyContext: honesty,
        draftEnrichmentPackage: null,
        framingReference: null,
        liveEnrichmentReference: null,
        provider: "none",
        promptTemplateKey: "k",
        promptVersion: "1",
      }),
    ).toBeNull();
  });
});
