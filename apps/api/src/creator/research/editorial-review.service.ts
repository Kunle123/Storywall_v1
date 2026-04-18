import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreatorWorkflowState, StoryBrief } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  AI_EDITORIAL_REVIEW_SCHEMA_VERSION,
  type AiEditorialReviewPackageV1,
  AI_FRAMING_GENERATION_SCHEMA_VERSION,
  type AiFramingGenerationPackageV1,
  applyPromptAuditToInvocationContext,
  buildFallbackEditorialReviewFromHonesty,
  buildResearchPackageHonestySummary,
  getCanonicalPromptTemplate,
  LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION,
  type LiveEventDraftEnrichmentPackageV1,
  parseEditorialReviewFromLlmJson,
  renderPromptTemplate,
} from "@storywall/shared";
import { AiRuntimeService } from "../../ai-runtime/ai-runtime.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ResearchService } from "./research.service";
import type { GenerateEditorialReviewDto } from "./dto/generate-editorial-review.dto";

const PROMPT_TEMPLATE_KEY = "review.editorial_grounded_draft_m5_t12_v1" as const;

const NOT_AUTHORITATIVE_REVIEW_NOTE =
  "Model-assisted editorial review for creators only. Not a substitute for primary-source verification, rule-based validation, or legal review — treat every finding as provisional.";

const ALLOWED_WORKFLOW: readonly CreatorWorkflowState[] = [
  "drafting_brief",
  "awaiting_framing_choice",
  "researching",
  "ready_for_edit",
  "assembling_draft",
  "needs_validation",
] as const;

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function resolveFramingForJob(params: {
  brief: StoryBrief;
  jobId: string;
}): { reference: AiEditorialReviewPackageV1["framing_reference"]; framingContextJson: string } {
  const raw = params.brief.aiFramingGenerationPackage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { reference: null, framingContextJson: "null" };
  }
  const fp = raw as Partial<AiFramingGenerationPackageV1>;
  if (fp.schema_version !== AI_FRAMING_GENERATION_SCHEMA_VERSION || fp.research_job_id !== params.jobId) {
    return { reference: null, framingContextJson: "null" };
  }
  const opts = Array.isArray(fp.framing_options) ? fp.framing_options : [];
  const reference: NonNullable<AiEditorialReviewPackageV1["framing_reference"]> = {
    framing_generation_prompt_key:
      typeof fp.prompt_template_key === "string" && fp.prompt_template_key.trim()
        ? fp.prompt_template_key.trim()
        : null,
    framing_option_ids: opts.map((o) => o.id).filter((id): id is string => typeof id === "string" && id.length > 0),
  };
  return {
    reference,
    framingContextJson: JSON.stringify({ framing_options: opts }).slice(0, 12_000),
  };
}

