import { Controller, Get, Param } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { PublicStoriesService } from "./public-stories.service";

/** M3-T08 — unauthenticated published story read by slug. */
@Controller("api/v1/stories")
export class PublicStoriesController {
  constructor(private readonly stories: PublicStoriesService) {}

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const data = await this.stories.getPublishedBySlug(slug);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data,
    };
  }
}
