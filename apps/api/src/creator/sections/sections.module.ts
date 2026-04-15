import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { SectionsController } from "./sections.controller";
import { SectionsService } from "./sections.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
