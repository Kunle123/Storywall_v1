import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { OwnershipService } from "../ownership.service";
import { CreateSourceDto } from "./dto/create-source.dto";
import { PatchSourceDto } from "./dto/patch-source.dto";
import { SourcesService } from "./sources.service";

/**
 * Source records — mutation contract §15 (`GET/POST/PATCH …/events/.../sources`).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class SourcesController {
  constructor(
    private readonly sources: SourcesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(":storyId/events/:eventId/sources")
  async list(
    @Param("storyId") storyId: string,
    @Param("eventId") eventId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { sources, storyState } = await this.sources.listSourcesForEvent({
      storyId,
      creatorId: creator.id,
      eventId,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        sources: sources.map((s) => this.sources.sourceToResponsePayload(s)),
        story_state: storyState,
      },
    };
  }

  @Post(":storyId/events/:eventId/sources")
  async create(
    @Param("storyId") storyId: string,
    @Param("eventId") eventId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: CreateSourceDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { source, storyState } = await this.sources.createSource({
      storyId,
      creatorId: creator.id,
      eventId,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        source_record: this.sources.sourceToResponsePayload(source),
        story_state: storyState,
      },
    };
  }

  @Patch(":storyId/events/:eventId/sources/:sourceId")
  async patch(
    @Param("storyId") storyId: string,
    @Param("eventId") eventId: string,
    @Param("sourceId") sourceId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: PatchSourceDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { source, storyState } = await this.sources.patchSource({
      storyId,
      creatorId: creator.id,
      eventId,
      sourceId,
      ifMatchRaw: ifMatch,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        source_record: this.sources.sourceToResponsePayload(source),
        story_state: storyState,
      },
      meta: {
        saved_at: source.updatedAt.toISOString(),
      },
    };
  }
}
