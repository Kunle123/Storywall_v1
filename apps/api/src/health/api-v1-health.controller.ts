import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { AiRuntimeService } from "../ai-runtime/ai-runtime.service";
import { deployMetaForHealth } from "./deploy-meta";
import { PrismaService } from "../prisma/prisma.service";

/**
 * M5-T16 — public API contract: `GET /api/v1/health` mirrors `GET /health` (same truthful payload).
 * Railway liveness may continue to use `/health`; this path exists for versioned clients and baselines.
 */
@Controller("api/v1/health")
export class ApiV1HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRuntime: AiRuntimeService,
  ) {}

  @Get()
  getHealth() {
    return {
      ok: true,
      service: "storywall-api",
      api_version: API_CONTRACT_VERSION,
      generated_at: new Date().toISOString(),
      deployment: deployMetaForHealth(),
      ai_runtime: this.aiRuntime.getHealthSummary(),
    };
  }

  @Get("ready")
  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        service: "storywall-api",
        api_version: API_CONTRACT_VERSION,
        generated_at: new Date().toISOString(),
        deployment: deployMetaForHealth(),
        database: "reachable",
        ai_runtime: this.aiRuntime.getHealthSummary(),
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: "storywall-api",
        api_version: API_CONTRACT_VERSION,
        generated_at: new Date().toISOString(),
        deployment: deployMetaForHealth(),
        database: "unreachable",
      });
    }
  }
}
