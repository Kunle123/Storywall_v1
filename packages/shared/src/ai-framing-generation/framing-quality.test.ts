import { describe, expect, it } from "vitest";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "../research-synthesis/types";
import { assessAiFramingGenerationQuality, extractSynthesisIdsFromResearchExcerpt } from "./framing-quality";
import { AI_FRAMING_GENERATION_SCHEMA_VERSION } from "./types";

const basePkg = () =>
  ({
    schema_version: AI_FRAMING_GENERATION_SCHEMA_VERSION,
    generation_mode: "live_ai_backed" as const,
    status: "succeeded" as const,
    prompt_template_key: "framing.live_package_m5_t10_v1",
    prompt_version: "1.0.1",
    provider: "openai_compatible",
    model: "gpt-test",
    story_id: "11111111-1111-1111-1111-111111111111",
    research_job_id: "22222222-2222-2222-2222-222222222222",
    not_publishable_framing_note: "n",
    failure: null,
    honesty_context: {
      schema_version: "m5-t09-v1",
      retrieval_depth: { tier: "partial", evidence: {}, headline: "", next_action: "" },
      synthesis_orchestration: { tier: "solid", evidence: {}, consumer_alignment: {}, headline: "", next_action: "" },
    },
    generated_at: "2020-01-01T00:00:00.000Z",
  }) as const;

function synthExcerpt(ids: string[]) {
  return JSON.stringify({
    schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
    retrieval_mode: "stub",
    retrieval_partial: false,
    generated_at: "2020-01-01T00:00:00.000Z",
    coverage_notes: [],
    open_questions: [],
    findings: ids.map((id, i) => ({
      id,
      kind: "sourced_claim",
      text: `claim ${i}`,
      supporting_research_candidate_source_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
      confidence: "medium",
    })),
    clusters: [{ id: "cluster-primary-candidates", label: "C", summary: "s", member_finding_ids: ids, supporting_research_candidate_source_ids: [] }],
  });
}

describe("extractSynthesisIdsFromResearchExcerpt", () => {
  it("collects finding and cluster ids", () => {
    const ex = synthExcerpt(["finding-src-0", "finding-src-1"]);
    const s = extractSynthesisIdsFromResearchExcerpt(ex);
    expect(s.has("finding-src-0")).toBe(true);
    expect(s.has("cluster-primary-candidates")).toBe(true);
  });
});

