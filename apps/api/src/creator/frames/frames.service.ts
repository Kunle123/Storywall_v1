import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type CreatorWorkflowState,
  Prisma,
  type StoryBrief,
  type StoryFrameDraft,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { GenerateFramesDto } from "./dto/generate-frames.dto";

const ALLOWED_WORKFLOW_FOR_GENERATE: CreatorWorkflowState[] = [
  "drafting_brief",
  "awaiting_framing_choice",
];

/** M1-T11: deterministic mock framing (2–4 options). No external AI call. */
const OPTION_COUNT = 3;


@Injectable()
export class FramesService {
  constructor(private readonly prisma: PrismaService) {}

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
