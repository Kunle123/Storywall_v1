import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CreatorModule } from "./creator/creator.module";
import { FramesModule } from "./creator/frames/frames.module";
import { StoriesModule } from "./creator/stories/stories.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, CreatorModule, StoriesModule, FramesModule],
})
export class AppModule {}
