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
import { AssembleDraftDto } from "./dto/assemble-draft.dto";
import { DraftAssemblyService } from "./draft-assembly.service";

const IDEMPOTENCY_KEY_MAX = 255;

function normalizeAssembleIdempotencyKey(raw: string | undefined): string {
  if (raw === undefined || raw === null) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for draft assembly (mutation §11.2)",
      },
    });
  }
  const t = raw.trim();
  if (!t) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for draft assembly (mutation §11.2)",
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
export class DraftAssemblyController {
  constructor(
    private readonly draftAssembly: DraftAssemblyService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Mutation §11.2 — async full draft assembly. */
  @Post(":storyId/draft/assemble")
  async assemble(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: AssembleDraftDto,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const idempotencyKey = normalizeAssembleIdempotencyKey(idempotencyKeyHeader);
    const result = await this.draftAssembly.startDraftAssembly({
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
          kind: "draft_assemble",
        },
        ...(result.idempotencyReplayed ? { idempotency_replayed: true as const } : {}),
      },
    };
  }
}
