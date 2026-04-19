import type { CreatorWorkflowState } from "@storywall/shared";

const LABELS: Record<CreatorWorkflowState, string> = {
  drafting_brief: "Drafting brief",
  awaiting_framing_choice: "Choosing framing",
  researching: "Research in progress",
  assembling_draft: "Assembling draft",
  ready_for_edit: "Editing draft",
  needs_validation: "Checks required",
  blocked: "Blocked on checks",
  /** Workflow gate only — not a claim the manuscript is factually complete or endorsed for release. */
  ready_to_publish: "Publish step open (workflow)",
  published: "Published",
};

export function creatorWorkflowLabel(state: CreatorWorkflowState | null | undefined): string {
  if (!state) return "Loading…";
  return LABELS[state] ?? state;
}
