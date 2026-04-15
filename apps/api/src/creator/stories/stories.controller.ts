import {
  Body,
  Controller,
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
import { CreateStoryDto } from "./dto/create-story.dto";
import { PatchStoryBriefDto } from "./dto/patch-story-brief.dto";
import { PatchStoryDraftDto } from "./dto/patch-story-draft.dto";
import { StoriesService } from "./stories.service";

/**
 * Creator story workspace — mutation contract §9 (`POST /api/v1/creator/stories`).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: CreateStoryDto,
  ) {
    const { story, storyBrief, storyState } = await this.stories.createStoryWorkspace(
      creator.id,
      body,
    );
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_id: story.id,
        slug: story.slug,
        story_brief: this.stories.briefToResponsePayload(storyBrief),
        story_state: storyState,
      },
    };
  }

  /**
   * Autosave brief — mutation §9.2, §6 (`If-Match` = last `story_brief.updated_at`).
   */
  @Patch(":storyId/brief")
  async patchBrief(
    @Param("storyId") storyId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: PatchStoryBriefDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { storyBrief, storyState } = await this.stories.patchStoryBrief({
      storyId,
      creatorId: creator.id,
      ifMatchRaw: ifMatch,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_brief: this.stories.briefToResponsePayload(storyBrief),
        story_state: storyState,
      },
      meta: {
        saved_at: storyBrief.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Autosave story draft — mutation §12.1 (`If-Match` = last `story_draft.last_edited_at`).
   */
  @Patch(":storyId/draft")
  async patchDraft(
    @Param("storyId") storyId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: PatchStoryDraftDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { storyDraft, storyState } = await this.stories.patchStoryDraft({
      storyId,
      creatorId: creator.id,
      ifMatchRaw: ifMatch,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        story_draft: this.stories.draftToResponsePayload(storyDraft),
        story_state: storyState,
      },
      meta: {
        saved_at: storyDraft.lastEditedAt.toISOString(),
      },
    };
  }
}
