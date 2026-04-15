/**
 * Canned prompt starters — creator workflow spec §6 (Stage 0).
 * Client-side presets only; no API changes. Creators edit results freely afterward.
 */

import type { BriefFormValues } from "./briefFormModel";

export type CannedStarterId =
  | "person_biography_of"
  | "person_life_and_times"
  | "person_relationships"
  | "topic_history_of"
  | "topic_milestones"
  | "issue_event_unfolded";

export interface CannedStarterDefinition {
  id: CannedStarterId;
  /** Short label for buttons (doc wording, may truncate in UI). */
  shortLabel: string;
  storyType: BriefFormValues["story_type"];
  /** Maps to subject_type_input select; "" = leave as-is (infer). */
  subjectTypeInput: string;
  researchBrief: (subjectPlaceholder: string) => string;
  desiredAngle: string;
}

/** Order and copy aligned to `storywall_creator_workflow_specification.md` §6 table. */
export const CANNED_STARTERS: CannedStarterDefinition[] = [
  {
    id: "person_biography_of",
    shortLabel: "A biography of…",
    storyType: "biography",
    subjectTypeInput: "person",
    researchBrief: (s) => `A biography of ${s}…`,
    desiredAngle:
      "Ground the story in verifiable life arc, major eras, and why this life matters to readers now.",
  },
  {
    id: "person_life_and_times",
    shortLabel: "The life and times of…",
    storyType: "biography",
    subjectTypeInput: "person",
    researchBrief: (s) => `The life and times of ${s}…`,
    desiredAngle:
      "Cover turning points across career, public life, and context without losing chronological clarity.",
  },
  {
    id: "person_relationships",
    shortLabel: "The relationships that shaped…",
    storyType: "relationship_impact",
    subjectTypeInput: "person",
    researchBrief: (s) => `The relationships that shaped ${s}…`,
    desiredAngle:
      "Show how key relationships influenced decisions, outcomes, and public perception over time.",
  },
  {
    id: "topic_history_of",
    shortLabel: "A history of…",
    storyType: "issue_history",
    subjectTypeInput: "topic",
    researchBrief: (s) => `A history of ${s}…`,
    desiredAngle: "Explain how the issue developed, what changed, and why it matters in context.",
  },
  {
    id: "topic_milestones",
    shortLabel: "The key milestones in…",
    storyType: "issue_history",
    subjectTypeInput: "topic",
    researchBrief: (s) => `The key milestones in ${s}…`,
    desiredAngle: "Prioritize the most consequential developments and order them clearly in time.",
  },
  {
    id: "issue_event_unfolded",
    shortLabel: "How … unfolded and why it mattered",
    storyType: "issue_history",
    subjectTypeInput: "event",
    researchBrief: (s) => `How ${s} unfolded and why it mattered…`,
    desiredAngle: "Trace the sequence of events, stakeholders, and outcomes with explicit sourcing intent.",
  },
];

export const CANNED_STARTER_GROUPS: { title: string; ids: CannedStarterId[] }[] = [
  { title: "Person", ids: ["person_biography_of", "person_life_and_times", "person_relationships"] },
  { title: "Topic", ids: ["topic_history_of", "topic_milestones"] },
  { title: "Issue / event", ids: ["issue_event_unfolded"] },
];

export function getStarterById(id: CannedStarterId): CannedStarterDefinition | undefined {
  return CANNED_STARTERS.find((s) => s.id === id);
}

/**
 * Apply a canned starter without overwriting non-empty brief fields (fill-if-empty).
 * Always updates story_type + subject_type_input from the starter so the structured model matches the template.
 */
export function applyCannedStarter(
  starter: CannedStarterDefinition,
  value: BriefFormValues,
): { patch: Partial<BriefFormValues>; blocked?: string } {
  const researchEmpty = !value.research_brief.trim();
  const angleEmpty = !value.desired_angle.trim();

  if (!researchEmpty && !angleEmpty) {
    return {
      patch: {},
      blocked: "Clear the research brief or desired angle field to apply a starter.",
    };
  }

  const placeholder = value.subject.trim() || "…";
  const patch: Partial<BriefFormValues> = {
    story_type: starter.storyType,
    subject_type_input: starter.subjectTypeInput,
  };

  if (researchEmpty) {
    patch.research_brief = starter.researchBrief(placeholder);
  }
  if (angleEmpty) {
    patch.desired_angle = starter.desiredAngle;
  }

  return { patch };
}
