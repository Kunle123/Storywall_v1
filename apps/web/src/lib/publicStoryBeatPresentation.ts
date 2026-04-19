import type { PublicStoryEvent } from "../api/publicTypes";

/** Layout band derived only from existing event fields (length, labels, refs) — not a quality judgment. */
export type PublicBeatBand = "focal" | "standard" | "compact";

export type PublicBeatPositionRole = "first" | "last" | "middle";

export type PublicBeatPresentation = {
  band: PublicBeatBand;
  positionRole: PublicBeatPositionRole;
};

function materialScore(ev: PublicStoryEvent): number {
  let s = (ev.summary ?? "").trim().length;
  if ((ev.dek ?? "").trim()) s += 45;
  if ((ev.context_label ?? "").trim()) s += 35;
  if ((ev.location_name ?? "").trim()) s += 20;
  s += (ev.references?.length ?? 0) * 30;
  if (ev.primary_image?.url) s += 42;
  return s;
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Per-event presentation hints for reader layout: where the published row carries more
 * supporting material vs lighter beats, using only snapshot fields.
 */
export function computeBeatPresentations(events: PublicStoryEvent[]): PublicBeatPresentation[] {
  const n = events.length;
  if (n === 0) return [];

  const scores = events.map(materialScore);
  const sorted = [...scores].sort((a, b) => a - b);
  const allEqual = sorted.length > 0 && sorted[0] === sorted[sorted.length - 1];
  const med = medianSorted(sorted);

  return events.map((_, i) => {
    const positionRole: PublicBeatPositionRole = i === 0 ? "first" : i === n - 1 ? "last" : "middle";

    if (n <= 3 || allEqual) {
      return { band: "standard" as const, positionRole };
    }

    let band: PublicBeatBand;
    const sc = scores[i]!;
    if (sc > med) band = "focal";
    else if (sc < med) band = "compact";
    else band = "standard";

    if (band === "compact" && (positionRole === "first" || positionRole === "last")) {
      band = "standard";
    }

    return { band, positionRole };
  });
}
