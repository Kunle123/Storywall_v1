import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { AiRuntimeService } from "../ai-runtime/ai-runtime.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Railway / load-balancer liveness: GET /health (no DB — cheap probe).
 * Readiness: GET /health/ready — validates DATABASE_URL / migration framework (M1-T01).
 * Public read envelope field names align with docs (generated_at, api_version).
 */
@Controller("health")
export class HealthController {
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
        database: "reachable",
        ai_runtime: this.aiRuntime.getHealthSummary(),
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: "storywall-api",
        api_version: API_CONTRACT_VERSION,
        generated_at: new Date().toISOString(),
        database: "unreachable",
      });
    }
  }
}
