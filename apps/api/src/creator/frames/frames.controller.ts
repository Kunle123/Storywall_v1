import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { OwnershipService } from "../ownership.service";
import { GenerateFramesDto } from "./dto/generate-frames.dto";
import { SelectFrameDto } from "./dto/select-frame.dto";
import { storyFrameDraftToApi } from "./frame-draft-to-api";
import { storyDraftToApi } from "./story-draft-to-api";
import { FramesService } from "./frames.service";

const IDEMPOTENCY_KEY_MAX = 255;

function normalizeFrameSelectIdempotencyKey(raw: string | undefined): string {
  if (raw === undefined || raw === null) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for frame selection (mutation §10.2)",
      },
    });
  }
  const t = raw.trim();
  if (!t) {
    throw new BadRequestException({
      ok: false,
      error: {
        code: "idempotency_key_required",
        message: "Idempotency-Key header is required for frame selection (mutation §10.2)",
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

/**
 * Framing commands — mutation contract §10 (`POST .../frames/generate`, `.../select`).
 * M1-T11: generate. M1-T12: list + select + `story_draft` shell.
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class FramesController {
  constructor(
    private readonly frames: FramesService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Minimal read for framing chooser (not full workspace GET). */
  @Get(":storyId/frames")
  async list(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const result = await this.frames.listFrames(storyId, creator.id);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_id: result.storyId,
        story_state: result.storyState,
        story_lifecycle_status: result.storyLifecycleStatus,
        published_at: result.publishedAt ? result.publishedAt.toISOString() : null,
        story_slug: result.storySlug,
        frame_drafts: result.frameDrafts.map((f) => storyFrameDraftToApi(f)),
        story_draft: result.storyDraft ? storyDraftToApi(result.storyDraft) : null,
      },
    };
  }

  @Post(":storyId/frames/generate")
  async generate(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: GenerateFramesDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const result = await this.frames.generateFramingOptions({
      storyId,
      creatorId: creator.id,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_id: result.storyId,
        story_state: result.storyState,
        frame_drafts: result.frameDrafts.map((f) => storyFrameDraftToApi(f)),
      },
      meta: {
        reused_existing: result.reusedExisting,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    };
  }

  @Post(":storyId/frames/select")
  async select(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: SelectFrameDto,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const idempotencyKey = normalizeFrameSelectIdempotencyKey(idempotencyKeyHeader);
    const result = await this.frames.selectFrame({
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
        selected_frame_id: result.selectedFrame.id,
        story_draft: storyDraftToApi(result.storyDraft),
        frame_draft: storyFrameDraftToApi(result.selectedFrame),
      },
      meta: {
        idempotency_key: idempotencyKey,
        ...(result.idempotencyReplayed ? { idempotency_replayed: true as const } : {}),
      },
    };
  }
}