describe("assessAiFramingGenerationQuality", () => {
  it("counts synthesis anchor when option id matches a finding id (empty grounding_refs)", () => {
    const excerpt = synthExcerpt(["finding-src-0", "finding-src-1", "finding-src-2"]);
    const pkg = {
      ...basePkg(),
      framing_options: [
        {
          id: "finding-src-0",
          title: "Chronology first timeline spine",
          angle_description: "Orders beats by evidence.",
          narrative_emphasis: "Timeline",
          caution_note: "Stub.",
          grounding_refs: [],
        },
        {
          id: "finding-src-1",
          title: "Thematic synthesis cluster reading",
          angle_description: "Interprets themes.",
          narrative_emphasis: "Themes",
          caution_note: null,
          grounding_refs: [],
        },
        {
          id: "cluster-primary-candidates",
          title: "Scope coverage tradeoffs lens",
          angle_description: "Foregrounds biography scope.",
          narrative_emphasis: "Scope",
          caution_note: null,
          grounding_refs: [],
        },
      ],
    };
    const q = assessAiFramingGenerationQuality({
      pkg,
      researchSynthesisExcerpt: excerpt,
      researchBriefText: "Biography about scope tradeoffs and thematic reading of sources.",
    });
    expect(q.synthesis_grounding.options_with_synthesis_ref).toBe(3);
    expect(q.synthesis_grounding.grounding_tier).toBe("strong");
  });

  it("marks production_usable when differentiated and fully synthesis-grounded", () => {
    const excerpt = synthExcerpt(["finding-src-0", "finding-src-1", "finding-src-2"]);
    const pkg = {
      ...basePkg(),
      framing_options: [
        {
          id: "a",
          title: "Chronology first timeline spine",
          angle_description: "Orders beats by evidence and dates using finding-src-0.",
          narrative_emphasis: "Timeline",
          caution_note: "Stub sources.",
          grounding_refs: [{ kind: "synthesis_finding" as const, id: "finding-src-0", label: "x" }],
        },
        {
          id: "b",
          title: "Thematic synthesis cluster reading",
          angle_description: "Interprets cluster-primary-candidates as thematic spine.",
          narrative_emphasis: "Themes",
          caution_note: null,
          grounding_refs: [{ kind: "synthesis_cluster" as const, id: "cluster-primary-candidates", label: "c" }],
        },
        {
          id: "c",
          title: "Scope coverage tradeoffs lens",
          angle_description: "Foregrounds biography scope and defers side plots per finding-src-2.",
          narrative_emphasis: "Scope",
          caution_note: null,
          grounding_refs: [{ kind: "synthesis_finding" as const, id: "finding-src-2", label: "y" }],
        },
      ],
    };
    const q = assessAiFramingGenerationQuality({
      pkg,
      researchSynthesisExcerpt: excerpt,
      researchBriefText: "Biography about scope tradeoffs and thematic reading of sources.",
    });
    expect(q.schema_version).toBe("m5-t25-v1");
    expect(q.distinctness_risk).toBe("low");
    expect(q.synthesis_grounding.grounding_tier).toBe("strong");
    expect(q.overall).toBe("production_usable");
  });

  it("marks weak_set when titles and angles collapse", () => {
    const excerpt = synthExcerpt(["finding-src-0", "finding-src-1", "finding-src-2"]);
    const sameBody =
      "This biography overview tells the story of the subject in overview form with the same narrative emphasis.";
    const pkg = {
      ...basePkg(),
      framing_options: [
        {
          id: "a",
          title: "Great biography overview",
          angle_description: sameBody,
          narrative_emphasis: "Overview",
          caution_note: null,
          grounding_refs: [{ kind: "synthesis_finding" as const, id: "finding-src-0", label: "x" }],
        },
        {
          id: "b",
          title: "Great biography overview",
          angle_description: sameBody,
          narrative_emphasis: "Overview",
          caution_note: null,
          grounding_refs: [{ kind: "synthesis_finding" as const, id: "finding-src-1", label: "y" }],
        },
        {
          id: "c",
          title: "Great biography overview",
          angle_description: sameBody,
          narrative_emphasis: "Overview",
          caution_note: null,
          grounding_refs: [{ kind: "synthesis_finding" as const, id: "finding-src-2", label: "z" }],
        },
      ],
    };
    const q = assessAiFramingGenerationQuality({
      pkg,
      researchSynthesisExcerpt: excerpt,
      researchBriefText: "brief",
    });
    expect(q.distinctness_risk).toBe("high");
    expect(q.overall).toBe("weak_set");
  });

  it("marks usable_with_caveats for deterministic fallback", () => {
    const pkg = {
      ...basePkg(),
      generation_mode: "deterministic_scaffolding_fallback" as const,
      status: "fallback_deterministic" as const,
      model: null,
      framing_options: [
        {
          id: "deterministic:1",
          title: "D1",
          angle_description: "a1",
          narrative_emphasis: "e1",
          caution_note: "c",
          grounding_refs: [],
        },
        {
          id: "deterministic:2",
          title: "D2",
          angle_description: "a2",
          narrative_emphasis: "e2",
          caution_note: "c",
          grounding_refs: [],
        },
        {
          id: "deterministic:3",
          title: "D3",
          angle_description: "a3",
          narrative_emphasis: "e3",
          caution_note: "c",
          grounding_refs: [],
        },
      ],
      failure: { code: "x", message: "y" },
    };
    const q = assessAiFramingGenerationQuality({
      pkg,
      researchSynthesisExcerpt: "",
      researchBriefText: "brief",
    });
    expect(q.overall).toBe("usable_with_caveats");
    expect(q.synthesis_grounding.grounding_tier).toBe("none_applicable");
  });
});
