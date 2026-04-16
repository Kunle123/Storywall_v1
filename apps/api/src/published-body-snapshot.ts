import type { Prisma } from "@prisma/client";

/** M3-T09 — versioned JSON written at publish and read by the public story route. */
export const PUBLISHED_BODY_SNAPSHOT_VERSION = 1 as const;

export type PublishedBodySnapshotV1 = {
  snapshot_version: typeof PUBLISHED_BODY_SNAPSHOT_VERSION;
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string | null;
  conclusion: string | null;
  time_display: string | null;
  time_start: string | null;
  time_end: string | null;
  sections: Array<{
    label: string;
    summary: string | null;
    position_index: number;
  }>;
  events: Array<{
    headline: string;
    dek: string | null;
    summary: string;
    display_date: string | null;
    location_name: string | null;
    context_label: string | null;
    position_index: number;
  }>;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Build snapshot from live story + draft rows at publish time (transaction-safe caller). */
export function buildPublishedBodySnapshotV1(params: {
  story: {
    title: string;
    subtitle: string | null;
    summary: string;
    lens: string | null;
    conclusion: string | null;
    timeDisplay: string | null;
    timeStart: Date | null;
    timeEnd: Date | null;
  };
  sectionDrafts: Array<{ label: string; summary: string | null; positionIndex: number }>;
  eventDrafts: Array<{
    headline: string;
    dek: string | null;
    summary: string;
    displayDate: string | null;
    locationName: string | null;
    contextLabel: string | null;
    positionIndex: number;
  }>;
}): Prisma.InputJsonValue {
  const { story, sectionDrafts, eventDrafts } = params;
  const sections = [...sectionDrafts]
    .sort((a, b) => a.positionIndex - b.positionIndex)
    .map((s) => ({
      label: s.label,
      summary: s.summary,
      position_index: s.positionIndex,
    }));
  const events = [...eventDrafts]
    .sort((a, b) => a.positionIndex - b.positionIndex)
    .map((e) => ({
      headline: e.headline,
      dek: e.dek,
      summary: e.summary,
      display_date: e.displayDate,
      location_name: e.locationName,
      context_label: e.contextLabel,
      position_index: e.positionIndex,
    }));
  const snap: PublishedBodySnapshotV1 = {
    snapshot_version: PUBLISHED_BODY_SNAPSHOT_VERSION,
    title: story.title,
    subtitle: story.subtitle,
    summary: story.summary,
    lens: story.lens,
    conclusion: story.conclusion,
    time_display: story.timeDisplay,
    time_start: story.timeStart ? story.timeStart.toISOString() : null,
    time_end: story.timeEnd ? story.timeEnd.toISOString() : null,
    sections,
    events,
  };
  return snap as unknown as Prisma.InputJsonValue;
}

/** Parse stored snapshot; returns null if missing or not v1 (caller falls back to legacy draft read). */
export function parsePublishedBodySnapshotV1(raw: unknown): Omit<
  PublishedBodySnapshotV1,
  "snapshot_version"
> | null {
  if (!isRecord(raw)) return null;
  if (raw.snapshot_version !== PUBLISHED_BODY_SNAPSHOT_VERSION) return null;
  if (typeof raw.title !== "string" || typeof raw.summary !== "string") return null;
  if (!Array.isArray(raw.sections) || !Array.isArray(raw.events)) return null;
  const sections: PublishedBodySnapshotV1["sections"] = [];
  for (const row of raw.sections) {
    if (!isRecord(row)) return null;
    if (typeof row.label !== "string" || typeof row.position_index !== "number") return null;
    sections.push({
      label: row.label,
      summary: typeof row.summary === "string" || row.summary === null ? (row.summary as string | null) : null,
      position_index: row.position_index,
    });
  }
  const events: PublishedBodySnapshotV1["events"] = [];
  for (const row of raw.events) {
    if (!isRecord(row)) return null;
    if (typeof row.headline !== "string" || typeof row.summary !== "string" || typeof row.position_index !== "number") {
      return null;
    }
    events.push({
      headline: row.headline,
      dek: typeof row.dek === "string" || row.dek === null ? (row.dek as string | null) : null,
      summary: row.summary,
      display_date:
        typeof row.display_date === "string" || row.display_date === null ? (row.display_date as string | null) : null,
      location_name:
        typeof row.location_name === "string" || row.location_name === null
          ? (row.location_name as string | null)
          : null,
      context_label:
        typeof row.context_label === "string" || row.context_label === null
          ? (row.context_label as string | null)
          : null,
      position_index: row.position_index,
    });
  }
  return {
    title: raw.title as string,
    subtitle: typeof raw.subtitle === "string" || raw.subtitle === null ? (raw.subtitle as string | null) : null,
    summary: raw.summary as string,
    lens: typeof raw.lens === "string" || raw.lens === null ? (raw.lens as string | null) : null,
    conclusion:
      typeof raw.conclusion === "string" || raw.conclusion === null ? (raw.conclusion as string | null) : null,
    time_display:
      typeof raw.time_display === "string" || raw.time_display === null ? (raw.time_display as string | null) : null,
    time_start:
      typeof raw.time_start === "string" || raw.time_start === null ? (raw.time_start as string | null) : null,
    time_end: typeof raw.time_end === "string" || raw.time_end === null ? (raw.time_end as string | null) : null,
    sections,
    events,
  };
}
