import { describe, expect, it } from "vitest";
import {
  normalizeAssembleDraftPayloadFromStored,
  stableAssembleDraftPayload,
} from "./assemble-draft-payload";

describe("stableAssembleDraftPayload", () => {
  it("is deterministic for matching inputs", () => {
    const a = stableAssembleDraftPayload({
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
      scoped_event_id: null,
      scoped_section_id: null,
    });
    const b = stableAssembleDraftPayload({
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
    });
    expect(a).toEqual(b);
  });

  it("normalizes legacy stored payloads without scoped ids", () => {
    const legacy = {
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
    };
    const n = normalizeAssembleDraftPayloadFromStored(legacy);
    expect(n).toEqual(
      stableAssembleDraftPayload({
        mode: "full_regeneration",
        preserve_creator_notes: true,
        preserve_manual_event_positions: false,
        preserve_approved_images: true,
      }),
    );
  });
});
