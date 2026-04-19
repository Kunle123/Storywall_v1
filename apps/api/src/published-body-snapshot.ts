import type { Prisma } from "@prisma/client";

/** M3-T09 + M3-T10 + M3-T11 — versioned JSON written at publish and read by the public story route. */
export const PUBLISHED_BODY_SNAPSHOT_VERSION = 1 as const;

export type PublishedPublicSourceRowV1 = {
  title: string;
  outbound_url: string | null;
  publisher_name: string | null;
  position_index: number;
};

/** M3-T11 — per-event public reference row (subset of story-level source fields, no global index). */
export type PublishedPublicEventRefV1 = {
  title: string;
  outbound_url: string | null;
  publisher_name: string | null;
};

/** Approved, https-only image row surfaced on the anonymous reader (hero or timeline figure). */
export type PublishedPublicPrimaryImageV1 = {
  url: string;
  alt: string | null;
  credit: string | null;
};

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
  /** Frozen at publish from `story_draft.imagery_mode` (BriefImageryMode enum value, snake_case). */
  imagery_mode: string | null;
  /** Story-level hero: approved `story_cover` image proposal with https URL, or null. */
  hero_image_url: string | null;
  hero_image_alt: string | null;
  hero_image_credit: string | null;
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
    references: PublishedPublicEventRefV1[];
    /** Optional per-beat figure when an approved primary image exists at publish time. */
    primary_image: PublishedPublicPrimaryImageV1 | null;
  }>;
  sources: PublishedPublicSourceRowV1[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Only http(s) URLs become outbound links; everything else stays text-only in the reader. */
export function publicOutboundUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function publicPublisherName(raw: string): string | null {
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function pickStoryHeroFromProposals(
  imageryMode: string,
  proposals: ReadonlyArray<{
    targetType: string;
    approvalStatus: string;
    assetUrl: string | null;
    assetAlt: string | null;
    assetCredit: string | null;
    isPublicSelected: boolean;
  }>,
): PublishedPublicPrimaryImageV1 | null {
  if (imageryMode === "no_imagery") return null;
  const covers = proposals.filter((p) => p.targetType === "story_cover" && p.approvalStatus === "approved");
  const ranked = [...covers].sort((a, b) => Number(b.isPublicSelected) - Number(a.isPublicSelected));
  for (const p of ranked) {
    const url = p.assetUrl ? publicOutboundUrl(p.assetUrl) : null;
    if (!url) continue;
    return {
      url,
      alt: p.assetAlt?.trim() ? p.assetAlt.trim() : null,
      credit: p.assetCredit?.trim() ? p.assetCredit.trim() : null,
    };
  }
  return null;
}

export function primaryImageFromApprovedCandidate(
  imageryMode: string,
  mediaKind: string,
  candidate:
    | { assetUrl: string | null; assetAlt: string | null; assetCredit: string | null; approvalStatus: string }
    | null
    | undefined,
): PublishedPublicPrimaryImageV1 | null {
  if (imageryMode === "no_imagery") return null;
  if (mediaKind !== "image") return null;
  if (!candidate || candidate.approvalStatus !== "approved") return null;
  const url = candidate.assetUrl ? publicOutboundUrl(candidate.assetUrl) : null;
  if (!url) return null;
  return {
    url,
    alt: candidate.assetAlt?.trim() ? candidate.assetAlt.trim() : null,
    credit: candidate.assetCredit?.trim() ? candidate.assetCredit.trim() : null,
  };
}

function parsePrimaryImage(raw: unknown): PublishedPublicPrimaryImageV1 | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.url !== "string") return null;
  const url = publicOutboundUrl(raw.url);
  if (!url) return null;
  const alt = typeof raw.alt === "string" && raw.alt.trim().length > 0 ? raw.alt.trim() : null;
  const credit = typeof raw.credit === "string" && raw.credit.trim().length > 0 ? raw.credit.trim() : null;
  return { url, alt, credit };
}

