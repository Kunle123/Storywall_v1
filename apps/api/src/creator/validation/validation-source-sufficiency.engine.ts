import type { SkeletonDraftSnapshot, SkeletonIssueInput } from "./validation-skeleton.engine";

/**
 * M3-T03 — source sufficiency and missing-reference checks (publishing standard §5, §5.2, PTS-1).
 * Heuristic and structural only: relevance-of-source text is left to later tickets.
 */

function publicCount(sources: Array<{ isPublic: boolean }>): number {
  return sources.filter((s) => s.isPublic).length;
}

/**
 * Rules (narrow, explainable):
 * 1. **Visible references (PTS-1)** — event has sources but none marked public → block.
 * 2. **Turning point corroboration (§5.2)** — `turning_point` with exactly one source → block (stronger support expected).
 * 3. **Rejected-only path** — all attached sources on an event are `rejected` → block (no meaningful approved path).
 * 4. **Draft-only path** — all attached sources are still `draft` → warn (not yet approved for publish).
 * 5. **Thin breadth** — three or more events but only one distinct source id across the whole story → warn (single-footprint pattern).
 * 6. **Major/critical significance** — `major` or `critical` with only one source → warn (suggest stronger corroboration).
 */
export function collectSourceSufficiencyAndReferenceIssues(
  draft: SkeletonDraftSnapshot,
): SkeletonIssueInput[] {
  const issues: SkeletonIssueInput[] = [];

  const allSourceIds: string[] = [];
  for (const ev of draft.events) {
    for (const s of ev.sources) {
      allSourceIds.push(s.id);
    }
  }
  const distinctSourceIds = new Set(allSourceIds);

  if (draft.events.length >= 3 && distinctSourceIds.size === 1) {
    issues.push({
      objectType: "story",
      objectId: draft.storyDraftId,
      issueType: "unsupported",
      severity: "medium",
      publishEffect: "warn",
      explanation:
        "The timeline has several events but only one distinct reference across the story. Consider broader corroboration for source sufficiency.",
      suggestedFix: "Add additional independent sources where appropriate for the scope of the frame.",
    });
  }

  for (const ev of draft.events) {
    const n = ev.sources.length;
    const pub = publicCount(ev.sources);

    if (n === 0) {
      continue;
    }

    if (pub === 0) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "unsupported",
        severity: "high",
        publishEffect: "block",
        explanation:
          "This event has references, but none are marked visible to readers. Storywall requires at least one visible evidence path for publish (publishing standard PTS-1).",
        suggestedFix: "Mark at least one attached source as public, or replace with sources you can show readers.",
      });
      continue;
    }

    const allRejected = ev.sources.every((s) => s.status === "rejected");
    if (allRejected) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "unsupported",
        severity: "high",
        publishEffect: "block",
        explanation:
          "All references attached to this event are in a rejected state, so there is no approvable evidence path.",
        suggestedFix: "Attach approved sources or replace rejected entries.",
      });
      continue;
    }

    const allDraft = ev.sources.every((s) => s.status === "draft");
    if (allDraft) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "unsupported",
        severity: "low",
        publishEffect: "warn",
        explanation:
          "All references on this event are still in draft review state.",
        suggestedFix: "Approve references before publish, or add finalized sources.",
      });
    }

    if (ev.eventType === "turning_point" && n === 1) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "unsupported",
        severity: "high",
        publishEffect: "block",
        explanation:
          "Turning-point events require stronger corroboration than a single reference (publishing standard §5.2).",
        suggestedFix: "Add at least one additional independent source or explain uncertainty in a later ticket.",
      });
    } else if (
      (ev.significanceLevel === "major" || ev.significanceLevel === "critical") &&
      n === 1 &&
      ev.eventType !== "chatter"
    ) {
      issues.push({
        objectType: "event",
        objectId: ev.id,
        issueType: "unsupported",
        severity: "medium",
        publishEffect: "warn",
        explanation:
          "This event is marked major or critical significance but only has one reference; consider additional corroboration.",
        suggestedFix: "Add sources or adjust significance if the claim is intentionally light.",
      });
    }
  }

  return issues;
}
