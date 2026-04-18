import { Controller, Get, Param, Query } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { PublicStoriesService } from "./public-stories.service";

/** M3-T08 + M3-T09 + M3-T10 + M3-T11 + M3-T12 — unauthenticated published story read by slug (prefers frozen snapshot). */
@Controller("api/v1/stories")
export class PublicStoriesController {
  constructor(private readonly stories: PublicStoriesService) {}

  /** M5-T27 — public discovery list; must stay before parametric `:slug` routes. */
  @Get("discover")
  async discover(@Query("limit") limitRaw?: string) {
    let limit = 50;
    if (limitRaw !== undefined && limitRaw !== "") {
      const n = Number.parseInt(limitRaw, 10);
      if (!Number.isNaN(n)) {
        limit = n;
      }
    }
    const data = await this.stories.listPublicDiscoverableStories({ limit });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data,
    };
  }

  @Get(":slug/references")
  async getReferencesBySlug(@Param("slug") slug: string) {
    const data = await this.stories.getPublishedReferencesBySlug(slug);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data,
    };
  }

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
