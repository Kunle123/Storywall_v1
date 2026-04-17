import type { CanonicalPromptTemplateDefinition } from "./model";
import { PromptTemplateRenderError } from "./errors";

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/** Placeholder names in order of first appearance in `template`. */
export function extractPlaceholderNamesInOrder(template: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  for (const m of template.matchAll(re)) {
    const n = m[1]!;
    if (!seen.has(n)) {
      seen.add(n);
      names.push(n);
    }
  }
  return names;
}

function placeholderSet(template: string): Set<string> {
  return new Set(extractPlaceholderNamesInOrder(template));
}

/**
 * Every `{{var}}` in system/user must appear in `variable_names`, and every declared name must appear in the templates.
 * Keeps templates auditable and prevents silent unused variables.
 */
export function assertPlaceholderContractMatchesDefinition(def: CanonicalPromptTemplateDefinition): void {
  const combined = `${def.system ?? ""}\n${def.user}`;
  const inBody = placeholderSet(combined);
  const declared = new Set(def.variable_names);

  const missingInBody: string[] = [];
  for (const v of def.variable_names) {
    if (!inBody.has(v)) {
      missingInBody.push(v);
    }
  }

  const extraInBody: string[] = [];
  for (const v of inBody) {
    if (!declared.has(v)) {
      extraInBody.push(v);
    }
  }

  if (missingInBody.length > 0 || extraInBody.length > 0) {
    throw new PromptTemplateRenderError(
      "contract_placeholder_mismatch",
      "Prompt template placeholders do not match declared variable_names.",
      { key: def.key, version: def.version, missingInBody, extraInBody },
    );
  }
}
