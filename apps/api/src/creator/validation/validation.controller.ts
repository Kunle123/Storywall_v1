import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { OwnershipService } from "../ownership.service";
import { RunValidationDto } from "./dto/run-validation.dto";
import { ValidationService } from "./validation.service";

const IDEMPOTENCY_KEY_MAX = 255;

function normalizeValidationIdempotencyKey(raw: string | undefined): string {
  if (raw === undefined || raw === null) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for validation run (mutation §17.1)",
      },
    });
  }
  const t = raw.trim();
  if (!t) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for validation run (mutation §17.1)",
      },
    });
  }
  if (t.length > IDEMPOTENCY_KEY_MAX) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_invalid",
        message: `Idempotency-Key must be at most ${IDEMPOTENCY_KEY_MAX} characters`,
      },
    });
  }
  return t;
}

@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class ValidationController {
  constructor(
    private readonly validation: ValidationService,
    private readonly ownership: OwnershipService,
  ) {}

  /** M3-T04 — latest validation snapshot for editorial UI (supporting read; complements mutation §17). */
  @Get(":storyId/validation/latest")
  async latest(@Param("storyId") storyId: string, @CurrentCreator() creator: AuthenticatedCreator) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const r = await this.validation.getLatestValidation({ storyId, creatorId: creator.id });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_state: r.storyState,
        has_validation_run: r.hasValidationRun,
        validation_report: r.validationReport
          ? {
              id: r.validationReport.id,
              run_type: r.validationReport.runType,
              run_source: r.validationReport.runSource,
              overall_result: r.validationReport.overallResult,
              issue_count_total: r.validationReport.issueCountTotal,
              blocker_count: r.validationReport.blockerCount,
              warning_count: r.validationReport.warningCount,
              summary_note: r.validationReport.summaryNote,
              created_at: r.validationReport.createdAt.toISOString(),
              created_by: r.validationReport.createdBy,
            }
          : null,
        issues: r.issues.map((i) => ({
          id: i.id,
          object_type: i.objectType,
          object_id: i.objectId,
          issue_type: i.issueType,
          severity: i.severity,
          publish_effect: i.publishEffect,
          explanation: i.explanation,
          suggested_fix: i.suggestedFix,
          resolution_status: i.resolutionStatus,
          event_label: i.eventLabel,
        })),
      },
    };
  }

  /** Mutation §17.1 */
  @Post(":storyId/validation/run")
  async run(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: RunValidationDto,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const idempotencyKey = normalizeValidationIdempotencyKey(idempotencyKeyHeader);
    const result = await this.validation.runValidation({
      storyId,
      creatorId: creator.id,
      dto: body,
      idempotencyKey,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        validation_report_id: result.validationReportId,
        overall_result: result.overallResult,
        blocker_count: result.blockerCount,
        warning_count: result.warningCount,
        story_state: result.storyState,
      },
      meta: {
        idempotency_key: idempotencyKey,
        ...(result.idempotencyReplayed ? { idempotency_replayed: true as const } : {}),
      },
    };
  }
}
