import { Module } from "@nestjs/common";
import { AiRuntimeModule } from "../../ai-runtime/ai-runtime.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { StoriesModule } from "../stories/stories.module";
import { FramesController } from "./frames.controller";
import { FramesService } from "./frames.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule, AiRuntimeModule, StoriesModule],
  controllers: [FramesController],
  providers: [FramesService],
  exports: [FramesService],
})
export class FramesModule {}
