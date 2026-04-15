import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DraftAssemblyJob, Prisma } from "@prisma/client";
import {
  type CreatorWorkflowState,
  type DraftAssemblyJobStatus,
  type ResearchJobStatus,
} from "@prisma/client";
import type { Queue } from "bullmq";
import {
  normalizeAssembleDraftPayloadFromStored,
  stableAssembleDraftPayload,
} from "@storywall/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkflowTransitionService } from "../workflow-transition.service";
import type { AssembleDraftDto } from "./dto/assemble-draft.dto";
import { RESEARCH_QUEUE_TOKEN } from "../research/research.tokens";

const ACTIVE_DRAFT: DraftAssemblyJobStatus[] = ["pending", "running"];
const ACTIVE_RESEARCH: ResearchJobStatus[] = ["pending", "running"];

const ALLOWED_ASSEMBLE: CreatorWorkflowState[] = ["awaiting_framing_choice", "ready_for_edit", "blocked"];

const BLOCKED_OVERLAP: CreatorWorkflowState[] = ["researching", "assembling_draft"];

/** First accepted `POST …/draft/assemble` outcome (idempotent replay; mutation §6). */
const ACCEPTED_STORY_STATE: CreatorWorkflowState = "assembling_draft";
const ACCEPTED_JOB_STATUS: DraftAssemblyJobStatus = "pending";

function validateDraftAssembleDto(dto: AssembleDraftDto): void {
  const e = dto.scoped_event_id?.trim() || null;
  const s = dto.scoped_section_id?.trim() || null;
  const hasE = Boolean(e);
  const hasS = Boolean(s);
  if (hasE && hasS) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "invalid_scoped_assemble",
        message: "Specify only one of scoped_event_id or scoped_section_id",
      },
    });
  }
  if (dto.mode === "scoped_event_regeneration") {
    if (!hasE || hasS) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_scoped_assemble",
          message: "scoped_event_regeneration requires scoped_event_id and no scoped_section_id",
        },
      });
    }
  } else if (dto.mode === "scoped_section_regeneration") {
    if (!hasS || hasE) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_scoped_assemble",
          message: "scoped_section_regeneration requires scoped_section_id and no scoped_event_id",
        },
      });
    }
  } else if (dto.mode === "full_regeneration") {
    if (hasE || hasS) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_scoped_assemble",
          message: "full_regeneration must not include scoped_event_id or scoped_section_id",
        },
      });
    }
  }
}

function stablePayload(dto: AssembleDraftDto): Prisma.InputJsonValue {
  return stableAssembleDraftPayload({
    mode: dto.mode,
    preserve_creator_notes: dto.preserve_creator_notes,
    preserve_manual_event_positions: dto.preserve_manual_event_positions,
    preserve_approved_images: dto.preserve_approved_images,
    scoped_event_id: dto.scoped_event_id ?? null,
    scoped_section_id: dto.scoped_section_id ?? null,
  }) as Prisma.InputJsonValue;
}

function payloadMatches(dto: AssembleDraftDto, stored: Prisma.JsonValue | null): boolean {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return false;
  }
  const normalized = normalizeAssembleDraftPayloadFromStored(stored as Record<string, unknown>);
  const next = stableAssembleDraftPayload({
    mode: dto.mode,
    preserve_creator_notes: dto.preserve_creator_notes,
    preserve_manual_event_positions: dto.preserve_manual_event_positions,
    preserve_approved_images: dto.preserve_approved_images,
    scoped_event_id: dto.scoped_event_id ?? null,
    scoped_section_id: dto.scoped_section_id ?? null,
  });
  return JSON.stringify(normalized) === JSON.stringify(next);
}

type StartTxResult =
  | {
      kind: "replay";
      jobId: string;
      storyState: CreatorWorkflowState;
      jobStatus: DraftAssemblyJobStatus;
    }
  | { kind: "new"; job: DraftAssemblyJob; storyState: CreatorWorkflowState };

