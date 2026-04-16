import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PublicStoriesController } from "./public-stories.controller";
import { PublicStoriesService } from "./public-stories.service";

@Module({
  imports: [PrismaModule],
  controllers: [PublicStoriesController],
  providers: [PublicStoriesService],
})
export class PublicModule {}