function parseEventReferences(refRaw: unknown): PublishedPublicEventRefV1[] {
  if (!Array.isArray(refRaw)) return [];
  const out: PublishedPublicEventRefV1[] = [];
  for (const row of refRaw) {
    if (!isRecord(row)) continue;
    if (typeof row.title !== "string" || row.title.trim().length === 0) continue;
    const outbound_url =
      row.outbound_url === null || row.outbound_url === undefined
        ? null
        : typeof row.outbound_url === "string"
          ? publicOutboundUrl(row.outbound_url)
          : null;
    const publisher_name =
      row.publisher_name === null || row.publisher_name === undefined
        ? null
        : typeof row.publisher_name === "string"
          ? publicPublisherName(row.publisher_name)
          : null;
    out.push({ title: row.title.trim(), outbound_url, publisher_name });
  }
  return out;
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
  /** `story_draft.imagery_mode` at publish (BriefImageryMode). */
  imagery_mode: string | null;
  /** Approved story_cover proposal resolved by caller, or null. */
  hero_image: PublishedPublicPrimaryImageV1 | null;
  sectionDrafts: Array<{ label: string; summary: string | null; positionIndex: number }>;
  eventDrafts: Array<{
    headline: string;
    dek: string | null;
    summary: string;
    displayDate: string | null;
    locationName: string | null;
    contextLabel: string | null;
    positionIndex: number;
    mediaKind: string;
    mediaPrimaryCandidate: {
      assetUrl: string | null;
      assetAlt: string | null;
      assetCredit: string | null;
      approvalStatus: string;
    } | null;
    sources: Array<{ sourceTitle: string; sourceUrl: string; publisherName: string }>;
  }>;
}): Prisma.InputJsonValue {
  const { story, sectionDrafts, eventDrafts, imagery_mode, hero_image } = params;
  const imageryModeStr = imagery_mode ?? "";
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
      references: e.sources.map((src) => ({
        title: src.sourceTitle,
        outbound_url: publicOutboundUrl(src.sourceUrl),
        publisher_name: publicPublisherName(src.publisherName),
      })),
      primary_image: primaryImageFromApprovedCandidate(imageryModeStr, e.mediaKind, e.mediaPrimaryCandidate),
    }));
  const sources: PublishedPublicSourceRowV1[] = [];
  let sourcePosition = 0;
  const seenSourceKeys = new Set<string>();
  for (const ev of [...eventDrafts].sort((a, b) => a.positionIndex - b.positionIndex)) {
    for (const src of ev.sources) {
      const outbound_url = publicOutboundUrl(src.sourceUrl);
      const title = src.sourceTitle.trim();
      const publisher_name = publicPublisherName(src.publisherName);
      const dedupeKey =
        outbound_url ?? `${title}\u0000${publisher_name ?? ""}`;
      if (seenSourceKeys.has(dedupeKey)) continue;
      seenSourceKeys.add(dedupeKey);
      sources.push({
        title,
        outbound_url,
        publisher_name,
        position_index: sourcePosition++,
      });
    }
  }
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
    imagery_mode: imagery_mode,
    hero_image_url: hero_image?.url ?? null,
    hero_image_alt: hero_image?.alt ?? null,
    hero_image_credit: hero_image?.credit ?? null,
    sections,
    events,
    sources,
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
      references: parseEventReferences(row.references),
      primary_image: parsePrimaryImage(row.primary_image),
    });
  }
  const sources: PublishedPublicSourceRowV1[] = [];
  if (Array.isArray(raw.sources)) {
    let si = 0;
    for (const row of raw.sources) {
      if (!isRecord(row)) continue;
      if (typeof row.title !== "string" || row.title.trim().length === 0) continue;
      const outbound_url =
        row.outbound_url === null || row.outbound_url === undefined
          ? null
          : typeof row.outbound_url === "string"
            ? publicOutboundUrl(row.outbound_url)
            : null;
      const publisher_name =
        row.publisher_name === null || row.publisher_name === undefined
          ? null
          : typeof row.publisher_name === "string"
            ? publicPublisherName(row.publisher_name)
            : null;
      sources.push({ title: row.title.trim(), outbound_url, publisher_name, position_index: si });
      si += 1;
    }
  }
  const imagery_mode: string | null =
    typeof raw.imagery_mode === "string" && raw.imagery_mode.trim().length > 0 ? raw.imagery_mode.trim() : null;

  const hero_image_url =
    typeof raw.hero_image_url === "string" && raw.hero_image_url.trim().length > 0
      ? publicOutboundUrl(raw.hero_image_url)
      : null;
  const hero_image_alt =
    hero_image_url &&
    typeof raw.hero_image_alt === "string" &&
    raw.hero_image_alt.trim().length > 0
      ? raw.hero_image_alt.trim()
      : null;
  const hero_image_credit =
    hero_image_url &&
    typeof raw.hero_image_credit === "string" &&
    raw.hero_image_credit.trim().length > 0
      ? raw.hero_image_credit.trim()
      : null;

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
    imagery_mode,
    hero_image_url,
    hero_image_alt,
    hero_image_credit,
    sections,
    events,
    sources,
  };
}
