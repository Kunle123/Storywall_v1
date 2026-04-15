/**
 * M2-T05 / M2-T12 — stable JSON for `POST …/draft/assemble` idempotency comparison (mutation §6 / §11.2).
 */

export type AssembleDraftPayloadInput = {
  mode: string;
  preserve_creator_notes: boolean;
  preserve_manual_event_positions: boolean;
  preserve_approved_images: boolean;
  scoped_event_id?: string | null;
  scoped_section_id?: string | null;
};

export function stableAssembleDraftPayload(input: AssembleDraftPayloadInput): Record<string, unknown> {
  return {
    mode: input.mode,
    preserve_creator_notes: input.preserve_creator_notes,
    preserve_manual_event_positions: input.preserve_manual_event_positions,
    preserve_approved_images: input.preserve_approved_images,
    scoped_event_id: input.scoped_event_id ?? null,
    scoped_section_id: input.scoped_section_id ?? null,
  };
}

/** Normalize stored JSON so older rows without scoped ids still match new payloads. */
export function normalizeAssembleDraftPayloadFromStored(stored: Record<string, unknown>): Record<string, unknown> {
  return stableAssembleDraftPayload({
    mode: String(stored.mode ?? ""),
    preserve_creator_notes: Boolean(stored.preserve_creator_notes),
    preserve_manual_event_positions: Boolean(stored.preserve_manual_event_positions),
    preserve_approved_images: Boolean(stored.preserve_approved_images),
    scoped_event_id: typeof stored.scoped_event_id === "string" ? stored.scoped_event_id : null,
    scoped_section_id: typeof stored.scoped_section_id === "string" ? stored.scoped_section_id : null,
  });
}
