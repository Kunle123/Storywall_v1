import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CreatorJobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mutation §6 — poll `GET /creator/jobs/:jobId` for research or draft-assembly jobs. */
  async pollJob(jobId: string, creatorId: string): Promise<{
    job_id: string;
    kind: "research_run" | "draft_assemble";
    status: string;
    story_id: string;
    mode: string;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
  }> {
    const research = await this.prisma.researchJob.findFirst({
      where: { id: jobId, story: { creatorId } },
      include: { story: { select: { id: true } } },
    });
    if (research) {
      return {
        job_id: research.id,
        kind: "research_run",
        status: research.status,
        story_id: research.story.id,
        mode: research.mode,
        created_at: research.createdAt.toISOString(),
        started_at: research.startedAt?.toISOString() ?? null,
        finished_at: research.finishedAt?.toISOString() ?? null,
        error_message: research.errorMessage,
      };
    }

    const draft = await this.prisma.draftAssemblyJob.findFirst({
      where: { id: jobId, story: { creatorId } },
      include: { story: { select: { id: true } } },
    });
    if (draft) {
      return {
        job_id: draft.id,
        kind: "draft_assemble",
        status: draft.status,
        story_id: draft.story.id,
        mode: draft.mode,
        created_at: draft.createdAt.toISOString(),
        started_at: draft.startedAt?.toISOString() ?? null,
        finished_at: draft.finishedAt?.toISOString() ?? null,
        error_message: draft.errorMessage,
      };
    }

    const rExists = await this.prisma.researchJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    const dExists = await this.prisma.draftAssemblyJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!rExists && !dExists) {
      throw new NotFoundException({
        ok: false,
        error: { code: "job_not_found", message: "Job not found" },
      });
    }
    throw new ForbiddenException({
      ok: false,
      error: { code: "forbidden", message: "Actor cannot access this job" },
    });
  }
}
