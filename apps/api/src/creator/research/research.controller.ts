import {
  BadRequestException,
  Body,
  Controller,
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
import { RunResearchPassDto } from "./dto/run-research-pass.dto";
import { ResearchService } from "./research.service";

const IDEMPOTENCY_KEY_MAX = 255;

function normalizeResearchIdempotencyKey(raw: string | undefined): string {
  if (raw === undefined || raw === null) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for research run (mutation §11.1)",
      },
    });
  }
  const t = raw.trim();
  if (!t) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for research run (mutation §11.1)",
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
export class ResearchController {
  constructor(
    private readonly research: ResearchService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Mutation §11.1 — async research pass (M2-T01 orchestration stub; artifacts M2-T02). */
  @Post(":storyId/research/run")
  async run(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: RunResearchPassDto,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const idempotencyKey = normalizeResearchIdempotencyKey(idempotencyKeyHeader);
    const result = await this.research.startResearchPass({
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
        story_id: result.storyId,
        story_state: result.storyState,
        job_id: result.jobId,
        job_status: result.jobStatus,
      },
      meta: {
        idempotency_key: idempotencyKey,
        async_job: {
          job_id: result.jobId,
          kind: "research_run",
        },
        ...(result.idempotencyReplayed ? { idempotency_replayed: true as const } : {}),
      },
    };
  }
}
