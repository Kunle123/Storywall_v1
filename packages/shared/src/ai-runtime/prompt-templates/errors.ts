export type PromptTemplateRenderErrorCode =
  | "missing_variables"
  | "extra_variables"
  | "contract_placeholder_mismatch"
  | "unknown_template"
  | "version_mismatch";

/**
 * Thrown when a template cannot be rendered or resolved safely.
 * Never includes variable values in `message` or `details`.
 */
export class PromptTemplateRenderError extends Error {
  readonly name = "PromptTemplateRenderError";

  constructor(
    readonly code: PromptTemplateRenderErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }
}
