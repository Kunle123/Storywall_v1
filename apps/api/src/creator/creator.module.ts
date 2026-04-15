import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CreatorController } from "./creator.controller";
import { OwnershipService } from "./ownership.service";
import { WorkflowTransitionService } from "./workflow-transition.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreatorController],
  providers: [OwnershipService, WorkflowTransitionService],
  exports: [OwnershipService, WorkflowTransitionService],
})
export class CreatorModule {}
