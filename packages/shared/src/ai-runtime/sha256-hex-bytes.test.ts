import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256HexFromBytes, sha256HexUtf8 } from "./sha256-hex-bytes";

describe("sha256HexUtf8 / sha256HexFromBytes", () => {
  it("matches Node crypto for UTF-8 strings", () => {
    const samples = ["", "test", "éclair", '{"a":1}'];
    for (const s of samples) {
      const want = createHash("sha256").update(s, "utf8").digest("hex");
      expect(sha256HexUtf8(s)).toBe(want);
    }
  });

  it("matches Node crypto for arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 255, 1, 2, 3, 4, 5]);
    const want = createHash("sha256").update(bytes).digest("hex");
    expect(sha256HexFromBytes(bytes)).toBe(want);
  });
});
