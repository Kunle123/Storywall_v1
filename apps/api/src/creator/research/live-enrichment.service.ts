import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreatorWorkflowState, StoryBrief } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  AI_FRAMING_GENERATION_SCHEMA_VERSION,
  type AiFramingGenerationPackageV1,
  applyPromptAuditToInvocationContext,
  buildFallbackLiveEnrichmentFromDraftPackage,
  buildResearchPackageHonestySummary,
  getCanonicalPromptTemplate,
  LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION,
  type LiveEnrichmentFramingReference,
  type LiveEventDraftEnrichmentPackageV1,
  parseLiveEnrichmentFromLlmJson,
  renderPromptTemplate,
} from "@storywall/shared";
import { AiRuntimeService } from "../../ai-runtime/ai-runtime.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ResearchService } from "./research.service";
import type { GenerateLiveEnrichmentDto } from "./dto/generate-live-enrichment.dto";

const PROMPT_TEMPLATE_KEY = "enrichment.live_events_sections_m5_t11_v1" as const;

const NOT_PUBLISHABLE_ENRICHMENT_NOTE =
  "Model-generated story-building notes for creators only. Not publish-ready prose, may omit nuance, and is not fully source-verified — check primary materials and Storywall honesty signals before publication.";

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
}): { reference: LiveEnrichmentFramingReference | null; framingContextJson: string } {
  const raw = params.brief.aiFramingGenerationPackage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { reference: null, framingContextJson: "null" };
  }
  const fp = raw as Partial<AiFramingGenerationPackageV1>;
  if (fp.schema_version !== AI_FRAMING_GENERATION_SCHEMA_VERSION || fp.research_job_id !== params.jobId) {
    return { reference: null, framingContextJson: "null" };
  }
  const opts = Array.isArray(fp.framing_options) ? fp.framing_options : [];
  const reference: LiveEnrichmentFramingReference = {
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

@Injectable()
export class LiveEnrichmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly research: ResearchService,
    private readonly aiRuntime: AiRuntimeService,
  ) {}

  /**
   * M5-T11 — live (or honest fallback) event + suggested-section enrichment for a succeeded research job.
   * Persists to `story_brief.ai_event_draft_enrichment_package` (scoped by `research_job_id` in the envelope).
   */
  async generateAndPersist(params: {
    storyId: string;
    jobId: string;
    creatorId: string;
    dto: GenerateLiveEnrichmentDto;
  }): Promise<LiveEventDraftEnrichmentPackageV1> {
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
          message: "Live event/draft enrichment is not allowed in the current workflow state",
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

    const chronologyRows = chrono.events.map((e) => {
      const fromJson = asStringArray(e.supportingCandidateSourceIds as unknown);
      const fromLinks = e.sourceLinks.map((l) => l.researchCandidateSourceId);
      const supporting = [...new Set([...fromJson, ...fromLinks])];
      return {
        id: e.id,
        position_index: e.positionIndex,
        headline: e.headline,
        summary: e.summary.slice(0, 1500),
        context_label: e.contextLabel,
        event_type: e.eventType,
        supporting_candidate_source_ids: supporting,
      };
    });
    const chronologyEventsJson = JSON.stringify(chronologyRows).slice(0, 24_000);

    const cfg = this.aiRuntime.getSnapshot();
    const port = this.aiRuntime.getTextGenerationPort();

    const baseMeta = (): Pick<
      LiveEventDraftEnrichmentPackageV1,
      | "schema_version"
      | "prompt_template_key"
      | "prompt_version"
      | "provider"
      | "story_id"
      | "research_job_id"
      | "framing_reference"
      | "honesty_context"
      | "not_publishable_enrichment_note"
      | "generated_at"
    > => ({
      schema_version: LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION,
      prompt_template_key: PROMPT_TEMPLATE_KEY,
      prompt_version: "1.0.0",
      provider: cfg.provider === "none" ? "none" : cfg.provider,
      story_id: storyId,
      research_job_id: jobId,
      framing_reference: framingRef,
      honesty_context: honesty,
      not_publishable_enrichment_note: NOT_PUBLISHABLE_ENRICHMENT_NOTE,
      generated_at: new Date().toISOString(),
    });

    const persist = async (p: LiveEventDraftEnrichmentPackageV1) => {
      await this.prisma.storyBrief.update({
        where: { id: brief.id },
        data: { aiEventDraftEnrichmentPackage: p as unknown as Prisma.InputJsonValue },
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
            : "(no research_synthesis_package — do not invent sources or event ids.)",
        research_honesty_json: honestyJson,
        chronology_events_json: chronologyEventsJson,
        framing_context_json: framingContextJson,
      };
      const rendered = renderPromptTemplate(def, variables);
      const ctx = applyPromptAuditToInvocationContext(
        { purpose: "live_event_draft_enrichment", storyId },
        rendered.audit,
      );
      const completion = await port.completeChat({ messages: rendered.messages, context: ctx });
      const parsed = parseLiveEnrichmentFromLlmJson(completion.text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const live: LiveEventDraftEnrichmentPackageV1 = {
        ...baseMeta(),
        prompt_version: def.version,
        generation_mode: "live_ai_backed",
        status: "succeeded",
        model: completion.providerModelLabel ?? null,
        enriched_events: parsed.enriched_events,
        suggested_sections: parsed.suggested_sections,
        failure: null,
      };
      return persist(live);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const mapped = buildFallbackLiveEnrichmentFromDraftPackage({
        storyId,
        researchJobId: jobId,
        draftEnrichmentPackage: pkg.artifact.draftEnrichmentPackage ?? null,
        honestyContext: honesty,
        framingReference: framingRef,
        provider: cfg.provider === "none" ? "none" : cfg.provider,
        promptTemplateKey: PROMPT_TEMPLATE_KEY,
        promptVersion: "1.0.0",
      });
      if (mapped) {
        return persist(mapped);
      }
      const empty: LiveEventDraftEnrichmentPackageV1 = {
        ...baseMeta(),
        generation_mode: "deterministic_scaffolding_fallback",
        status: "fallback_deterministic",
        model: null,
        enriched_events: [],
        suggested_sections: [],
        failure: {
          code: "live_enrichment_unavailable",
          message: msg.slice(0, 2000),
        },
      };
      return persist(empty);
    }
  }
}
