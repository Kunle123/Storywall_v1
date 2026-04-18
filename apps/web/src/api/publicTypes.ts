/** M3-T08 + M3-T10 + M3-T11 + M3-T12 — public story read envelope (matches API snake_case). */

export interface PublicStorySource {
  title: string;
  outbound_url: string | null;
  publisher_name: string | null;
  position_index: number;
}

export interface PublicStorySection {
  label: string;
  summary: string | null;
  position_index: number;
}

/** M3-T11 — inline preview row (published snapshot only). */
export interface PublicEventReference {
  title: string;
  outbound_url: string | null;
  publisher_name: string | null;
}

export interface PublicStoryEvent {
  headline: string;
  dek: string | null;
  summary: string;
  display_date: string | null;
  location_name: string | null;
  context_label: string | null;
  position_index: number;
  references: PublicEventReference[];
}

export interface PublicStoryData {
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string | null;
  conclusion: string | null;
  time_display: string | null;
  time_start: string | null;
  time_end: string | null;
  published_at: string;
  sections: PublicStorySection[];
  events: PublicStoryEvent[];
  sources: PublicStorySource[];
}

export interface GetPublicStorySuccess {
  ok: true;
  data: PublicStoryData;
  request_id?: string;
  api_version?: string;
}

/** M3-T12 — dedicated references read (snapshot-derived only). */
export interface PublicStoryReferencesEvent {
  headline: string;
  display_date: string | null;
  position_index: number;
  references: PublicEventReference[];
}

export interface PublicStoryReferencesData {
  slug: string;
  title: string;
  subtitle: string | null;
  published_at: string;
  sources: PublicStorySource[];
  events: PublicStoryReferencesEvent[];
}

export interface GetPublicStoryReferencesSuccess {
  ok: true;
  data: PublicStoryReferencesData;
  request_id?: string;
  api_version?: string;
}

/** M5-T27 — anonymous discovery list card (snake_case from API). */
export interface PublicDiscoveryStoryCard {
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  published_at: string;
}

/** M5-T27 + M5-T28 — GET /api/v1/stories/discover */
export interface GetPublicDiscoverSuccess {
  ok: true;
  data: {
    discovery_contract: string;
    limit_applied: number;
    stories: PublicDiscoveryStoryCard[];
  };
  request_id?: string;
  api_version?: string;
}
