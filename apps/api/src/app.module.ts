import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CreatorModule } from "./creator/creator.module";
import { FramesModule } from "./creator/frames/frames.module";
import { DraftAssemblyModule } from "./creator/draft-assembly/draft-assembly.module";
import { ResearchModule } from "./creator/research/research.module";
import { StoriesModule } from "./creator/stories/stories.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    CreatorModule,
    StoriesModule,
    FramesModule,
    ResearchModule,
    DraftAssemblyModule,
  ],
})
export class AppModule {}
