import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { JobsController } from "../jobs/jobs.controller";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";
import { RESEARCH_QUEUE_TOKEN } from "./research.tokens";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule],
  controllers: [ResearchController, JobsController],
  providers: [
    ResearchService,
    {
      provide: RESEARCH_QUEUE_TOKEN,
      useFactory: () => {
        const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
        const connection = new IORedis(url, { maxRetriesPerRequest: null });
        return new Queue("storywall-default", { connection });
      },
    },
  ],
  exports: [ResearchService],
})
export class ResearchModule {}
