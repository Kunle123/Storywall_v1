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
  PublicStorySection,
  PublicStorySource,
} from "../api/publicTypes";

function sortByPosition<T extends { position_index: number; id?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position_index - b.position_index || (a.id ?? "").localeCompare(b.id ?? ""));
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
    return {
      headline: e.headline,
      dek: e.dek ?? null,
      summary: e.summary,
      display_date: e.display_date ?? null,
      location_name: e.location_name ?? null,
      context_label: e.context_label ?? null,
      position_index: e.position_index,
      references,
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
    hero_image_url: null,
    hero_image_alt: null,
    hero_image_credit: null,
  };
}
