import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  AiCallRateLimiter,
  createAiTextGenerationPort,
  createTelemetrySinkFromEnv,
  formatAiRuntimeBootstrapLogLine,
  formatBoundedRetrievalBootstrapLine,
  formatPromptTemplateRegistryBootstrapLine,
  getPromptTemplateRegistrySchemaId,
  listRegisteredPromptTemplateRefs,
  parseAiRuntimeConfigFromEnv,
  parseBoundedRetrievalPolicyFromEnv,
  type AiRuntimeConfigSnapshot,
  type AiRuntimeTelemetrySink,
  type AiTextGenerationPort,
  type BoundedRetrievalPolicy,
  type StorywallPromptRegistrySchemaId,
} from "@storywall/shared";

/**
 * Nest-facing singleton for AI runtime configuration, operational policy, telemetry sink, and port.
 * M5-T01: port boundary. M5-T02: policy + telemetry. M5-T03: shared prompt registry (still no transport).
 */
@Injectable()
export class AiRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(AiRuntimeService.name);
  private readonly snapshot: AiRuntimeConfigSnapshot;
  private readonly sink: AiRuntimeTelemetrySink;
  private readonly limiter: AiCallRateLimiter;
  private readonly port: AiTextGenerationPort;

  constructor() {
    this.snapshot = parseAiRuntimeConfigFromEnv(process.env);
    this.sink = createTelemetrySinkFromEnv(process.env);
    this.limiter = new AiCallRateLimiter(this.snapshot.operational);
    this.port = createAiTextGenerationPort({
      config: this.snapshot,
      limiter: this.limiter,
      sink: this.sink,
    });
  }

  onModuleInit(): void {
    this.logger.log(formatAiRuntimeBootstrapLogLine(this.snapshot));
    this.logger.log(formatPromptTemplateRegistryBootstrapLine());
    this.logger.log(formatBoundedRetrievalBootstrapLine(parseBoundedRetrievalPolicyFromEnv(process.env)));
  }

  getSnapshot(): AiRuntimeConfigSnapshot {
    return this.snapshot;
  }

  /** For tests or admin tooling — resets in-process rate window only. */
  resetRateLimiterForTests(): void {
    this.limiter.resetForTests();
  }

  getTelemetrySink(): AiRuntimeTelemetrySink {
    return this.sink;
  }

  /** Shared port — callers must handle disabled / misconfigured / policy / not-implemented errors. */
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
    telemetry_sink: AiRuntimeConfigSnapshot["telemetry_sink"];
    policy: {
      enforcement: AiRuntimeConfigSnapshot["operational"]["enforcement"];
      timeout_ms: number;
      max_retries: number;
      max_calls_per_window: number;
      window_ms: number;
    };
    execution_available: false;
    transport: "not_implemented_m5_t03";
    prompt_registry: {
      schema: StorywallPromptRegistrySchemaId;
      registered_count: number;
    };
    retrieval: { mode: BoundedRetrievalPolicy["mode"] };
  } {
    const o = this.snapshot.operational;
    const refs = listRegisteredPromptTemplateRefs();
    const retrievalPolicy = parseBoundedRetrievalPolicyFromEnv(process.env);
    return {
      surface: this.snapshot.surface,
      provider: this.snapshot.provider,
      credentials_configured: this.snapshot.apiKeyPresent,
      base_url_configured: Boolean(this.snapshot.baseUrl),
      default_model_configured: Boolean(this.snapshot.defaultModel),
      telemetry_sink: this.snapshot.telemetry_sink,
      policy: {
        enforcement: o.enforcement,
        timeout_ms: o.timeoutMs,
        max_retries: o.maxRetries,
        max_calls_per_window: o.maxCallsPerWindow,
        window_ms: o.windowMs,
      },
      execution_available: false,
      transport: "not_implemented_m5_t03",
      prompt_registry: {
        schema: getPromptTemplateRegistrySchemaId(),
        registered_count: refs.length,
      },
      retrieval: { mode: retrievalPolicy.mode },
    };
  }
}
