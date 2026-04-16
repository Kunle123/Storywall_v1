import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreatorWorkflowState,
  Prisma,
  ValidationOverallResult,
  ValidationResolutionStatus,
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
import { collectSourceSufficiencyAndReferenceIssues } from "./validation-source-sufficiency.engine";

const ALLOWED_VALIDATION_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "needs_validation",
  "blocked",
  "ready_to_publish",
  /** M4-T09 — post-publish maintenance: run checks before republishing while the story stays live. */
  "published",
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
                      eventType: true,
                      significanceLevel: true,
                      sources: {
                        select: { id: true, isPublic: true, status: true },
                      },
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
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          significanceLevel: e.significanceLevel,
          sources: e.sources.map((s) => ({
            id: s.id,
            isPublic: s.isPublic,
            status: s.status,
          })),
        })),
      };

      const skeletonIssues = [
        ...collectSkeletonValidationIssues(snapshot, runType),
        ...collectSourceSufficiencyAndReferenceIssues(snapshot),
      ];
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

  /**
   * Latest validation snapshot for the story draft (from `draft_trust_metadata` pointer + issues).
   * Empty result when no run yet — not an error.
   */
  async getLatestValidation(params: { storyId: string; creatorId: string }): Promise<{
    storyState: CreatorWorkflowState;
    hasValidationRun: boolean;
    validationReport: null | {
      id: string;
      runType: string;
      runSource: string;
      overallResult: string;
      issueCountTotal: number;
      blockerCount: number;
      warningCount: number;
      summaryNote: string;
      createdAt: Date;
      createdBy: string | null;
    };
    issues: Array<{
      id: string;
      objectType: string;
      objectId: string;
      issueType: string;
      severity: string;
      publishEffect: string;
      explanation: string;
      suggestedFix: string | null;
      resolutionStatus: string;
      eventLabel: string | null;
    }>;
  }> {
    const { storyId, creatorId } = params;

    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      select: {
        workflowState: true,
        storyBrief: {
          select: {
            storyDraft: {
              select: {
                id: true,
                draftTrustMetadata: {
                  select: { latestValidationReportId: true },
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

    const storyDraftId = story.storyBrief.storyDraft.id;
    const reportId = story.storyBrief.storyDraft.draftTrustMetadata?.latestValidationReportId ?? null;

    if (!reportId) {
      return {
        storyState: story.workflowState,
        hasValidationRun: false,
        validationReport: null,
        issues: [],
      };
    }

    const report = await this.prisma.validationReport.findFirst({
      where: { id: reportId, storyDraftId },
      include: {
        issues: { orderBy: { id: "asc" } },
      },
    });

    if (!report) {
      return {
        storyState: story.workflowState,
        hasValidationRun: false,
        validationReport: null,
        issues: [],
      };
    }

    const eventObjectIds = report.issues.filter((i) => i.objectType === "event").map((i) => i.objectId);
    const eventRows =
      eventObjectIds.length > 0
        ? await this.prisma.eventDraft.findMany({
            where: { storyDraftId, id: { in: eventObjectIds } },
            select: { id: true, headline: true },
          })
        : [];
    const headlineByEventId = new Map(eventRows.map((e) => [e.id, e.headline]));

    const issues = report.issues.map((i) => ({
      id: i.id,
      objectType: i.objectType,
      objectId: i.objectId,
      issueType: i.issueType,
      severity: i.severity,
      publishEffect: i.publishEffect,
      explanation: i.explanation,
      suggestedFix: i.suggestedFix,
      resolutionStatus: i.resolutionStatus,
      eventLabel: i.objectType === "event" ? (headlineByEventId.get(i.objectId) ?? null) : null,
    }));

    return {
      storyState: story.workflowState,
      hasValidationRun: true,
      validationReport: {
        id: report.id,
        runType: report.runType,
        runSource: report.runSource,
        overallResult: report.overallResult,
        issueCountTotal: report.issueCountTotal,
        blockerCount: report.blockerCount,
        warningCount: report.warningCount,
        summaryNote: report.summaryNote,
        createdAt: report.createdAt,
        createdBy: report.createdBy,
      },
      issues,
    };
  }

  /**
   * M3-T05 — creator updates `resolution_status` on one issue from the latest validation snapshot only.
   * Does not re-run validation or recompute report aggregates.
   */
  async patchIssueResolution(params: {
    storyId: string;
    issueId: string;
    creatorId: string;
    resolutionStatus: "open" | "resolved";
    idempotencyKey: string;
  }): Promise<{
    issue: {
      id: string;
      objectType: string;
      objectId: string;
      issueType: string;
      severity: string;
      publishEffect: string;
      explanation: string;
      suggestedFix: string | null;
      resolutionStatus: string;
      eventLabel: string | null;
    };
    idempotencyReplayed: boolean;
  }> {
    const { storyId, issueId, creatorId, resolutionStatus, idempotencyKey } = params;
    const targetStatus: ValidationResolutionStatus = resolutionStatus === "resolved" ? "resolved" : "open";

    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        select: {
          storyBrief: {
            select: {
              storyDraft: {
                select: {
                  id: true,
                  draftTrustMetadata: { select: { latestValidationReportId: true } },
                },
              },
            },
          },
        },
      });

      const storyDraftId = story?.storyBrief?.storyDraft?.id ?? null;
      const latestReportId = story?.storyBrief?.storyDraft?.draftTrustMetadata?.latestValidationReportId ?? null;

      if (!storyDraftId || !latestReportId) {
        throw new NotFoundException({
          ok: false,
          error: { code: "validation_issue_not_found", message: "No latest validation snapshot for this story" },
        });
      }

      const issue = await tx.validationIssue.findFirst({
        where: { id: issueId, validationReportId: latestReportId },
        include: { validationReport: { select: { storyDraftId: true } } },
      });

      if (!issue || issue.validationReport.storyDraftId !== storyDraftId) {
        throw new NotFoundException({
          ok: false,
          error: { code: "validation_issue_not_found", message: "Validation issue not found on latest snapshot" },
        });
      }

      const existingIdem = await tx.creatorValidationIssueResolutionIdempotency.findFirst({
        where: {
          creatorId,
          storyId,
          validationIssueId: issueId,
          requestKey: idempotencyKey,
        },
      });

      if (existingIdem) {
        if (existingIdem.acceptedResolutionStatus !== targetStatus) {
          throw new ConflictException({
            ok: false,
            error: {
              code: "idempotency_key_mismatch",
              message:
                "This Idempotency-Key was already used with a different resolution payload for this issue",
            },
          });
        }
        const fresh = await tx.validationIssue.findUniqueOrThrow({ where: { id: issueId } });
        return {
          issue: await this.mapSingleIssueRow(tx, storyDraftId, fresh),
          idempotencyReplayed: true,
        };
      }

      const now = new Date();
      await tx.validationIssue.update({
        where: { id: issueId },
        data:
          targetStatus === "resolved"
            ? {
                resolutionStatus: "resolved",
                resolvedBy: creatorId,
                resolvedAt: now,
              }
            : {
                resolutionStatus: "open",
                resolvedBy: null,
                resolvedAt: null,
              },
      });

      await tx.creatorValidationIssueResolutionIdempotency.create({
        data: {
          creatorId,
          storyId,
          validationIssueId: issueId,
          requestKey: idempotencyKey,
          acceptedResolutionStatus: targetStatus,
        },
      });

      const fresh = await tx.validationIssue.findUniqueOrThrow({ where: { id: issueId } });
      return {
        issue: await this.mapSingleIssueRow(tx, storyDraftId, fresh),
        idempotencyReplayed: false,
      };
    });
  }

  private async mapSingleIssueRow(
    tx: Prisma.TransactionClient,
    storyDraftId: string,
    issue: {
      id: string;
      objectType: string;
      objectId: string;
      issueType: string;
      severity: string;
      publishEffect: string;
      explanation: string;
      suggestedFix: string | null;
      resolutionStatus: string;
    },
  ): Promise<{
    id: string;
    objectType: string;
    objectId: string;
    issueType: string;
    severity: string;
    publishEffect: string;
    explanation: string;
    suggestedFix: string | null;
    resolutionStatus: string;
    eventLabel: string | null;
  }> {
    let eventLabel: string | null = null;
    if (issue.objectType === "event") {
      const ev = await tx.eventDraft.findFirst({
        where: { storyDraftId, id: issue.objectId },
        select: { headline: true },
      });
      eventLabel = ev?.headline ?? null;
    }
    return {
      id: issue.id,
      objectType: issue.objectType,
      objectId: issue.objectId,
      issueType: issue.issueType,
      severity: issue.severity,
      publishEffect: issue.publishEffect,
      explanation: issue.explanation,
      suggestedFix: issue.suggestedFix,
      resolutionStatus: issue.resolutionStatus,
      eventLabel,
    };
  }
}
