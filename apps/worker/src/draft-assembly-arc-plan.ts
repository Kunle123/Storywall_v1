/**
 * Post-canonical draft assembly — arc boundaries, thematic labels from grounded chronology rows,
 * and honest thin-research messaging (deterministic; no new factual claims).
 */
import type { Prisma } from "@prisma/client";
import { parseResearchSynthesisPackageV1, type ResearchSynthesisPackageV1 } from "@storywall/shared";

export type ChronologyEventLite = Prisma.ChronologyExtractedEventGetPayload<{
  include: {
    sourceLinks: { orderBy: { orderingIndex: "asc" }; include: { researchCandidateSource: true } };
  };
}>;

export type ThinAssemblySignals = {
  retrievalModeStub: boolean;
  coverageNotes: string[];
  eventsWithNoSources: number;
  nonTimelineRows: number;
  totalRows: number;
};

export function isPreambleRow(e: ChronologyEventLite): boolean {
  if (e.eventType !== "context_note") return false;
  return (
    e.headline.includes("Chronology coverage") ||
    Boolean(e.contextLabel?.includes("package_preamble")) ||
    Boolean(e.contextLabel?.includes("m5_t06.insufficient"))
  );
}

function pivotalRow(e: ChronologyEventLite): boolean {
  if (isPreambleRow(e)) return false;
  return (
    e.eventType === "turning_point" ||
    e.significanceLevel === "critical" ||
    e.significanceLevel === "major"
  );
}

/** Indices where editorial pivots cluster — used to nudge arc splits toward meaningful beats. */
export function pivotIndices(events: ChronologyEventLite[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < events.length; i++) {
    if (pivotalRow(events[i]!)) out.push(i);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function splitEvenBucketRanges(n: number, k: number): [number, number][] {
  if (k <= 1) return [[0, n]];
  const base = Math.floor(n / k);
  const rem = n % k;
  const ranges: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < rem ? 1 : 0);
    const end = Math.min(n, start + size);
    ranges.push([start, end]);
    start = end;
  }
  return ranges;
}

