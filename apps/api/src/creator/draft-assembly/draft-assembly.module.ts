import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { ResearchModule } from "../research/research.module";
import { DraftAssemblyController } from "./draft-assembly.controller";
import { DraftAssemblyService } from "./draft-assembly.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule, ResearchModule],
  controllers: [DraftAssemblyController],
  providers: [DraftAssemblyService],
  exports: [DraftAssemblyService],
})
export class DraftAssemblyModule {}
