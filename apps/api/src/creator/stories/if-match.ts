/**
 * Mutation contract §6 — `If-Match` with last `story_brief.updated_at` (ISO 8601).
 * Accepts weak ETag form `W/"..."` per RFC 7232.
 */
export function normalizeIfMatchHeader(header: string | undefined): string | null {
  if (header === undefined || header.trim() === "") {
    return null;
  }
  let v = header.trim();
  if (v.startsWith("W/")) {
    v = v.slice(2).trim();
  }
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}
