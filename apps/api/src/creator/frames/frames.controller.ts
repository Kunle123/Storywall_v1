import { Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { OwnershipService } from "../ownership.service";
import { GenerateFramesDto } from "./dto/generate-frames.dto";
import { storyFrameDraftToApi } from "./frame-draft-to-api";
import { FramesService } from "./frames.service";

/**
 * Framing commands — mutation contract §10 (`POST .../frames/generate`).
 * M1-T11: generate + persist framing candidates (no selection UI here — M1-T12).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class FramesController {
  constructor(
    private readonly frames: FramesService,
    private readonly ownership: OwnershipService,
  ) {}

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
}
