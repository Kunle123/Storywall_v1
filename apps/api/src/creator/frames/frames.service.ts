import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type CreatorWorkflowState,
  Prisma,
  type StoryBrief,
  type StoryDraft,
  type StoryFrameDraft,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { GenerateFramesDto } from "./dto/generate-frames.dto";
import type { SelectFrameDto } from "./dto/select-frame.dto";

const ALLOWED_WORKFLOW_FOR_GENERATE: CreatorWorkflowState[] = [
  "drafting_brief",
  "awaiting_framing_choice",
];

/** M1-T11: deterministic mock framing (2–4 options). No external AI call. */
const OPTION_COUNT = 3;

@Injectable()
export class FramesService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET list — minimal read for framing chooser (M1-T12); not full workspace. */
  async listFrames(storyId: string, creatorId: string): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    frameDrafts: StoryFrameDraft[];
  }> {
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
    const frameDrafts = await this.prisma.storyFrameDraft.findMany({
      where: { storyBriefId: story.storyBrief.id },
      orderBy: { candidateRank: "asc" },
    });
    return {
      storyId: story.id,
      storyState: story.workflowState,
      frameDrafts,
    };
  }

  /**
   * Mutation §10.2 — allowed from `awaiting_framing_choice` only.
   * Creates `story_draft` shell from selected frame (editor §9 + §10); sets workflow `ready_for_edit`.
   */
  async selectFrame(params: {
    storyId: string;
    creatorId: string;
    dto: SelectFrameDto;
  }): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    storyDraft: StoryDraft;
    selectedFrame: StoryFrameDraft;
  }> {
    const { storyId, creatorId, dto } = params;

    return this.prisma.$transaction(async (tx) => {
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

      return {
        storyId: story.id,
        storyState: updatedStory.workflowState,
        storyDraft,
        selectedFrame,
      };
    });
  }

  /**
   * Generate framing candidates from latest brief snapshot (mutation §10.1).
   * Synchronous persistence — no job queue in M1-T11.
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
  }> {
    const { storyId, creatorId, dto } = params;
    const replace = dto.replace_existing_unselected_frames === true;

    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
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

      const existingProposed = await tx.storyFrameDraft.findMany({
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
        };
      }

      if (replace && existingProposed.length > 0) {
        await tx.storyFrameDraft.updateMany({
          where: {
            storyBriefId: brief.id,
            status: "proposed",
            isSelected: false,
          },
          data: { status: "superseded" },
        });
      }

      const maxRank = await tx.storyFrameDraft.aggregate({
        where: { storyBriefId: brief.id },
        _max: { candidateRank: true },
      });
      const startRank = (maxRank._max.candidateRank ?? 0) + 1;

      const seeds = this.buildFrameSeeds(brief, dto.notes, startRank);

      await tx.storyFrameDraft.createMany({
        data: seeds.map(
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

      const updatedStory = await tx.story.update({
        where: { id: storyId },
        data: { workflowState: "awaiting_framing_choice" },
        select: { workflowState: true },
      });

      return {
        storyId: story.id,
        storyState: updatedStory.workflowState,
        frameDrafts: created,
        reusedExisting: false,
      };
    });
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