/** Move split points toward nearby pivotal beats while staying near even pacing. */
export function refineBreakpointsWithPivots(
  evenSplitEnds: number[],
  pivots: number[],
  n: number,
): number[] {
  const maxShift = Math.max(2, Math.floor(n / 8));
  const usedPivot = new Set<number>();
  return evenSplitEnds.map((target) => {
    const clampedTarget = Math.max(1, Math.min(n - 1, target));
    let best = clampedTarget;
    let bestDist = maxShift + 1;
    for (const p of pivots) {
      if (p <= 0 || p >= n || usedPivot.has(p)) continue;
      const d = Math.abs(p - clampedTarget);
      if (d <= maxShift && d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (bestDist <= maxShift && pivots.includes(best)) usedPivot.add(best);
    return best;
  });
}

export function computeArcRanges(n: number, k: number, events: ChronologyEventLite[]): [number, number][] {
  if (k <= 1) return [[0, n]];
  const even = splitEvenBucketRanges(n, k);
  const evenEnds = even.slice(0, -1).map((r) => r[1]);
  const pivots = pivotIndices(events);
  const refined = refineBreakpointsWithPivots(evenEnds, pivots, n);
  refined.sort((a, b) => a - b);
  const fixed: number[] = [];
  let last = 0;
  for (const x of refined) {
    const v = Math.max(last + 1, Math.min(n - 1, x));
    fixed.push(v);
    last = v;
  }
  const edges = [0, ...fixed, n];
  const out: [number, number][] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    out.push([edges[i]!, edges[i + 1]!]);
  }
  return out;
}

/**
 * Section title from the strongest grounded headline in the slice (no generic "Opening beats" prefix).
 */
export function deriveArcLabel(slice: ChronologyEventLite[], storyTitle: string): string {
  const material = slice.filter((e) => !isPreambleRow(e));
  const tp = material.find((e) => e.eventType === "turning_point");
  const major = material.find(
    (e) => e.significanceLevel === "critical" || e.significanceLevel === "major",
  );
  const lead = tp ?? major ?? material[0] ?? slice[0];
  let head = (lead?.headline ?? "Timeline arc").trim();
  if (head.length < 10 && storyTitle.trim()) {
    head = `${storyTitle.trim().slice(0, 72)} — ${head}`.trim();
  }
  return head.slice(0, 200);
}

export function assessThinAssemblySignals(
  events: ChronologyEventLite[],
  synthesisPkg: ResearchSynthesisPackageV1 | null,
): ThinAssemblySignals {
  let eventsWithNoSources = 0;
  let nonTimelineRows = 0;
  for (const e of events) {
    if (e.sourceLinks.length === 0) eventsWithNoSources += 1;
    if (e.eventType === "context_note" || e.eventType === "synthesis") nonTimelineRows += 1;
  }
  return {
    retrievalModeStub: synthesisPkg?.retrieval_mode === "stub",
    coverageNotes: synthesisPkg ? [...synthesisPkg.coverage_notes] : [],
    eventsWithNoSources,
    nonTimelineRows,
    totalRows: events.length,
  };
}

export function shouldAttachThinHonestyBlock(s: ThinAssemblySignals): boolean {
  if (s.retrievalModeStub) return true;
  if (s.totalRows <= 4) return true;
  if (s.eventsWithNoSources >= Math.ceil(s.totalRows * 0.35)) return true;
  return false;
}

export function formatThinHonestyBlock(s: ThinAssemblySignals): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("Research depth note (honest, assembly-generated):");
  lines.push(`- Chronology rows materialized: ${s.totalRows}.`);
  lines.push(`- Rows with no linked source records on this pass: ${s.eventsWithNoSources}.`);
  if (s.nonTimelineRows > 0) {
    lines.push(
      `- Rows flagged as synthesis/context scaffolding (not standalone dated events): ${s.nonTimelineRows}.`,
    );
  }
  if (s.retrievalModeStub) {
    lines.push("- Retrieval mode for this job was **stub** — prose is structural scaffolding, not live-web-grounded.");
  }
  if (s.coverageNotes.length > 0) {
    lines.push(`- Synthesis coverage cues: ${s.coverageNotes.join(" | ").slice(0, 700)}`);
  }
  lines.push(
    "Treat arc titles as starting points from your research package — broaden corroboration before publication.",
  );
  return lines.join("\n");
}

export function buildFirstPassConclusion(
  lens: string | null,
  events: ChronologyEventLite[],
  thin: ThinAssemblySignals,
): string {
  const material = events.filter((e) => e.eventType === "standard" || e.eventType === "turning_point");
  const src = material.length > 0 ? material : events;
  const tail = src.slice(-Math.min(4, src.length));
  const bullets = tail.map((e) => `• ${e.headline.trim().slice(0, 240)}`).join("\n");
  const lensBlock = lens?.trim() ? `Working lens:\n${lens.trim().slice(0, 1500)}\n\n` : "";
  let body = `${lensBlock}First-pass close (assembly scaffold — rewrite before publish)\n\nHighlights carried from the materialized chronology:\n${bullets}\n\nThis recap lists staged beats only; it introduces no new factual claims beyond the timeline entries above.`;
  if (
    thin.retrievalModeStub ||
    thin.eventsWithNoSources >= Math.max(2, Math.ceil(thin.totalRows * 0.35))
  ) {
    body +=
      "\n\n---\nEditorial readiness: The underlying research pass was thin or lightly sourced for several beats — treat this close as provisional until you corroborate key claims.";
  }
  return body;
}

export function parseSynthesisFromArtifact(artifact: {
  researchSynthesisPackage: unknown;
} | null): ResearchSynthesisPackageV1 | null {
  if (!artifact) return null;
  return parseResearchSynthesisPackageV1(artifact.researchSynthesisPackage ?? null);
}