function resolveLiveEnrichmentForJob(params: {
  brief: StoryBrief;
  jobId: string;
}): { reference: AiEditorialReviewPackageV1["live_enrichment_reference"]; liveEnrichmentJson: string } {
  const raw = params.brief.aiEventDraftEnrichmentPackage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { reference: null, liveEnrichmentJson: "null" };
  }
  const ep = raw as Partial<LiveEventDraftEnrichmentPackageV1>;
  if (ep.schema_version !== LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION || ep.research_job_id !== params.jobId) {
    return { reference: null, liveEnrichmentJson: "null" };
  }
  const events = Array.isArray(ep.enriched_events) ? ep.enriched_events : [];
  const sections = Array.isArray(ep.suggested_sections) ? ep.suggested_sections : [];
  const reference: NonNullable<AiEditorialReviewPackageV1["live_enrichment_reference"]> = {
    enrichment_prompt_template_key:
      typeof ep.prompt_template_key === "string" && ep.prompt_template_key.trim()
        ? ep.prompt_template_key.trim()
        : null,
    enrichment_schema_version: typeof ep.schema_version === "string" ? ep.schema_version : null,
    sampled_enriched_event_ids: events
      .slice(0, 24)
      .map((e) => e.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
    sampled_suggested_section_ids: sections
      .slice(0, 16)
      .map((s) => s.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  };
  const excerpt = JSON.stringify({
    enriched_events: events.slice(0, 24).map((e) => ({
      id: e.id,
      chronology_event_id: e.chronology_event_id,
      narrative_expansion: String(e.narrative_expansion ?? "").slice(0, 900),
      caution_note: e.caution_note,
    })),
    suggested_sections: sections.slice(0, 16).map((s) => ({
      id: s.id,
      title: s.title,
      purpose: String(s.purpose ?? "").slice(0, 700),
      caution_note: s.caution_note,
    })),
  }).slice(0, 14_000);
  return { reference, liveEnrichmentJson: excerpt };
}

@Injectable()
export class EditorialReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly research: ResearchService,
    private readonly aiRuntime: AiRuntimeService,
  ) {}

  /**
   * M5-T12 — live (or honest fallback) editorial review for grounded draft-building materials.
   * Persists to `story_brief.ai_editorial_review_package` (scoped by `research_job_id` in the envelope).
   */
  async generateAndPersist(params: {
    storyId: string;
    jobId: string;
    creatorId: string;
    dto: GenerateEditorialReviewDto;
  }): Promise<AiEditorialReviewPackageV1> {
    const { storyId, jobId, creatorId, dto } = params;

    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      include: { storyBrief: true },
    });
    if (!story?.storyBrief) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Story or brief not found" },
      });
    }
    if (!ALLOWED_WORKFLOW.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Editorial review is not allowed in the current workflow state",
          details: { story_state: story.workflowState },
        },
      });
    }

    const brief = story.storyBrief;
    const pkg = await this.research.getResearchPackage({ storyId, jobId, creatorId });
    const chrono = await this.research.getResearchChronology({ storyId, jobId, creatorId });

    const syn = pkg.artifact.researchSynthesisPackage;
    const researchSynthesisExcerpt =
      syn && typeof syn === "object" ? JSON.stringify(syn).slice(0, 14_000) : "";
    const honesty = buildResearchPackageHonestySummary({
      draftEnrichmentPackage: pkg.artifact.draftEnrichmentPackage ?? null,
      researchSynthesisPackage: syn ?? null,
      candidateSources: pkg.candidateSources.map((s) => ({ source_url: s.sourceUrl })),
    });
    const honestyJson = JSON.stringify(honesty).slice(0, 8000);

    const { reference: framingRef, framingContextJson } = resolveFramingForJob({ brief, jobId });
    const { reference: enrichRef, liveEnrichmentJson } = resolveLiveEnrichmentForJob({ brief, jobId });

    const chronologyRows = chrono.events.map((e) => {
      const fromJson = asStringArray(e.supportingCandidateSourceIds as unknown);
      const fromLinks = e.sourceLinks.map((l) => l.researchCandidateSourceId);
      const supporting = [...new Set([...fromJson, ...fromLinks])];
      return {
        id: e.id,
        position_index: e.positionIndex,
        headline: e.headline,
        summary: e.summary.slice(0, 1200),
        context_label: e.contextLabel,
        event_type: e.eventType,
        supporting_candidate_source_ids: supporting,
      };
    });
    const chronologyEventsJson = JSON.stringify(chronologyRows).slice(0, 24_000);

    const cfg = this.aiRuntime.getSnapshot();
    const port = this.aiRuntime.getTextGenerationPort();

    const baseMeta = (): Pick<
      AiEditorialReviewPackageV1,
      | "schema_version"
      | "prompt_template_key"
      | "prompt_version"
      | "provider"
      | "story_id"
      | "research_job_id"
      | "framing_reference"
      | "live_enrichment_reference"
      | "honesty_context"
      | "not_authoritative_review_note"
      | "generated_at"
    > => ({
      schema_version: AI_EDITORIAL_REVIEW_SCHEMA_VERSION,
      prompt_template_key: PROMPT_TEMPLATE_KEY,
      prompt_version: "1.0.0",
      provider: cfg.provider === "none" ? "none" : cfg.provider,
      story_id: storyId,
      research_job_id: jobId,
      framing_reference: framingRef,
      live_enrichment_reference: enrichRef,
      honesty_context: honesty,
      not_authoritative_review_note: NOT_AUTHORITATIVE_REVIEW_NOTE,
      generated_at: new Date().toISOString(),
    });

    const persist = async (p: AiEditorialReviewPackageV1) => {
      await this.prisma.storyBrief.update({
        where: { id: brief.id },
        data: { aiEditorialReviewPackage: p as unknown as Prisma.InputJsonValue },
      });
      return p;
    };

    try {
      if (port.implementationId !== "openai_compatible_http_v1") {
        throw new Error("ai_transport_unavailable");
      }
      const def = getCanonicalPromptTemplate({ key: PROMPT_TEMPLATE_KEY });
      const variables: Record<string, string> = {
        subject: brief.subject.trim().slice(0, 400),
        story_type: String(brief.storyType),
        research_brief: brief.researchBrief.trim().slice(0, 6000),
        desired_angle: brief.desiredAngle.trim().slice(0, 3000),
        creator_notes: dto.notes?.trim().slice(0, 1500) ?? "(none)",
        research_synthesis_excerpt:
          researchSynthesisExcerpt.trim().length > 0
            ? researchSynthesisExcerpt
            : "(no research_synthesis_package — flag gaps; do not invent ids.)",
        research_honesty_json: honestyJson,
        chronology_events_json: chronologyEventsJson,
        framing_context_json: framingContextJson,
        live_enrichment_json: liveEnrichmentJson,
      };
      const rendered = renderPromptTemplate(def, variables);
      const ctx = applyPromptAuditToInvocationContext({ purpose: "editorial_review", storyId }, rendered.audit);
      const completion = await port.completeChat({ messages: rendered.messages, context: ctx });
      const parsed = parseEditorialReviewFromLlmJson(completion.text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const live: AiEditorialReviewPackageV1 = {
        ...baseMeta(),
        prompt_version: def.version,
        review_mode: "live_ai_backed",
        status: "succeeded",
        model: completion.providerModelLabel ?? null,
        review_findings: parsed.review_findings,
        overall_editorial_posture: parsed.overall_editorial_posture,
        failure: null,
      };
      return persist(live);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const mapped = buildFallbackEditorialReviewFromHonesty({
        storyId,
        researchJobId: jobId,
        honestyContext: honesty,
        draftEnrichmentPackage: pkg.artifact.draftEnrichmentPackage ?? null,
        framingReference: framingRef,
        liveEnrichmentReference: enrichRef,
        provider: cfg.provider === "none" ? "none" : cfg.provider,
        promptTemplateKey: PROMPT_TEMPLATE_KEY,
        promptVersion: "1.0.0",
      });
      if (mapped) {
        return persist(mapped);
      }
      const empty: AiEditorialReviewPackageV1 = {
        ...baseMeta(),
        review_mode: "deterministic_honesty_fallback",
        status: "fallback_deterministic",
        model: null,
        review_findings: [],
        overall_editorial_posture:
          "No deterministic review signals were available and the live model path did not complete. Re-fetch the research package and try again after checking AI runtime configuration.",
        failure: {
          code: "editorial_review_unavailable",
          message: msg.slice(0, 2000),
        },
      };
      return persist(empty);
    }
  }
}
