/** M3-T08 — public story read envelope (matches API snake_case). */

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
}

export interface GetPublicStorySuccess {
  ok: true;
  data: PublicStoryData;
  request_id?: string;
  api_version?: string;
}
