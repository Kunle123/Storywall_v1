import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  createAiTextGenerationPort,
  formatAiRuntimeBootstrapLogLine,
  parseAiRuntimeConfigFromEnv,
  type AiRuntimeConfigSnapshot,
  type AiTextGenerationPort,
} from "@storywall/shared";

/**
 * Nest-facing singleton for AI runtime configuration and the shared generation port.
 * M5-T01: port is always non-executable; later tickets add transport behind the same interface.
 */
@Injectable()
export class AiRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(AiRuntimeService.name);
  private readonly snapshot: AiRuntimeConfigSnapshot;
  private readonly port: AiTextGenerationPort;

  constructor() {
    this.snapshot = parseAiRuntimeConfigFromEnv(process.env);
    this.port = createAiTextGenerationPort(this.snapshot);
  }

  onModuleInit(): void {
    this.logger.log(formatAiRuntimeBootstrapLogLine(this.snapshot));
  }

  getSnapshot(): AiRuntimeConfigSnapshot {
    return this.snapshot;
  }

  /** Shared port — callers must handle disabled / misconfigured / not-implemented errors. */
  getTextGenerationPort(): AiTextGenerationPort {
    return this.port;
  }

  /**
   * Safe health payload — never exposes secret values.
   * `execution_available` stays false until a later M5 ticket implements transport.
   */
  getHealthSummary(): {
    surface: AiRuntimeConfigSnapshot["surface"];
    provider: AiRuntimeConfigSnapshot["provider"];
    credentials_configured: boolean;
    base_url_configured: boolean;
    default_model_configured: boolean;
    execution_available: false;
    transport: "not_implemented_m5_t01";
  } {
    return {
      surface: this.snapshot.surface,
      provider: this.snapshot.provider,
      credentials_configured: this.snapshot.apiKeyPresent,
      base_url_configured: Boolean(this.snapshot.baseUrl),
      default_model_configured: Boolean(this.snapshot.defaultModel),
      execution_available: false,
      transport: "not_implemented_m5_t01",
    };
  }
}
