import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorModule } from "../creator.module";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorModule],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
