import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreatorWorkflowState,
  ValidationOverallResult,
  ValidationRunType,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkflowTransitionService } from "../workflow-transition.service";
import type { RunValidationDto } from "./dto/run-validation.dto";
import {
  buildSummaryNote,
  collectSkeletonValidationIssues,
  countByPublishEffect,
  deriveOverallResult,
  type SkeletonDraftSnapshot,
} from "./validation-skeleton.engine";

const ALLOWED_VALIDATION_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "needs_validation",
  "blocked",
  "ready_to_publish",
];

const RUN_TYPE_MAP: Record<string, ValidationRunType> = {
  structure: "structure",
  trust: "trust",
  style: "style",
  publish_readiness: "publish_readiness",
  full: "full",
};

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowTransitions: WorkflowTransitionService,
  ) {}

  async runValidation(params: {
    storyId: string;
    creatorId: string;
    dto: RunValidationDto;
    idempotencyKey: string;
  }): Promise<{
    validationReportId: string;
    overallResult: ValidationOverallResult;
    blockerCount: number;
    warningCount: number;
    storyState: CreatorWorkflowState;
    idempotencyReplayed: boolean;
  }> {
    const { storyId, creatorId, dto, idempotencyKey } = params;
    const runType = RUN_TYPE_MAP[dto.run_type];
    if (!runType) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "Invalid run_type",
          details: { run_type: dto.run_type },
        },
      });
    }

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

      const existingIdem = await tx.creatorValidationRunIdempotency.findUnique({
        where: {
          creatorId_storyId_requestKey: {
            creatorId,
            storyId,
            requestKey: idempotencyKey,
          },
        },
        include: {
          validationReport: true,
        },
      });

      if (existingIdem) {
        const r = existingIdem.validationReport;
        return {
          kind: "replay" as const,
          validationReportId: r.id,
          overallResult: r.overallResult,
          blockerCount: r.blockerCount,
          warningCount: r.warningCount,
          storyState: existingIdem.acceptedResponseStoryState,
        };
      }

      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: {
          storyBrief: {
            include: {
              storyDraft: {
                include: {
                  sectionDrafts: { select: { id: true } },
                  eventDrafts: {
                    select: {
                      id: true,
                      sources: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!story?.storyBrief?.storyDraft) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or draft not found" },
        });
      }

      if (!ALLOWED_VALIDATION_STATES.includes(story.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Validation is not allowed in the current workflow state",
            details: { story_state: story.workflowState },
          },
        });
      }

      const draft = story.storyBrief.storyDraft;
      const sections = draft.sectionDrafts;
      const events = draft.eventDrafts;
      const snapshot: SkeletonDraftSnapshot = {
        storyDraftId: draft.id,
        title: draft.title,
        summary: draft.summary,
        lens: draft.lens,
        conclusion: draft.conclusion,
        sectionCount: sections.length,
        eventCount: events.length,
        events: events.map((e) => ({
          id: e.id,
          sourceCount: e.sources.length,
        })),
      };

      const skeletonIssues = collectSkeletonValidationIssues(snapshot, runType);
      const overallResult = deriveOverallResult(skeletonIssues);
      const { blockers, warnings } = countByPublishEffect(skeletonIssues);
      const issueCountTotal = skeletonIssues.length;
      const summaryNote = buildSummaryNote(overallResult, issueCountTotal, blockers, warnings);

      const wfBefore = story.workflowState;
      const wfAfter: CreatorWorkflowState =
        overallResult === "block" ? "blocked" : "ready_to_publish";

      const report = await tx.validationReport.create({
        data: {
          storyDraftId: draft.id,
          runType,
          runSource: "creator_requested",
          overallResult,
          issueCountTotal,
          blockerCount: blockers,
          warningCount: warnings,
          summaryNote,
          createdBy: creatorId,
        },
      });

      if (skeletonIssues.length > 0) {
        await tx.validationIssue.createMany({
          data: skeletonIssues.map((i) => ({
            validationReportId: report.id,
            objectType: i.objectType,
            objectId: i.objectId,
            issueType: i.issueType,
            severity: i.severity,
            publishEffect: i.publishEffect,
            explanation: i.explanation,
            suggestedFix: i.suggestedFix ?? null,
            resolutionStatus: "open" as const,
          })),
        });
      }

      await tx.draftTrustMetadata.upsert({
        where: { storyDraftId: draft.id },
        create: {
          storyDraftId: draft.id,
          latestValidationReportId: report.id,
          lastOverallResult: overallResult,
          lastBlockerCount: blockers,
          lastWarningCount: warnings,
        },
        update: {
          latestValidationReportId: report.id,
          lastOverallResult: overallResult,
          lastBlockerCount: blockers,
          lastWarningCount: warnings,
        },
      });

      const updated = await tx.story.update({
        where: { id: storyId },
        data: { workflowState: wfAfter },
        select: { workflowState: true },
      });

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId,
        fromState: wfBefore,
        toState: updated.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "validation_run",
      });

      await tx.creatorValidationRunIdempotency.create({
        data: {
          creatorId,
          storyId,
          requestKey: idempotencyKey,
          validationReportId: report.id,
          acceptedResponseStoryState: updated.workflowState,
        },
      });

      return {
        kind: "new" as const,
        validationReportId: report.id,
        overallResult,
        blockerCount: blockers,
        warningCount: warnings,
        storyState: updated.workflowState,
      };
    });

    if (txResult.kind === "replay") {
      return {
        validationReportId: txResult.validationReportId,
        overallResult: txResult.overallResult,
        blockerCount: txResult.blockerCount,
        warningCount: txResult.warningCount,
        storyState: txResult.storyState,
        idempotencyReplayed: true,
      };
    }

    return {
      validationReportId: txResult.validationReportId,
      overallResult: txResult.overallResult,
      blockerCount: txResult.blockerCount,
      warningCount: txResult.warningCount,
      storyState: txResult.storyState,
      idempotencyReplayed: false,
    };
  }
}
