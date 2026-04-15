/**
 * Creator API envelopes — aligned with apps/api responses and mutation contract §5–9.
 */

import type {
  BriefAudience,
  BriefImageryMode,
  BriefStoryType,
  CreationMode,
  CreatorWorkflowState,
  NarrativeIntent,
  TimeScopeMode,
  WritingStylePreference,
} from "@storywall/shared";

export interface ApiErrorBody {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
    details?: {
      story_brief?: StoryBriefResponse;
      [key: string]: unknown;
    };
  };
  message?: string | string[];
  statusCode?: number;
}

export interface StoryBriefResponse {
  id: string;
  story_id: string;
  creator_id: string;
  subject: string;
  subject_type_input: string | null;
  story_type: BriefStoryType;
  research_brief: string;
  desired_angle: string;
  time_scope_mode: TimeScopeMode;
  time_scope_start: string | null;
  time_scope_end: string | null;
  audience: BriefAudience | string | null;
  narrative_intent: NarrativeIntent;
  imagery_mode: BriefImageryMode;
  source_inputs: unknown;
  writing_style_preference: WritingStylePreference | string | null;
  creation_mode: CreationMode;
  status?: string;
  updated_at: string;
  created_at: string;
}

export interface CreateStorySuccess {
  ok: true;
  data: {
    story_id: string;
    slug: string;
    story_brief: StoryBriefResponse;
    story_state: CreatorWorkflowState;
  };
}

export interface PatchBriefSuccess {
  ok: true;
  data: {
    story_brief: StoryBriefResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: {
    saved_at?: string;
  };
}

/** GET /creator/stories/:id/frames — M1-T12 */
export interface FrameDraftResponse {
  id: string;
  story_brief_id: string;
  title_candidate: string;
  subtitle_candidate: string | null;
  summary_candidate: string;
  lens_candidate: string;
  scope_rationale: string;
  coverage_implications: unknown;
  balance_note: string | null;
  candidate_rank: number;
  is_selected: boolean;
  selection_source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListFramesSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    frame_drafts: FrameDraftResponse[];
  };
}

export interface StoryDraftResponse {
  id: string;
  story_brief_id: string;
  selected_frame_id: string;
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string;
  story_status: string;
  visibility_target: string;
  imagery_mode: string;
  generation_mode: string;
  editorial_review_status: string;
  created_at: string;
  last_edited_at: string;
}

export interface SelectFrameSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    selected_frame_id: string;
    story_draft: StoryDraftResponse;
    frame_draft: FrameDraftResponse;
  };
  meta?: {
    idempotency_key?: string;
    idempotency_replayed?: boolean;
  };
}

/** GET /creator/jobs/:jobId — unified poll for research_run and draft_assemble (mutation §6). */
export interface CreatorJobPollData {
  job_id: string;
  kind: "research_run" | "draft_assemble";
  status: string;
  story_id: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface PollJobSuccess {
  ok: true;
  data: CreatorJobPollData;
}

/** POST …/research/run (mutation §11.1). */
export interface RunResearchPassBody {
  mode: "full";
  respect_existing_manual_events: boolean;
  respect_existing_sources: boolean;
  notes?: string;
}

export interface RunResearchPassSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    job_id: string;
    job_status: string;
  };
  meta?: {
    idempotency_key?: string;
    async_job?: { job_id: string; kind: "research_run" };
    idempotency_replayed?: boolean;
  };
}

/** POST …/draft/assemble (mutation §11.2). */
export interface AssembleDraftBody {
  mode: string;
  preserve_creator_notes: boolean;
  preserve_manual_event_positions: boolean;
  preserve_approved_images: boolean;
}

export interface AssembleDraftSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    job_id: string;
    job_status: string;
  };
  meta?: {
    idempotency_key?: string;
    async_job?: { job_id: string; kind: "draft_assemble" };
    idempotency_replayed?: boolean;
  };
}

/** POST /api/v1/creator/stories body (snake_case, mutation §9.1). */
export interface CreateStoryBody {
  subject: string;
  subject_type_input?: string;
  story_type: BriefStoryType;
  research_brief: string;
  desired_angle: string;
  time_scope_mode: TimeScopeMode;
  time_scope_start?: string;
  time_scope_end?: string;
  audience?: string;
  narrative_intent: NarrativeIntent;
  imagery_mode: BriefImageryMode;
  source_inputs?: unknown[];
  writing_style_preference?: string;
  creation_mode: CreationMode;
}

/** PATCH …/brief partial (M1-T08). */
export type PatchStoryBriefBody = Partial<{
  subject: string | null;
  subject_type_input: string | null;
  story_type: BriefStoryType | null;
  research_brief: string | null;
  desired_angle: string | null;
  time_scope_mode: TimeScopeMode | null;
  time_scope_start: string | null;
  time_scope_end: string | null;
  audience: string | null;
  narrative_intent: NarrativeIntent | null;
  imagery_mode: BriefImageryMode | null;
  source_inputs: unknown[] | null;
  writing_style_preference: string | null;
  creation_mode: CreationMode | null;
}>;
