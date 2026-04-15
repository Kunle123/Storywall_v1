import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { randomUUID } from "node:crypto";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { CurrentCreator } from "../../auth/current-creator.decorator";
import type { AuthenticatedCreator } from "../../auth/types";
import { CreatorJobsService } from "./creator-jobs.service";

/** Mutation contract §6 — poll long-running jobs (`GET /creator/jobs/:jobId`). */
@Controller("api/v1/creator/jobs")
@UseGuards(AuthGuard("jwt"))
export class JobsController {
  constructor(private readonly creatorJobs: CreatorJobsService) {}

  @Get(":jobId")
  async getJob(
    @Param("jobId") jobId: string,
    @CurrentCreator() creator: AuthenticatedCreator,
  ) {
    const data = await this.creatorJobs.pollJob(jobId, creator.id);
    return {
      ok: true,
      request_id: randomUUID(),
      api_version: API_CONTRACT_VERSION,
      data,
    };
  }
}
