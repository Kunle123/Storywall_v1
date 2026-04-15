import { Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { OwnershipService } from "../ownership.service";
import { RevisionsService } from "./revisions.service";

/**
 * M2-T13 — revision history and recovery (mutation contract supporting reads; editor §17).
 */
@Controller("api/v1/creator/stories")
@UseGuards(AuthGuard("jwt"))
export class RevisionsController {
  constructor(
    private readonly revisions: RevisionsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(":storyId/revisions")
  async list(
    @Param("storyId") storyId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const result = await this.revisions.listRevisions({ storyId, creatorId: creator.id });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        revisions: result.revisions,
        story_state: result.storyState,
      },
    };
  }

  /**
   * Restore `recovery_snapshot` from a revision. `If-Match` must be the **current**
   * version token of the object being overwritten (story draft `last_edited_at`, or
   * section/event/source `updated_at` as ISO 8601).
   */
  @Post(":storyId/revisions/:revisionId/restore")
  async restore(
    @Param("storyId") storyId: string,
    @Param("revisionId") revisionId: string,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    await this.ownership.assertOwnsStory(storyId, creator.id);
    const result = await this.revisions.restoreRevision({
      storyId,
      creatorId: creator.id,
      revisionId,
      ifMatchRaw: ifMatch,
    });
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        restored_from_revision_id: result.restored_from_revision_id,
        revision: result.revision,
        story_state: result.story_state,
      },
    };
  }
}
