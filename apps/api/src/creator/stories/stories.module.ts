import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { RevisionsController } from "../revision/revisions.controller";
import { RevisionsService } from "../revision/revisions.service";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule],
  controllers: [StoriesController, RevisionsController],
  providers: [StoriesService, RevisionsService],
  exports: [StoriesService],
})
export class StoriesModule {}
