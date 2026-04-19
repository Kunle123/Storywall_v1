import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ChronologyAssembly,
  ChronologyExtractedEvent,
  ChronologyEventSourceLink,
  ResearchArtifact,
  ResearchCandidateSource,
} from "@prisma/client";
import {
  type CreatorWorkflowState,
  type Prisma,
  type ResearchJob,
  type ResearchJobStatus,
} from "@prisma/client";
import type { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkflowTransitionService } from "../workflow-transition.service";
import type { RunResearchPassDto } from "./dto/run-research-pass.dto";
import { RESEARCH_QUEUE_TOKEN } from "./research.tokens";

const ALLOWED_PRE_RESEARCH: CreatorWorkflowState[] = ["awaiting_framing_choice", "ready_for_edit"];

const ACTIVE: ResearchJobStatus[] = ["pending", "running"];

/** First accepted `POST …/research/run` outcome (idempotent replay; mutation §6). */
const ACCEPTED_STORY_STATE: CreatorWorkflowState = "researching";
const ACCEPTED_JOB_STATUS: ResearchJobStatus = "pending";

function stableRequestPayload(dto: RunResearchPassDto): Prisma.InputJsonValue {
  return {
    mode: dto.mode,
    respect_existing_manual_events: dto.respect_existing_manual_events,
    respect_existing_sources: dto.respect_existing_sources,
    notes: dto.notes ?? null,
  };
}

function payloadMatches(
  dto: RunResearchPassDto,
  stored: Prisma.JsonValue | null,
): boolean {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return false;
  }
  const s = stored as Record<string, unknown>;
  return (
    s.mode === dto.mode &&
    s.respect_existing_manual_events === dto.respect_existing_manual_events &&
    s.respect_existing_sources === dto.respect_existing_sources &&
    (s.notes ?? null) === (dto.notes ?? null)
  );
}

type StartTxResult =
  | {
      kind: "replay";
      jobId: string;
      storyState: CreatorWorkflowState;
      jobStatus: ResearchJobStatus;
    }
  | { kind: "new"; job: ResearchJob; storyState: CreatorWorkflowState };

@Injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowTransitions: WorkflowTransitionService,
    @Inject(RESEARCH_QUEUE_TOKEN) private readonly researchQueue: Queue,
  ) {}

  async startResearchPass(params: {
    storyId: string;
    creatorId: string;
    dto: RunResearchPassDto;
    idempotencyKey: string;
  }): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    jobId: string;
    jobStatus: ResearchJobStatus;
    idempotencyReplayed: boolean;
  }> {
    const { storyId, creatorId, dto, idempotencyKey } = params;

    const txResult = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ ok: number }>>(
        `SELECT 1 AS ok FROM stories WHERE id = $1::uuid AND creator_id = $2::uuid FOR UPDATE`,
        storyId,
        creatorId,
      );
      if (locked.length === 0) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story not found" },
        });
      }

      const storyRow = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        select: { workflowState: true },
      });
      if (!storyRow) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story not found" },
        });
      }

      const existingIdem = await tx.creatorResearchRunIdempotency.findUnique({
        where: {
          creatorId_storyId_requestKey: {
            creatorId,
            storyId,
            requestKey: idempotencyKey,
          },
        },
        include: { researchJob: true },
      });

      if (existingIdem) {
        if (!payloadMatches(dto, existingIdem.researchJob.requestPayload)) {
          throw new ConflictException({
            ok: false,
            error: {
              code: "idempotency_key_mismatch",
              message:
                "This Idempotency-Key was already used with a different request body for this story",
            },
          });
        }
        const out: StartTxResult = {
          kind: "replay",
          jobId: existingIdem.researchJobId,
          storyState: existingIdem.acceptedResponseStoryState,
          jobStatus: existingIdem.acceptedResponseJobStatus,
        };
        return out;
      }

      const activeOther = await tx.researchJob.findFirst({
        where: {
          storyId,
          status: { in: ACTIVE },
        },
      });
      if (activeOther) {
        throw new ConflictException({
          ok: false,
          error: {
            code: "research_job_active",
            message: "A research job is already running or queued for this story",
            details: { job_id: activeOther.id },
          },
        });
      }

      const activeDraftAssembly = await tx.draftAssemblyJob.findFirst({
        where: { storyId, status: { in: ["pending", "running"] } },
      });
      if (activeDraftAssembly) {
        throw new ConflictException({
          ok: false,
          error: {
            code: "draft_assembly_job_active",
            message: "A draft assembly job is running; wait for it to finish before starting research",
            details: { job_id: activeDraftAssembly.id },
          },
        });
      }

      if (!ALLOWED_PRE_RESEARCH.includes(storyRow.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Research run is not allowed in the current workflow state",
            details: {
              story_state: storyRow.workflowState,
              allowed_states: [...ALLOWED_PRE_RESEARCH],
              ...(storyRow.workflowState === "drafting_brief"
                ? {
                    next_creator_step: "frames_generate" as const,
                    next_creator_step_hint:
                      "Call POST /api/v1/creator/stories/:storyId/frames/generate to produce framing candidates; workflow becomes awaiting_framing_choice, then research is allowed.",
                  }
                : {}),
            },
          },
        });
      }

      const wfBefore = storyRow.workflowState;

      const job = await tx.researchJob.create({
        data: {
          storyId,
          status: "pending",
          mode: dto.mode,
          requestPayload: stableRequestPayload(dto),
          preResearchWorkflowState: wfBefore,
        },
      });

      await tx.creatorResearchRunIdempotency.create({
        data: {
          creatorId,
          storyId,
          requestKey: idempotencyKey,
          researchJobId: job.id,
          acceptedResponseStoryState: ACCEPTED_STORY_STATE,
          acceptedResponseJobStatus: ACCEPTED_JOB_STATUS,
        },
      });

      const updated = await tx.story.update({
        where: { id: storyId },
        data: { workflowState: "researching" },
        select: { workflowState: true },
      });

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId,
        fromState: wfBefore,
        toState: updated.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "research_run",
      });

      const out: StartTxResult = {
        kind: "new",
        job,
        storyState: updated.workflowState,
      };
      return out;
    });

    if (txResult.kind === "new") {
      await this.researchQueue.add(
        "research.run",
        { researchJobId: txResult.job.id },
        { jobId: txResult.job.id },
      );
    }

    if (txResult.kind === "replay") {
      return {
        storyId,
        storyState: txResult.storyState,
        jobId: txResult.jobId,
        jobStatus: txResult.jobStatus,
        idempotencyReplayed: true,
      };
    }

    return {
      storyId,
      storyState: txResult.storyState,
      jobId: txResult.job.id,
      jobStatus: txResult.job.status,
      idempotencyReplayed: false,
    };
  }

  async getResearchJobForCreator(jobId: string, creatorId: string): Promise<{
    job: ResearchJob;
    storyId: string;
  }> {
    const job = await this.prisma.researchJob.findFirst({
      where: { id: jobId, story: { creatorId } },
      include: { story: { select: { id: true } } },
    });
    if (!job) {
      const exists = await this.prisma.researchJob.findUnique({
        where: { id: jobId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException({
          ok: false,
          error: { code: "job_not_found", message: "Job not found" },
        });
      }
      throw new ForbiddenException({
        ok: false,
        error: { code: "forbidden", message: "Actor cannot access this job" },
      });
    }
    return { job, storyId: job.story.id };
  }

  /** M2-T02 — durable research package for a succeeded job (creator-owned story). */
  async getResearchPackage(params: {
    storyId: string;
    jobId: string;
    creatorId: string;
  }): Promise<{
    jobStatus: string;
    artifact: ResearchArtifact;
    candidateSources: ResearchCandidateSource[];
    /** M5-T24 — persisted chronology row count for synthesis orchestration / honesty. */
    chronologyEventCount: number;
    /** M5-T26 — lite chronology rows for enrichment materialization assessment (same assembly as M2-T03 GET). */
    chronologyEventsLite: Array<{
      id: string;
      headline: string;
      summary: string;
      contextLabel: string | null;
      eventType: string;
      positionIndex: number;
    }>;
    /** M5-T26 — current story draft shell when present (optional; null before draft exists). */
    manuscriptLite: {
      events: Array<{ headline: string; summary: string; eventType: string; generationMode: string }>;
      sections: Array<{ label: string; summary: string | null; sectionOrigin: string }>;
    } | null;
    /** M5-T11 — persisted live enrichment when its `research_job_id` matches this job. */
    liveEventDraftEnrichment: unknown | null;
    /** M5-T12 — persisted editorial review when its `research_job_id` matches this job. */
    aiEditorialReview: unknown | null;
  }> {
    const { storyId, jobId, creatorId } = params;

    const job = await this.prisma.researchJob.findFirst({
      where: {
        id: jobId,
        storyId,
        story: { creatorId },
      },
      include: {
        artifact: true,
        candidateSources: { orderBy: { positionIndex: "asc" } },
        chronologyAssembly: { select: { _count: { select: { events: true } } } },
      },
    });

    if (!job) {
      throw new NotFoundException({
        ok: false,
        error: { code: "research_job_not_found", message: "Research job not found for this story" },
      });
    }

    if (job.status !== "succeeded") {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "research_package_not_ready",
          message: "Research package is available only after the job succeeds",
          details: { job_status: job.status },
        },
      });
    }

    if (!job.artifact) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "research_package_incomplete",
          message: "Research job succeeded but no artifact row was persisted",
        },
      });
    }

    const briefRow = await this.prisma.storyBrief.findUnique({
      where: { storyId },
      select: {
        aiEventDraftEnrichmentPackage: true,
        aiEditorialReviewPackage: true,
        storyDraft: {
          select: {
            eventDrafts: {
              orderBy: { positionIndex: "asc" },
              select: { headline: true, summary: true, eventType: true, generationMode: true },
            },
            sectionDrafts: {
              orderBy: { positionIndex: "asc" },
              select: { label: true, summary: true, sectionOrigin: true },
            },
          },
        },
      },
    });
    let liveEventDraftEnrichment: unknown | null = null;
    const stored = briefRow?.aiEventDraftEnrichmentPackage;
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      const rjid = (stored as { research_job_id?: string }).research_job_id;
      if (rjid === jobId) {
        liveEventDraftEnrichment = stored;
      }
    }
    let aiEditorialReview: unknown | null = null;
    const storedReview = briefRow?.aiEditorialReviewPackage;
    if (storedReview && typeof storedReview === "object" && !Array.isArray(storedReview)) {
      const rjid = (storedReview as { research_job_id?: string }).research_job_id;
      if (rjid === jobId) {
        aiEditorialReview = storedReview;
      }
    }

    const chronologyEventCount = job.chronologyAssembly?._count.events ?? 0;

    const chronologyEventsLite = await this.prisma.chronologyExtractedEvent.findMany({
      where: { chronologyAssembly: { researchJobId: jobId } },
      orderBy: { positionIndex: "asc" },
      select: {
        id: true,
        headline: true,
        summary: true,
        contextLabel: true,
        eventType: true,
        positionIndex: true,
      },
    });

    let manuscriptLite: {
      events: Array<{ headline: string; summary: string; eventType: string; generationMode: string }>;
      sections: Array<{ label: string; summary: string | null; sectionOrigin: string }>;
    } | null = null;
    const sd = briefRow?.storyDraft;
    if (sd && (sd.eventDrafts.length > 0 || sd.sectionDrafts.length > 0)) {
      manuscriptLite = {
        events: sd.eventDrafts.map((e) => ({
          headline: e.headline,
          summary: e.summary,
          eventType: e.eventType,
          generationMode: e.generationMode,
        })),
        sections: sd.sectionDrafts.map((s) => ({
          label: s.label,
          summary: s.summary,
          sectionOrigin: s.sectionOrigin,
        })),
      };
    }

    return {
      jobStatus: job.status,
      artifact: job.artifact,
      candidateSources: job.candidateSources,
      chronologyEventCount,
      chronologyEventsLite,
      manuscriptLite,
      liveEventDraftEnrichment,
      aiEditorialReview,
    };
  }

  /** M2-T03 / M2-T04 — assembled chronology + corroboration links for a succeeded job (creator-owned story). */
  async getResearchChronology(params: {
    storyId: string;
    jobId: string;
    creatorId: string;
  }): Promise<{
    jobStatus: string;
    assembly: ChronologyAssembly;
    events: Array<
      ChronologyExtractedEvent & {
        sourceLinks: (ChronologyEventSourceLink & {
          researchCandidateSource: ResearchCandidateSource;
        })[];
      }
    >;
  }> {
    const { storyId, jobId, creatorId } = params;

    const job = await this.prisma.researchJob.findFirst({
      where: {
        id: jobId,
        storyId,
        story: { creatorId },
      },
      include: {
        chronologyAssembly: {
          include: {
            events: {
              orderBy: { positionIndex: "asc" },
              include: {
                sourceLinks: {
                  orderBy: { orderingIndex: "asc" },
                  include: { researchCandidateSource: true },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException({
        ok: false,
        error: { code: "research_job_not_found", message: "Research job not found for this story" },
      });
    }

    if (job.status !== "succeeded") {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "chronology_not_ready",
          message: "Chronology is available only after the research job succeeds",
          details: { job_status: job.status },
        },
      });
    }

    if (!job.chronologyAssembly) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "chronology_not_found",
          message: "Research job succeeded but no chronology assembly was persisted",
        },
      });
    }

    return {
      jobStatus: job.status,
      assembly: job.chronologyAssembly,
      events: job.chronologyAssembly.events,
    };
  }
}
