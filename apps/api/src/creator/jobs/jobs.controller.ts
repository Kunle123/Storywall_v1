import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { ResearchService } from "../research/research.service";

/** Mutation contract §6 — poll long-running jobs (`GET /creator/jobs/:jobId`). */
@Controller("api/v1/creator/jobs")
@UseGuards(AuthGuard("jwt"))
export class JobsController {
  constructor(private readonly research: ResearchService) {}

  @Get(":jobId")
  async getJob(
    @Param("jobId") jobId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    const { job, storyId } = await this.research.getResearchJobForCreator(jobId, creator.id);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data: {
        job_id: job.id,
        kind: "research_run",
        status: job.status,
        story_id: storyId,
        mode: job.mode,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString() ?? null,
        finished_at: job.finishedAt?.toISOString() ?? null,
        error_message: job.errorMessage,
      },
    };
  }
}
