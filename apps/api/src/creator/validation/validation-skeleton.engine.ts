import type {
  ValidationIssueObjectType,
  ValidationIssueSeverity,
  ValidationIssueType,
  ValidationOverallResult,
  ValidationPublishEffect,
  ValidationRunType,
} from "@prisma/client";

/**
 * M3-T02 — narrow structural/readiness checks only. Deeper trust rules belong in M3-T03+.
 */
export type SkeletonIssueInput = {
  objectType: ValidationIssueObjectType;
  objectId: string;
  issueType: ValidationIssueType;
  severity: ValidationIssueSeverity;
  publishEffect: ValidationPublishEffect;
  explanation: string;
  suggestedFix?: string | null;
};

export type SkeletonDraftSnapshot = {
  storyDraftId: string;
  title: string;
  summary: string;
  lens: string;
  conclusion: string | null;
  sectionCount: number;
  eventCount: number;
  events: Array<{ id: string; sourceCount: number }>;
};

function trimOrEmpty(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/**
 * Baseline checks: required hero fields, non-empty timeline, events with sources, optional synthesis hint.
 * Flags for style/imagery/dispute from the request are accepted at the API layer but not acted on here (M3-T04–M3-T06).
 */
export function collectSkeletonValidationIssues(
  draft: SkeletonDraftSnapshot,
  requestedRunType: ValidationRunType,
): SkeletonIssueInput[] {
  const issues: SkeletonIssueInput[] = [];
  const title = trimOrEmpty(draft.title);
  const summary = trimOrEmpty(draft.summary);
  const lens = trimOrEmpty(draft.lens);

  if (!title || !summary || !lens) {
    issues.push({
      objectType: "story",
      objectId: draft.storyDraftId,
      issueType: "other",
      severity: "high",
      publishEffect: "block",
      explanation:
        "Story title, summary, and lens are required before publish. Complete the story header fields.",
      suggestedFix: "Fill in title, summary, and lens on the story draft.",
    });
  }

  if (draft.sectionCount === 0 && draft.eventCount === 0) {
    issues.push({
      objectType: "story",
      objectId: draft.storyDraftId,
      issueType: "timeline_gap",
      severity: "medium",
      publishEffect: "warn",
      explanation: "The story has no timeline sections or events yet.",
      suggestedFix: "Add at least one section or event to the timeline.",
    });
  }

  for (const ev of draft.events) {
    if (ev.sourceCount < 1) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "missing_source",
        severity: "medium",
        publishEffect: "warn",
        explanation: "This event has no attached references.",
        suggestedFix: "Link at least one source to support this event.",
      });
    }
  }

  if (
    requestedRunType === "publish_readiness" ||
    requestedRunType === "full" ||
    requestedRunType === "trust"
  ) {
    const concl = trimOrEmpty(draft.conclusion);
    if (draft.eventCount > 0 && !concl) {
      issues.push({
        objectType: "story",
        objectId: draft.storyDraftId,
        issueType: "missing_synthesis",
        severity: "low",
        publishEffect: "warn",
        explanation: "End synthesis / conclusion is empty while the timeline has events.",
        suggestedFix: "Add a short conclusion or synthesis block when ready.",
      });
    }
  }

  return issues;
}

export function deriveOverallResult(issues: SkeletonIssueInput[]): ValidationOverallResult {
  if (issues.some((i) => i.publishEffect === "block")) {
    return "block";
  }
  if (issues.some((i) => i.publishEffect === "warn")) {
    return "warn";
  }
  return "pass";
}

export function countByPublishEffect(issues: SkeletonIssueInput[]): { blockers: number; warnings: number } {
  let blockers = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.publishEffect === "block") blockers += 1;
    else if (i.publishEffect === "warn") warnings += 1;
  }
  return { blockers, warnings };
}

export function buildSummaryNote(
  overall: ValidationOverallResult,
  issueCount: number,
  blockers: number,
  warnings: number,
): string {
  if (issueCount === 0) {
    return "Validation completed: no issues found by the baseline checks.";
  }
  if (overall === "block") {
    return `Validation found ${issueCount} issue(s) including ${blockers} blocker(s) and ${warnings} warning(s).`;
  }
  if (overall === "warn") {
    return `Validation found ${warnings} warning(s); no blockers.`;
  }
  return "Validation completed.";
}
