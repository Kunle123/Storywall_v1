/**
 * M2-T05 — stable JSON for `POST …/draft/assemble` idempotency comparison (mutation §6 / §11.2).
 */

export type AssembleDraftPayloadInput = {
  mode: string;
  preserve_creator_notes: boolean;
  preserve_manual_event_positions: boolean;
  preserve_approved_images: boolean;
};

export function stableAssembleDraftPayload(input: AssembleDraftPayloadInput): Record<string, unknown> {
  return {
    mode: input.mode,
    preserve_creator_notes: input.preserve_creator_notes,
    preserve_manual_event_positions: input.preserve_manual_event_positions,
    preserve_approved_images: input.preserve_approved_images,
  };
}
