/**
 * Form model ↔ API — mirrors CreateStoryDto / PatchStoryBriefDto (snake_case on wire).
 */

import type { BriefStoryType } from "@storywall/shared";
import type { CreateStoryBody, PatchStoryBriefBody, StoryBriefResponse } from "../api/types";

export interface BriefFormValues {
  subject: string;
  subject_type_input: string;
  story_type: BriefStoryType;
  research_brief: string;
  desired_angle: string;
  time_scope_mode: StoryBriefResponse["time_scope_mode"];
  time_scope_start: string;
  time_scope_end: string;
  audience: string;
  narrative_intent: StoryBriefResponse["narrative_intent"];
  imagery_mode: StoryBriefResponse["imagery_mode"];
  source_inputs_text: string;
  writing_style_preference: string;
  creation_mode: StoryBriefResponse["creation_mode"];
}

export const defaultBriefForm = (): BriefFormValues => ({
  subject: "",
  subject_type_input: "",
  story_type: "biography",
  research_brief: "",
  desired_angle: "",
  time_scope_mode: "entire_history",
  time_scope_start: "",
  time_scope_end: "",
  audience: "",
  narrative_intent: "explanatory",
  imagery_mode: "selective_editorial",
  source_inputs_text: "",
  writing_style_preference: "",
  creation_mode: "ai_first",
});

export function briefResponseToForm(b: StoryBriefResponse): BriefFormValues {
  return {
    subject: b.subject ?? "",
    subject_type_input: b.subject_type_input ?? "",
    story_type: b.story_type,
    research_brief: b.research_brief ?? "",
    desired_angle: b.desired_angle ?? "",
    time_scope_mode: b.time_scope_mode,
    time_scope_start: b.time_scope_start ? String(b.time_scope_start).slice(0, 10) : "",
    time_scope_end: b.time_scope_end ? String(b.time_scope_end).slice(0, 10) : "",
    audience: b.audience ?? "",
    narrative_intent: b.narrative_intent,
    imagery_mode: b.imagery_mode,
    source_inputs_text: stringifySourceInputs(b.source_inputs),
    writing_style_preference: b.writing_style_preference ?? "",
    creation_mode: b.creation_mode,
  };
}

function stringifySourceInputs(raw: unknown): string {
  if (raw == null) return "";
  if (!Array.isArray(raw)) return "";
  const lines: string[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && "url" in item && typeof (item as { url: unknown }).url === "string") {
      lines.push((item as { url: string }).url);
    } else {
      lines.push(JSON.stringify(item));
    }
  }
  return lines.join("\n");
}

export function parseSourceInputsText(text: string): unknown[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}

export function sourcesPayloadEqual(server: unknown, formText: string): boolean {
  const next = parseSourceInputsText(formText);
  if (server === null || server === undefined) return next.length === 0;
  if (!Array.isArray(server)) return false;
  return JSON.stringify(server) === JSON.stringify(next);
}

export function formToCreateBody(f: BriefFormValues): CreateStoryBody {
  const body: CreateStoryBody = {
    subject: f.subject.trim(),
    story_type: f.story_type,
    research_brief: f.research_brief.trim(),
    desired_angle: f.desired_angle.trim(),
    time_scope_mode: f.time_scope_mode,
    narrative_intent: f.narrative_intent,
    imagery_mode: f.imagery_mode,
    creation_mode: f.creation_mode,
  };
  const st = f.subject_type_input.trim();
  if (st) body.subject_type_input = st;
  if (f.time_scope_start.trim()) body.time_scope_start = f.time_scope_start.trim();
  if (f.time_scope_end.trim()) body.time_scope_end = f.time_scope_end.trim();
  if (f.audience.trim()) body.audience = f.audience.trim();
  const src = parseSourceInputsText(f.source_inputs_text);
  if (src.length > 0) body.source_inputs = src;
  const ws = f.writing_style_preference.trim();
  if (ws) body.writing_style_preference = ws;
  return body;
}

/** Build PATCH body: only keys that differ from baseline; supports null clears for nullable fields. */
export function diffPatch(from: StoryBriefResponse, form: BriefFormValues): PatchStoryBriefBody {
  const patch: PatchStoryBriefBody = {};

  if (form.subject.trim() !== from.subject) patch.subject = form.subject.trim();
  {
    const next = form.subject_type_input.trim();
    const prev = from.subject_type_input ?? "";
    if (next !== prev) {
      patch.subject_type_input = next === "" ? null : next;
    }
  }
  if (form.story_type !== from.story_type) patch.story_type = form.story_type;
  if (form.research_brief.trim() !== from.research_brief) patch.research_brief = form.research_brief.trim();
  if (form.desired_angle.trim() !== from.desired_angle) patch.desired_angle = form.desired_angle.trim();
  if (form.time_scope_mode !== from.time_scope_mode) patch.time_scope_mode = form.time_scope_mode;

  {
    const nextStart = form.time_scope_start.trim();
    const prevStart = from.time_scope_start ?? "";
    if (nextStart !== prevStart) {
      patch.time_scope_start = nextStart === "" ? null : nextStart;
    }
  }
  {
    const nextEnd = form.time_scope_end.trim();
    const prevEnd = from.time_scope_end ?? "";
    if (nextEnd !== prevEnd) {
      patch.time_scope_end = nextEnd === "" ? null : nextEnd;
    }
  }
  {
    const next = form.audience.trim();
    const prev = (from.audience ?? "") as string;
    if (next !== prev) {
      patch.audience = next === "" ? null : next;
    }
  }
  if (form.narrative_intent !== from.narrative_intent) patch.narrative_intent = form.narrative_intent;
  if (form.imagery_mode !== from.imagery_mode) patch.imagery_mode = form.imagery_mode;

  if (!sourcesPayloadEqual(from.source_inputs, form.source_inputs_text)) {
    const nextArr = parseSourceInputsText(form.source_inputs_text);
    patch.source_inputs = nextArr.length === 0 ? null : nextArr;
  }

  {
    const next = form.writing_style_preference.trim();
    const prev = (from.writing_style_preference ?? "") as string;
    if (next !== prev) {
      patch.writing_style_preference = next === "" ? null : next;
    }
  }
  if (form.creation_mode !== from.creation_mode) patch.creation_mode = form.creation_mode;

  return patch;
}

export function validateCreateForm(f: BriefFormValues): string | null {
  if (!f.subject.trim()) return "Subject is required.";
  if (!f.research_brief.trim()) return "Research brief is required.";
  if (!f.desired_angle.trim()) return "Desired angle is required.";
  return null;
}
