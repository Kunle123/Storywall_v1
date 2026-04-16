/** M3-T08 + M3-T10 — public story read envelope (matches API snake_case). */

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

export interface PublicStoryEvent {
  headline: string;
  dek: string | null;
  summary: string;
  display_date: string | null;
  location_name: string | null;
  context_label: string | null;
  position_index: number;
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
