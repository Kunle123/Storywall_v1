import { createHash } from "node:crypto";
import type { AiChatMessage, AiInvocationContext } from "../types";
import { PromptTemplateRenderError } from "./errors";
import type {
  AiPromptExecutionAuditMetadata,
  AiPromptTemplateRenderResult,
  CanonicalPromptTemplateDefinition,
} from "./model";

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/** Deterministic fingerprint: sorted names with UTF-8 byte lengths only (no raw values). */
export function buildVariableShapeFingerprintSha256(variables: Record<string, string>): string {
  const names = Object.keys(variables).sort();
  const payload: [string, number][] = names.map((k) => [k, utf8ByteLength(variables[k]!)]);
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_m, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      throw new PromptTemplateRenderError(
        "missing_variables",
        `Missing value for placeholder {{${name}}}`,
        { name },
      );
    }
    return variables[name]!;
  });
}

function validateVariableMap(
  def: CanonicalPromptTemplateDefinition,
  variables: Record<string, string>,
  strictExtraKeys: boolean,
): void {
  const declared = new Set(def.variable_names);
  const missing: string[] = [];
  for (const name of def.variable_names) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      missing.push(name);
      continue;
    }
    const v = variables[name];
    if (typeof v !== "string") {
      missing.push(name);
    }
  }

  const extra: string[] = [];
  if (strictExtraKeys) {
    for (const k of Object.keys(variables)) {
      if (!declared.has(k)) {
        extra.push(k);
      }
    }
  }

  if (missing.length > 0) {
    throw new PromptTemplateRenderError("missing_variables", "Missing or invalid template variables.", {
      missing,
    });
  }
  if (extra.length > 0) {
    throw new PromptTemplateRenderError("extra_variables", "Unexpected extra template variables.", { extra });
  }
}

/**
 * Deterministic render: optional system message first, then user. Same inputs → same messages and audit fingerprint.
 */
export function renderPromptTemplate(
  definition: CanonicalPromptTemplateDefinition,
  variables: Record<string, string>,
  options?: { strictExtraKeys?: boolean },
): AiPromptTemplateRenderResult {
  const strictExtraKeys = options?.strictExtraKeys ?? true;
  validateVariableMap(definition, variables, strictExtraKeys);

  const messages: AiChatMessage[] = [];
  if (definition.system !== undefined && definition.system.trim().length > 0) {
    messages.push({ role: "system", content: interpolate(definition.system, variables) });
  }
  messages.push({ role: "user", content: interpolate(definition.user, variables) });

  const variables_bound_sorted = [...definition.variable_names].sort() as readonly string[];
  const variable_shape_fingerprint_sha256 = buildVariableShapeFingerprintSha256(
    Object.fromEntries(definition.variable_names.map((k) => [k, variables[k]!])),
  );

  const audit: AiPromptExecutionAuditMetadata = {
    family: definition.family,
    prompt_key: definition.key,
    prompt_version: definition.version,
    variables_bound_sorted,
    variable_shape_fingerprint_sha256,
  };

  return { messages, audit };
}

/** Merge audit identifiers into invocation context for telemetry / transport (M5-T03+). */
export function applyPromptAuditToInvocationContext(
  context: AiInvocationContext,
  audit: AiPromptExecutionAuditMetadata,
): AiInvocationContext {
  return {
    ...context,
    promptTemplateKey: audit.prompt_key,
    promptTemplateVersion: audit.prompt_version,
    promptVersion: audit.prompt_version,
  };
}
