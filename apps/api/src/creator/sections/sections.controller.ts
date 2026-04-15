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
import { CreateSectionDto } from "./dto/create-section.dto";
import { PatchSectionDto } from "./dto/patch-section.dto";
import { SectionsService } from "./sections.service";

/**
 * Section drafts — mutation contract §13 (`POST/GET/PATCH …/sections`).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class SectionsController {
  constructor(
    private readonly sections: SectionsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(":storyId/sections")
  async list(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { sections, storyState } = await this.sections.listSections({
      storyId,
      creatorId: creator.id,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        sections: sections.map((s) => this.sections.sectionToResponsePayload(s)),
        story_state: storyState,
      },
    };
  }

  @Post(":storyId/sections")
  async create(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: CreateSectionDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { section, storyState } = await this.sections.createSection({
      storyId,
      creatorId: creator.id,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        section_draft: this.sections.sectionToResponsePayload(section),
        story_state: storyState,
      },
    };
  }

  @Patch(":storyId/sections/:sectionId")
  async patch(
    @Param("storyId") storyId: string,
    @Param("sectionId") sectionId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: PatchSectionDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { section, storyState } = await this.sections.patchSection({
      storyId,
      creatorId: creator.id,
      sectionId,
      ifMatchRaw: ifMatch,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        section_draft: this.sections.sectionToResponsePayload(section),
        story_state: storyState,
      },
      meta: {
        saved_at: section.updatedAt.toISOString(),
      },
    };
  }
}
