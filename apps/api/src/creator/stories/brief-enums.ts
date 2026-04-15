/** Shared string unions for create + patch brief DTOs (editor §7.1, mutation §9). */

export const BRIEF_STORY_TYPE = [
  "biography",
  "issue_history",
  "influence",
  "controversy",
  "movement_history",
  "relationship_impact",
  "custom",
] as const;

export const TIME_SCOPE_MODE = [
  "entire_history",
  "bounded_range",
  "open_recent",
  "custom",
] as const;

export const BRIEF_AUDIENCE = ["general", "fan", "student", "specialist", "custom"] as const;

export const NARRATIVE_INTENT = [
  "documentary",
  "explanatory",
  "analytical",
  "commemorative",
  "comparative",
] as const;

export const BRIEF_IMAGERY_MODE = [
  "selective_editorial",
  "minimal",
  "sourced_only",
  "no_imagery",
] as const;

export const WRITING_STYLE = ["neutral", "analytical", "concise", "documentary"] as const;

export const CREATION_MODE = ["ai_first", "hybrid", "manual_heavy"] as const;

export const SUBJECT_TYPE = [
  "person",
  "organization",
  "event",
  "topic",
  "place",
  "movement",
  "conflict",
  "other",
] as const;
