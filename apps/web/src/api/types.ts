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
