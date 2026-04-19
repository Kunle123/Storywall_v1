import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type CreatorWorkflowState,
  Prisma,
  type StoryBrief,
  type StoryDraft,
  type StoryFrameDraft,
} from "@prisma/client";
import {
  AI_FRAMING_GENERATION_SCHEMA_VERSION,
  assessAiFramingGenerationQuality,
  type AiFramingGenerationOption,
  type AiFramingGenerationPackageV1,
  applyPromptAuditToInvocationContext,
  getCanonicalPromptTemplate,
  parseFramingOptionsFromLlmJson,
  renderPromptTemplate,
} from "@storywall/shared";
import { AiRuntimeService } from "../../ai-runtime/ai-runtime.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StoriesService } from "../stories/stories.service";
import { WorkflowTransitionService } from "../workflow-transition.service";
import type { GenerateFramesDto } from "./dto/generate-frames.dto";
import type { SelectFrameDto } from "./dto/select-frame.dto";
import { loadFramingResearchGrounding } from "./framing-ai-context";

const ALLOWED_WORKFLOW_FOR_GENERATE: CreatorWorkflowState[] = [
  "drafting_brief",
  "awaiting_framing_choice",
];

/** M1-T11 / M5-T10: three framing rows per generate call. */
const OPTION_COUNT = 3;

const FRAMING_PROMPT_TEMPLATE_KEY = "framing.live_package_m5_t10_v1" as const;

const NOT_PUBLISHABLE_FRAMING_NOTE =
  "Model-generated framing guidance for creator selection only. It is not a publish-ready story, may omit nuance, and must be checked against primary sources before publication.";

/** Idempotency for `POST …/frames/select` is persisted in `creator_frame_select_idempotency` only (M1-T12). Other mutation commands do not share this mechanism yet. */

