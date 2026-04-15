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
import { CreateEventDto } from "./dto/create-event.dto";
import { PatchEventDto } from "./dto/patch-event.dto";
import { EventsService } from "./events.service";

/**
 * Event drafts — mutation contract §14 (`POST/GET/PATCH …/events`).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(":storyId/events")
  async list(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { events, storyState } = await this.events.listEvents({
      storyId,
      creatorId: creator.id,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        events: events.map((e) => this.events.eventToResponsePayload(e)),
        story_state: storyState,
      },
    };
  }

  @Post(":storyId/events")
  async create(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: CreateEventDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { event, storyState } = await this.events.createEvent({
      storyId,
      creatorId: creator.id,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        event_draft: this.events.eventToResponsePayload(event),
        story_state: storyState,
      },
    };
  }

  @Patch(":storyId/events/:eventId")
  async patch(
    @Param("storyId") storyId: string,
    @Param("eventId") eventId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
    @Body() body: PatchEventDto,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const { event, storyState } = await this.events.patchEvent({
      storyId,
      creatorId: creator.id,
      eventId,
      ifMatchRaw: ifMatch,
      dto: body,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        event_draft: this.events.eventToResponsePayload(event),
        story_state: storyState,
      },
      meta: {
        saved_at: event.updatedAt.toISOString(),
      },
    };
  }
}
