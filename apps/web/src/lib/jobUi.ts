import type { CreatorJobPollData } from "../api/types";

/** User-facing line for API job status (pending | running | succeeded | failed | cancelled). */
export function describeJobLifecycle(status: string): string {
  switch (status) {
    case "pending":
      return "Queued — waiting for the worker to start.";
    case "running":
      return "Running — this can take a minute or more.";
    case "succeeded":
      return "Finished successfully.";
    case "failed":
      return "Failed — see the error below.";
    case "cancelled":
      return "Cancelled.";
    default:
      return `Status: ${status}`;
  }
}

export function generationHeadline(job: Pick<CreatorJobPollData, "kind">): string {
  return job.kind === "research_run" ? "Research in progress" : "Assembling your draft";
}

export function workflowLabelForJobKind(kind: CreatorJobPollData["kind"]): string {
  return kind === "research_run" ? "researching" : "assembling_draft";
}