@Injectable()
export class DraftAssemblyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowTransitions: WorkflowTransitionService,
    @Inject(RESEARCH_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  async startDraftAssembly(params: {
    storyId: string;
    creatorId: string;
    dto: AssembleDraftDto;
    idempotencyKey: string;
  }): Promise<{
    storyId: string;
    storyState: CreatorWorkflowState;
    jobId: string;
    jobStatus: DraftAssemblyJobStatus;
    idempotencyReplayed: boolean;
  }> {
    const { storyId, creatorId, dto, idempotencyKey } = params;

    validateDraftAssembleDto(dto);

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

      const existingIdem = await tx.creatorDraftAssembleIdempotency.findUnique({
        where: {
          creatorId_storyId_requestKey: {
            creatorId,
            storyId,
            requestKey: idempotencyKey,
          },
        },
        include: { draftAssemblyJob: true },
      });

      if (existingIdem) {
        if (!payloadMatches(dto, existingIdem.draftAssemblyJob.requestPayload)) {
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
          jobId: existingIdem.draftAssemblyJobId,
          storyState: existingIdem.acceptedResponseStoryState,
          jobStatus: existingIdem.acceptedResponseJobStatus,
        };
        return out;
      }

      const activeDraft = await tx.draftAssemblyJob.findFirst({
        where: { storyId, status: { in: ACTIVE_DRAFT } },
      });
      if (activeDraft) {
        throw new ConflictException({
          ok: false,
          error: {
            code: "draft_assembly_job_active",
            message: "A draft assembly job is already running or queued for this story",
            details: { job_id: activeDraft.id },
          },
        });
      }

      const activeResearch = await tx.researchJob.findFirst({
        where: { storyId, status: { in: ACTIVE_RESEARCH } },
      });
      if (activeResearch) {
        throw new ConflictException({
          ok: false,
          error: {
            code: "research_job_active",
            message: "A research job is already running; wait for it to finish before assembling the draft",
            details: { job_id: activeResearch.id },
          },
        });
      }

      if (BLOCKED_OVERLAP.includes(storyRow.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Draft assembly is not allowed while another long-running job is active",
            details: { story_state: storyRow.workflowState },
          },
        });
      }

      if (!ALLOWED_ASSEMBLE.includes(storyRow.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Draft assembly is not allowed in the current workflow state",
            details: { story_state: storyRow.workflowState },
          },
        });
      }

      const brief = await tx.storyBrief.findUnique({
        where: { storyId },
        include: { storyDraft: true },
      });
      if (!brief?.storyDraft) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "story_draft_required",
            message: "Approve a framing option before assembling the full draft",
          },
        });
      }

      const storyDraftId = brief.storyDraft.id;

      if (dto.mode === "scoped_section_regeneration") {
        const sec = await tx.sectionDraft.findFirst({
          where: { id: dto.scoped_section_id!, storyDraftId },
        });
        if (!sec) {
          throw new NotFoundException({
            ok: false,
            error: {
              code: "section_not_found",
              message: "Section not found on this story draft",
            },
          });
        }
      }

      let sourceResearchJobId: string | null = null;

      if (dto.mode !== "scoped_section_regeneration") {
        const recentSucceeded = await tx.researchJob.findMany({
          where: {
            storyId,
            status: "succeeded",
          },
          orderBy: { finishedAt: "desc" },
          take: 20,
          include: {
            chronologyAssembly: {
              include: { events: true },
            },
          },
        });

        const latestResearch = recentSucceeded.find(
          (j) =>
            j.chronologyAssembly !== null && j.chronologyAssembly.events.length > 0,
        );

        if (!latestResearch?.chronologyAssembly) {
          throw new BadRequestException({
            ok: false,
            error: {
              code: "chronology_not_ready",
              message:
                "Complete a successful research pass with chronology output before assembling the draft",
            },
          });
        }

        sourceResearchJobId = latestResearch.id;
      }

      if (dto.mode === "scoped_event_regeneration") {
        const ev = await tx.eventDraft.findFirst({
          where: { id: dto.scoped_event_id!, storyDraftId },
        });
        if (!ev) {
          throw new NotFoundException({
            ok: false,
            error: {
              code: "event_not_found",
              message: "Event not found on this story draft",
            },
          });
        }
      }

      const wfBefore = storyRow.workflowState;

      const job = await tx.draftAssemblyJob.create({
        data: {
          storyId,
          creatorId,
          status: "pending",
          mode: dto.mode,
          requestPayload: stablePayload(dto),
          preAssemblyWorkflowState: wfBefore,
          sourceResearchJobId,
        },
      });

      await tx.creatorDraftAssembleIdempotency.create({
        data: {
          creatorId,
          storyId,
          requestKey: idempotencyKey,
          draftAssemblyJobId: job.id,
          acceptedResponseStoryState: ACCEPTED_STORY_STATE,
          acceptedResponseJobStatus: ACCEPTED_JOB_STATUS,
        },
      });

      const updated = await tx.story.update({
        where: { id: storyId },
        data: { workflowState: "assembling_draft" },
        select: { workflowState: true },
      });

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId,
        fromState: wfBefore,
        toState: updated.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "draft_assemble",
      });

      const out: StartTxResult = {
        kind: "new",
        job,
        storyState: updated.workflowState,
      };
      return out;
    });

    if (txResult.kind === "new") {
      await this.queue.add(
        "draft.assemble",
        { draftAssemblyJobId: txResult.job.id },
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

  async getDraftAssemblyJobForCreator(
    jobId: string,
    creatorId: string,
  ): Promise<{ job: DraftAssemblyJob; storyId: string }> {
    const job = await this.prisma.draftAssemblyJob.findFirst({
      where: { id: jobId, story: { creatorId } },
      include: { story: { select: { id: true } } },
    });
    if (!job) {
      const exists = await this.prisma.draftAssemblyJob.findUnique({
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
}
