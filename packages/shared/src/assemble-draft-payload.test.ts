import { describe, expect, it } from "vitest";
import { stableAssembleDraftPayload } from "./assemble-draft-payload";

describe("stableAssembleDraftPayload", () => {
  it("is deterministic for matching inputs", () => {
    const a = stableAssembleDraftPayload({
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
    });
    const b = stableAssembleDraftPayload({
      mode: "full_regeneration",
      preserve_creator_notes: true,
      preserve_manual_event_positions: false,
      preserve_approved_images: true,
    });
    expect(a).toEqual(b);
  });
});
