import { Module } from "@nestjs/common";
import { ApiV1HealthController } from "./api-v1-health.controller";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController, ApiV1HealthController],
})
export class HealthModule {}