@Injectable()
export class FramesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowTransitions: WorkflowTransitionService,
    private readonly aiRuntime: AiRuntimeService,
    private readonly stories: StoriesService,
  ) {}

  /** GET list — minimal read for framing chooser (M1-T12); not full workspace. */
  async listFrames(storyId: string, creatorId: string): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    /** Story lifecycle (`stories.story_status`) — distinct from creator workflow. M4-T09 post-publish UX. */
    storyLifecycleStatus: string;
    /** M5-T26 — `stories.visibility`: what anonymous `GET /api/v1/stories/:slug` uses today (last publish), not draft-only intent. */
    storyVisibility: string;
    publishedAt: Date | null;
    storySlug: string;
    frameDrafts: StoryFrameDraft[];
    storyDraft: StoryDraft | null;
    aiFramingGeneration: unknown | null;
  }> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      include: { storyBrief: { include: { storyDraft: true } } },
    });
    if (!story?.storyBrief) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Story or brief not found" },
      });
    }
    const frameDrafts = await this.prisma.storyFrameDraft.findMany({
      where: { storyBriefId: story.storyBrief.id },
      orderBy: { candidateRank: "asc" },
    });
    return {
      storyId: story.id,
      storyState: story.workflowState,
      storyLifecycleStatus: story.storyStatus,
      storyVisibility: story.visibility,
      publishedAt: story.publishedAt,
      storySlug: story.slug,
      frameDrafts,
      storyDraft: story.storyBrief.storyDraft ?? null,
      aiFramingGeneration: story.storyBrief.aiFramingGenerationPackage ?? null,
    };
  }

  /**
   * Mutation §10.2 — allowed from `awaiting_framing_choice` only.
   * Creates `story_draft` shell from selected frame (editor §9 + §10); sets workflow `ready_for_edit`.
   * Idempotency-Key is required (contract §10.2); same key + same body replays the prior success from DB + `creator_frame_select_idempotency`.
   */
  async selectFrame(params: {
    storyId: string;
    creatorId: string;
    dto: SelectFrameDto;
    idempotencyKey: string;
  }): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    storyDraft: StoryDraft;
    selectedFrame: StoryFrameDraft;
    idempotencyReplayed: boolean;
    /** M5-T19 — latest brief snapshot for clients that have no local cache after framing select. */
    storyBrief: Record<string, unknown>;
  }> {
    const { storyId, creatorId, dto, idempotencyKey } = params;

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ ok: number }>>(
        `SELECT 1 AS ok FROM stories WHERE id = $1::uuid AND creator_id = $2::uuid FOR UPDATE`,
        storyId,
        creatorId,
      );
      if (locked.length === 0) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or brief not found" },
        });
      }

      const existingKey = await tx.creatorFrameSelectIdempotency.findUnique({
        where: {
          creatorId_storyId_requestKey: {
            creatorId,
            storyId,
            requestKey: idempotencyKey,
          },
        },
      });

      if (existingKey) {
        if (existingKey.selectedFrameId !== dto.frame_id) {
          throw new ConflictException({
            ok: false,
            error: {
              code: "idempotency_key_mismatch",
              message:
                "This Idempotency-Key was already used with a different frame_id for this story",
              details: {
                prior_selected_frame_id: existingKey.selectedFrameId,
                requested_frame_id: dto.frame_id,
              },
            },
          });
        }
        return this.loadSelectOutcomeForReplay(tx, {
          storyId,
          creatorId,
          selectedFrameId: existingKey.selectedFrameId,
        });
      }

      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: {
          storyBrief: {
            include: { storyDraft: true },
          },
        },
      });

      if (!story?.storyBrief) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or brief not found" },
        });
      }

      if (story.workflowState !== "awaiting_framing_choice") {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Frame selection is only allowed while awaiting framing choice",
            details: { story_state: story.workflowState },
          },
        });
      }

      if (story.storyBrief.storyDraft) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "frame_already_selected",
            message: "A framing choice already exists for this story",
          },
        });
      }

      const brief = story.storyBrief;

      const frame = await tx.storyFrameDraft.findFirst({
        where: {
          id: dto.frame_id,
          storyBriefId: brief.id,
        },
      });

      if (!frame) {
        throw new NotFoundException({
          ok: false,
          error: { code: "frame_not_found", message: "Framing option not found for this story" },
        });
      }

      if (frame.status !== "proposed") {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "validation_failed",
            message: "Only proposed framing options can be selected",
            details: { frame_status: frame.status },
          },
        });
      }

      await tx.storyFrameDraft.updateMany({
        where: {
          storyBriefId: brief.id,
          id: { not: frame.id },
          status: "proposed",
        },
        data: { isSelected: false, status: "discarded" },
      });

      const selectedFrame = await tx.storyFrameDraft.update({
        where: { id: frame.id },
        data: {
          isSelected: true,
          status: "selected",
          selectionSource: "ai_proposed",
        },
      });

      const storyDraft = await tx.storyDraft.create({
        data: {
          storyBriefId: brief.id,
          selectedFrameId: selectedFrame.id,
          title: selectedFrame.titleCandidate.slice(0, 500),
          subtitle: selectedFrame.subtitleCandidate,
          summary: selectedFrame.summaryCandidate,
          lens: selectedFrame.lensCandidate,
          conclusion: null,
          subjectType: story.subjectType,
          categoryPrimary: story.categoryPrimary,
          categorySecondary: null,
          timeStart: story.timeStart,
          timeEnd: story.timeEnd,
          timeDisplay: story.timeDisplay,
          storyStatus: "draft",
          visibilityTarget: "private",
          leadPriority: null,
          discoveryMode: null,
          imageryMode: brief.imageryMode,
          generationMode: "ai_draft",
          needsHumanReview: false,
          editorialReviewStatus: "unreviewed",
          lastEditedBy: creatorId,
        },
      });

      const wfBeforeSelect = story.workflowState;

      const updatedStory = await tx.story.update({
        where: { id: storyId },
        data: {
          workflowState: "ready_for_edit",
          title: selectedFrame.titleCandidate.slice(0, 500),
          summary: selectedFrame.summaryCandidate.slice(0, 2000),
          lens: selectedFrame.lensCandidate.slice(0, 8000),
        },
        select: { workflowState: true },
      });

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId: story.id,
        fromState: wfBeforeSelect,
        toState: updatedStory.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "frames_select",
      });

      await tx.creatorFrameSelectIdempotency.create({
        data: {
          creatorId,
          storyId,
          requestKey: idempotencyKey,
          selectedFrameId: selectedFrame.id,
        },
      });

      const briefRow = await tx.storyBrief.findUniqueOrThrow({ where: { id: brief.id } });

      return {
        storyId: story.id,
        storyState: updatedStory.workflowState,
        storyDraft,
        selectedFrame,
        idempotencyReplayed: false,
        storyBrief: this.stories.briefToResponsePayload(briefRow),
      };
    });
  }

  private async loadSelectOutcomeForReplay(
    tx: Prisma.TransactionClient,
    params: { storyId: string; creatorId: string; selectedFrameId: string },
  ): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    storyDraft: StoryDraft;
    selectedFrame: StoryFrameDraft;
    idempotencyReplayed: boolean;
    storyBrief: Record<string, unknown>;
  }> {
    const { storyId, creatorId, selectedFrameId } = params;

    const story = await tx.story.findFirst({
      where: { id: storyId, creatorId },
      include: {
        storyBrief: {
          include: { storyDraft: true },
        },
      },
    });

    if (!story?.storyBrief?.storyDraft) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "idempotency_replay_inconsistent",
          message: "Stored idempotency record does not match current story draft state",
        },
      });
    }

    const draft = story.storyBrief.storyDraft;
    if (draft.selectedFrameId !== selectedFrameId) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "idempotency_replay_inconsistent",
          message: "Story draft does not match idempotency record",
        },
      });
    }

    const selectedFrame = await tx.storyFrameDraft.findFirst({
      where: { id: selectedFrameId, storyBriefId: story.storyBrief.id },
    });

    if (!selectedFrame) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "idempotency_replay_inconsistent",
          message: "Selected frame row missing for replay",
        },
      });
    }

    const briefRow = await tx.storyBrief.findUniqueOrThrow({ where: { id: story.storyBrief.id } });

    return {
      storyId: story.id,
      storyState: story.workflowState,
      storyDraft: draft,
      selectedFrame,
      idempotencyReplayed: true,
      storyBrief: this.stories.briefToResponsePayload(briefRow),
    };
  }

  /**
   * Generate framing candidates from latest brief snapshot (mutation §10.1).
   * M5-T10: when AI runtime transport is available, calls live model with brief + research synthesis + honesty context;
   * otherwise persists an honest deterministic fallback with the same `story_frame_draft` rows.
   */
  async generateFramingOptions(params: {
    storyId: string;
    creatorId: string;
    dto: GenerateFramesDto;
  }): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    frameDrafts: StoryFrameDraft[];
    reusedExisting: boolean;
    aiFramingGeneration: AiFramingGenerationPackageV1 | null;
  }> {
    const { storyId, creatorId, dto } = params;
    const replace = dto.replace_existing_unselected_frames === true;

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

    if (!ALLOWED_WORKFLOW_FOR_GENERATE.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Framing generation is not allowed in the current workflow state",
          details: { story_state: story.workflowState },
        },
      });
    }

    const brief = story.storyBrief;

    const existingProposed = await this.prisma.storyFrameDraft.findMany({
      where: {
        storyBriefId: brief.id,
        status: "proposed",
        isSelected: false,
      },
      orderBy: { candidateRank: "asc" },
    });

    if (!replace && existingProposed.length > 0) {
      return {
        storyId: story.id,
        storyState: story.workflowState,
        frameDrafts: existingProposed,
        reusedExisting: true,
        aiFramingGeneration: (brief.aiFramingGenerationPackage as AiFramingGenerationPackageV1 | null) ?? null,
      };
    }

    if (replace && existingProposed.length > 0) {
      await this.prisma.storyFrameDraft.updateMany({
        where: {
          storyBriefId: brief.id,
          status: "proposed",
          isSelected: false,
        },
        data: { status: "superseded" },
      });
    }

    const maxRank = await this.prisma.storyFrameDraft.aggregate({
      where: { storyBriefId: brief.id },
      _max: { candidateRank: true },
    });
    const startRank = (maxRank._max.candidateRank ?? 0) + 1;

    const batch = await this.buildFramingBatch({
      storyId,
      brief,
      dto,
      startRank,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.storyFrameDraft.createMany({
        data: batch.seeds.map(
          (s): Prisma.StoryFrameDraftCreateManyInput => ({
            ...s,
            storyBriefId: brief.id,
          }),
        ),
      });

      const created = await tx.storyFrameDraft.findMany({
        where: {
          storyBriefId: brief.id,
          candidateRank: { gte: startRank, lt: startRank + OPTION_COUNT },
          status: "proposed",
        },
        orderBy: { candidateRank: "asc" },
      });

      const wfBeforeGenerate = story.workflowState;

      const updatedStory = await tx.story.update({
        where: { id: storyId },
        data: { workflowState: "awaiting_framing_choice" },
        select: { workflowState: true },
      });

      await tx.storyBrief.update({
        where: { id: brief.id },
        data: {
          aiFramingGenerationPackage: batch.package as unknown as Prisma.InputJsonValue,
        },
      });

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId: story.id,
        fromState: wfBeforeGenerate,
        toState: updatedStory.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "frames_generate",
      });

      return {
        storyId: story.id,
        storyState: updatedStory.workflowState,
        frameDrafts: created,
        reusedExisting: false,
        aiFramingGeneration: batch.package,
      };
    });
  }

  private async buildFramingBatch(params: {
    storyId: string;
    brief: StoryBrief;
    dto: GenerateFramesDto;
    startRank: number;
  }): Promise<{
    seeds: Omit<Prisma.StoryFrameDraftCreateManyInput, "storyBriefId">[];
    package: AiFramingGenerationPackageV1;
  }> {
    const grounding = await loadFramingResearchGrounding(this.prisma, params.storyId);
    const cfg = this.aiRuntime.getSnapshot();
    const port = this.aiRuntime.getTextGenerationPort();

    const base = (): Pick<
      AiFramingGenerationPackageV1,
      | "schema_version"
      | "prompt_template_key"
      | "prompt_version"
      | "provider"
      | "story_id"
      | "research_job_id"
      | "not_publishable_framing_note"
      | "honesty_context"
      | "generated_at"
    > => ({
      schema_version: AI_FRAMING_GENERATION_SCHEMA_VERSION,
      prompt_template_key: FRAMING_PROMPT_TEMPLATE_KEY,
      prompt_version: "1.0.1",
      provider: cfg.provider === "none" ? "none" : cfg.provider,
      story_id: params.storyId,
      research_job_id: grounding.research_job_id,
      not_publishable_framing_note: NOT_PUBLISHABLE_FRAMING_NOTE,
      honesty_context: grounding.honesty_summary,
      generated_at: new Date().toISOString(),
    });

    const detSeeds = this.buildFrameSeeds(params.brief, params.dto.notes, params.startRank);

    try {
      if (port.implementationId !== "openai_compatible_http_v1") {
        throw new Error("ai_transport_unavailable");
      }
      const def = getCanonicalPromptTemplate({ key: FRAMING_PROMPT_TEMPLATE_KEY });
      const variables: Record<string, string> = {
        subject: params.brief.subject.trim().slice(0, 400),
        story_type: String(params.brief.storyType),
        research_brief: params.brief.researchBrief.trim().slice(0, 6000),
        desired_angle: params.brief.desiredAngle.trim().slice(0, 3000),
        creator_notes: params.dto.notes?.trim().slice(0, 1500) ?? "(none)",
        research_synthesis_excerpt:
          grounding.research_synthesis_excerpt.trim().length > 0
            ? grounding.research_synthesis_excerpt
            : "(no research_synthesis_package yet — rely on brief only; do not invent sources.)",
        research_synthesis_structured_brief:
          grounding.research_synthesis_structured_brief.trim().length > 0
            ? grounding.research_synthesis_structured_brief
            : "(no structured synthesis brief yet — use JSON excerpt + brief only.)",
        research_honesty_json: JSON.stringify(grounding.honesty_summary).slice(0, 8000),
      };
      const rendered = renderPromptTemplate(def, variables);
      const ctx = applyPromptAuditToInvocationContext(
        { purpose: "framing_generation", storyId: params.storyId },
        rendered.audit,
      );
      const completion = await port.completeChat({ messages: rendered.messages, context: ctx });
      const parsed = parseFramingOptionsFromLlmJson(completion.text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const picked = parsed.options.slice(0, OPTION_COUNT);
      if (picked.length < OPTION_COUNT) {
        throw new Error("llm_insufficient_framing_options");
      }
      const seeds = this.mapAiOptionsToSeeds(picked, params.startRank);
      const partialPackage: AiFramingGenerationPackageV1 = {
        ...base(),
        generation_mode: "live_ai_backed",
        status: "succeeded",
        model: completion.providerModelLabel ?? null,
        framing_options: picked,
        failure: null,
      };
      const framing_quality_assessment = assessAiFramingGenerationQuality({
        pkg: partialPackage,
        researchSynthesisExcerpt: grounding.research_synthesis_excerpt,
        researchBriefText: params.brief.researchBrief,
      });
      return {
        seeds,
        package: { ...partialPackage, framing_quality_assessment },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const options = this.mapDeterministicSeedsToFramingOptions(detSeeds, params.startRank);
      const partialPackage: AiFramingGenerationPackageV1 = {
        ...base(),
        generation_mode: "deterministic_scaffolding_fallback",
        status: "fallback_deterministic",
        model: null,
        framing_options: options,
        failure: {
          code: "framing_live_generation_unavailable",
          message: msg.slice(0, 2000),
        },
      };
      const framing_quality_assessment = assessAiFramingGenerationQuality({
        pkg: partialPackage,
        researchSynthesisExcerpt: grounding.research_synthesis_excerpt,
        researchBriefText: params.brief.researchBrief,
      });
      return {
        seeds: detSeeds,
        package: { ...partialPackage, framing_quality_assessment },
      };
    }
  }

  private mapAiOptionsToSeeds(
    options: AiFramingGenerationOption[],
    startRank: number,
  ): Omit<Prisma.StoryFrameDraftCreateManyInput, "storyBriefId">[] {
    return options.map((o, i) => {
      const body = [o.angle_description, o.narrative_emphasis].filter(Boolean).join("\n\n");
      const coverage = o.grounding_refs.map((g) => g.label ?? g.kind);
      return {
        titleCandidate: o.title.slice(0, 500),
        subtitleCandidate: null,
        summaryCandidate: body.slice(0, 8000),
        lensCandidate: o.angle_description.slice(0, 8000),
        scopeRationale: o.narrative_emphasis.slice(0, 8000),
        coverageImplications: coverage.length > 0 ? coverage : ["Framing guidance"],
        balanceNote: o.caution_note,
        confidenceSummaryInitial: "mixed",
        candidateRank: startRank + i,
        isSelected: false,
        selectionSource: "ai_proposed" as const,
        status: "proposed" as const,
      };
    });
  }

  private mapDeterministicSeedsToFramingOptions(
    seeds: Omit<Prisma.StoryFrameDraftCreateManyInput, "storyBriefId">[],
    startRank: number,
  ): AiFramingGenerationOption[] {
    return seeds.map((s, i) => ({
      id: `deterministic:${startRank + i}`,
      title: String(s.titleCandidate).slice(0, 500),
      angle_description: String(s.summaryCandidate).slice(0, 2000),
      narrative_emphasis: String(s.scopeRationale).slice(0, 2000),
      caution_note:
        "Deterministic Storywall scaffolding frame (live model call did not complete for this run). Treat as non-authoritative.",
      grounding_refs: [],
    }));
  }

  private buildFrameSeeds(
    brief: StoryBrief,
    notes: string | undefined,
    startRank: number,
  ): Omit<Prisma.StoryFrameDraftCreateManyInput, "storyBriefId">[] {
    const subj = brief.subject.trim().slice(0, 300);
    const research = brief.researchBrief.trim().slice(0, 4000);
    const angle = brief.desiredAngle.trim().slice(0, 2000);
    const noteSuffix = notes?.trim()
      ? ` Creator notes for generation: ${notes.trim().slice(0, 500)}`
      : "";

    const variants: Array<{
      title: string;
      subtitle: string | null;
      summary: string;
      lens: string;
      scope: string;
      coverage: string[];
      balance: string | null;
      confidence: "mostly_verified" | "mixed" | "emerging";
    }> = [
      {
        title: `${subj}: a chronology-first Storywall`,
        subtitle: "Timeline backbone",
        summary: `A grounded, time-ordered telling of ${subj}, anchored in ${research.slice(0, 400)}${research.length > 400 ? "…" : ""}`,
        lens: `Readers see how events unfold in sequence and how that sequence supports: ${angle.slice(0, 400)}${angle.length > 400 ? "…" : ""}.${noteSuffix}`,
        scope: `This frame prioritizes verifiable dates and developments; breadth follows the stated time scope (${String(brief.timeScopeMode)}).`,
        coverage: ["Chronology", "Major developments", "Supporting context"],
        balance:
          brief.storyType === "controversy" || brief.storyType === "issue_history"
            ? "Alternate viewpoints may need explicit treatment before publish."
            : null,
        confidence: "mostly_verified",
      },
      {
        title: `${subj} — forces and context`,
        subtitle: "Explanatory lens",
        summary: `Explains ${subj} with emphasis on causal context and significance, starting from: ${research.slice(0, 400)}${research.length > 400 ? "…" : ""}`,
        lens: `Centers interpretation on: ${angle.slice(0, 500)}${angle.length > 500 ? "…" : ""}.${noteSuffix}`,
        scope: "Selects developments that best explain outcomes and trade breadth for explanatory clarity where needed.",
        coverage: ["Causation", "Stakeholders", "Turning points"],
        balance: null,
        confidence: "mixed",
      },
      {
        title: `${subj}: evidence-forward narrative`,
        subtitle: "Sources and claims",
        summary: `Frames ${subj} around what can be documented from available material, using the creator brief: ${research.slice(0, 400)}${research.length > 400 ? "…" : ""}`,
        lens: `Stress-tests the angle against what sources can support: ${angle.slice(0, 500)}${angle.length > 500 ? "…" : ""}.${noteSuffix}`,
        scope: "Prioritizes events and claims that can be tied to references; flags thin patches for later research.",
        coverage: ["Reference-ready beats", "Confidence posture", "Gaps to fill"],
        balance: "Where accounts diverge, the draft should surface dispute explicitly.",
        confidence: "emerging",
      },
    ];

    return variants.map((v, i) => ({
      titleCandidate: v.title.slice(0, 500),
      subtitleCandidate: v.subtitle,
      summaryCandidate: v.summary,
      lensCandidate: v.lens,
      scopeRationale: v.scope,
      coverageImplications: v.coverage,
      balanceNote: v.balance,
      confidenceSummaryInitial: v.confidence,
      candidateRank: startRank + i,
      isSelected: false,
      selectionSource: "ai_proposed" as const,
      status: "proposed" as const,
    }));
  }
}
