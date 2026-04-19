import type {
  EventDraftResponse,
  SectionDraftResponse,
  SourceRecordResponse,
  StoryDraftResponse,
} from "../api/types";
import type {
  PublicEventReference,
  PublicStoryData,
  PublicStoryEvent,
  PublicStoryPrimaryImage,
  PublicStorySection,
  PublicStorySource,
} from "../api/publicTypes";

function sortByPosition<T extends { position_index: number; id?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position_index - b.position_index || (a.id ?? "").localeCompare(b.id ?? ""));
}

/** Respect local `imagery_mode` (preview merge): no_imagery suppresses all story photography. */
function heroFieldsForPreviewDraft(draft: StoryDraftResponse): {
  hero_image_url: string | null;
  hero_image_alt: string | null;
  hero_image_credit: string | null;
} {
  if (draft.imagery_mode === "no_imagery") {
    return { hero_image_url: null, hero_image_alt: null, hero_image_credit: null };
  }
  const url = draft.hero_image_url?.trim();
  if (!url) {
    return { hero_image_url: null, hero_image_alt: null, hero_image_credit: null };
  }
  return {
    hero_image_url: url,
    hero_image_alt: draft.hero_image_alt?.trim() ? draft.hero_image_alt.trim() : null,
    hero_image_credit: draft.hero_image_credit?.trim() ? draft.hero_image_credit.trim() : null,
  };
}

function eventPrimaryImageForPreview(
  draft: StoryDraftResponse,
  ev: EventDraftResponse,
): PublicStoryPrimaryImage | null {
  if (draft.imagery_mode === "no_imagery") return null;
  const p = ev.primary_image;
  if (!p || typeof p.url !== "string" || !p.url.trim()) return null;
  return {
    url: p.url.trim(),
    alt: typeof p.alt === "string" && p.alt.trim() ? p.alt.trim() : null,
    credit: typeof p.credit === "string" && p.credit.trim() ? p.credit.trim() : null,
  };
}

/**
 * Maps current creator draft rows into the same `PublicStoryData` shape the public reader uses,
 * so the shared `PublicStoryArticle` can render a faithful structural preview (not a publish snapshot).
 */
export function buildPublicPreviewFromDraft(params: {
  storyId: string;
  draft: StoryDraftResponse;
  sections: SectionDraftResponse[];
  events: EventDraftResponse[];
  /** Per-event sources (creator evidence rows); outbound URLs are shown as in the reader. */
  sourcesByEventId: Record<string, SourceRecordResponse[]>;
}): PublicStoryData {
  const { storyId, draft, sections, events, sourcesByEventId } = params;

  const secSorted = sortByPosition(sections);
  const publicSections: PublicStorySection[] = secSorted.map((s) => ({
    label: s.label,
    summary: s.summary,
    position_index: s.position_index,
  }));

  const evSorted = sortByPosition(events);
  const publicEvents: PublicStoryEvent[] = evSorted.map((e) => {
    const srcs = sourcesByEventId[e.id] ?? [];
    const references: PublicEventReference[] = srcs.map((src) => ({
      title: src.source_title,
      outbound_url: src.source_url,
      publisher_name: src.publisher_name,
    }));
    const primary_image = eventPrimaryImageForPreview(draft, e);
    return {
      headline: e.headline,
      dek: e.dek ?? null,
      summary: e.summary,
      display_date: e.display_date ?? null,
      location_name: e.location_name ?? null,
      context_label: e.context_label ?? null,
      position_index: e.position_index,
      references,
      ...(primary_image ? { primary_image } : {}),
    };
  });

  const flatSources: PublicStorySource[] = [];
  let idx = 0;
  for (const e of evSorted) {
    for (const src of sourcesByEventId[e.id] ?? []) {
      flatSources.push({
        title: src.source_title,
        outbound_url: src.source_url,
        publisher_name: src.publisher_name,
        position_index: idx++,
      });
    }
  }

  const hero = heroFieldsForPreviewDraft(draft);

  return {
    slug: `draft-preview-${storyId}`,
    title: draft.title,
    subtitle: draft.subtitle,
    summary: draft.summary,
    lens: draft.lens,
    conclusion: draft.conclusion ?? null,
    time_display: draft.time_display ?? null,
    time_start: draft.time_start ?? null,
    time_end: draft.time_end ?? null,
    published_at: draft.last_edited_at,
    sections: publicSections,
    events: publicEvents,
    sources: flatSources,
    imagery_mode: draft.imagery_mode ?? null,
    hero_image_url: hero.hero_image_url,
    hero_image_alt: hero.hero_image_alt,
    hero_image_credit: hero.hero_image_credit,
  };
}
