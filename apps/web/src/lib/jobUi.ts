import type { CreatorJobPollData } from "../api/types";
import { researchJobOutputExplainer } from "./capabilityHonestyCopy";

/** User-facing line for API job status (pending | running | succeeded | failed | cancelled). */
export function describeJobLifecycle(status: string): string {
  switch (status) {
    case "pending":
      return "Queued — waiting for the worker to start.";
    case "running":
      return "Running — this can take a minute or more.";
    case "succeeded":
      return "Worker reported succeeded — review package or draft outputs; job success is not the same as publish-ready coverage.";
    case "failed":
      return "Failed — see the error below.";
    case "cancelled":
      return "Cancelled.";
    default:
      return `Status: ${status}`;
  }
}

export function generationHeadline(job: Pick<CreatorJobPollData, "kind">): string {
  return job.kind === "research_run" ? "Research job in progress" : "Draft assembly in progress";
}

/** What the finished job layer produces — distinct from end-to-end “AI author”. */
export function describeJobCapability(job: Pick<CreatorJobPollData, "kind">): string {
  return researchJobOutputExplainer(job.kind);
}

export function workflowLabelForJobKind(kind: CreatorJobPollData["kind"]): string {
  return kind === "research_run" ? "researching" : "assembling_draft";
}
