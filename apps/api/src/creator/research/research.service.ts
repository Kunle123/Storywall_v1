import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

      if (!ALLOWED_PRE_RESEARCH.includes(storyRow.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Research run is not allowed in the current workflow state",
            details: { story_state: storyRow.workflowState },
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
}
