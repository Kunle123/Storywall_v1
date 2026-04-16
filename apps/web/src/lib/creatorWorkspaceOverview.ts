import type { CreatorWorkflowState } from "@storywall/shared";
import type {
  GetLatestValidationSuccess,
  ListFramesSuccess,
  StoryBriefResponse,
} from "../api/types";

export type OverviewTone = "neutral" | "emphasis" | "caution" | "live" | "quiet";

/** One scannable editorial dimension for the workspace masthead (no fabricated metrics). */
export type EditorialDimensionTile = {
  id: string;
  label: string;
  primary: string;
  secondary?: string;
  tone: OverviewTone;
  /** In-app route (path + optional hash) */
  to: string;
};

function briefSecondaryLine(brief: StoryBriefResponse): string {
  let scope: string;
  if (brief.time_scope_mode === "bounded_range" && (brief.time_scope_start || brief.time_scope_end)) {
    scope = "Bounded time range";
  } else if (brief.time_scope_mode === "entire_history") {
    scope = "Full-history scope";
  } else {
    scope = String(brief.time_scope_mode).replace(/_/g, " ");
  }
  return `${brief.story_type.replace(/_/g, " ")} · ${scope}`;
}

function validationPrimary(
  v: GetLatestValidationSuccess["data"] | null,
  fetchFailed: boolean,
): { primary: string; secondary?: string; tone: OverviewTone } {
  if (fetchFailed) {
    return { primary: "Could not load latest run", secondary: "Retry from Draft → Readiness", tone: "caution" };
  }
  if (!v) {
    return { primary: "Loading checks…", tone: "quiet" };
  }
  if (!v.has_validation_run || !v.validation_report) {
    return {
      primary: "No validation run yet",
      secondary: "Run checks from the Draft workspace when the manuscript is stable.",
      tone: "quiet",
    };
  }
  const r = v.validation_report;
  const tone: OverviewTone =
    r.blocker_count > 0 ? "caution" : r.overall_result === "warn" ? "caution" : "emphasis";
  return {
    primary: `${r.blocker_count} blocker${r.blocker_count === 1 ? "" : "s"} · ${r.warning_count} warning${r.warning_count === 1 ? "" : "s"}`,
    secondary: r.summary_note?.slice(0, 120) + (r.summary_note && r.summary_note.length > 120 ? "…" : ""),
    tone,
  };
}

/**
 * Builds honest editorial dashboard tiles from data the API already exposes.
 * Callers should pass null counts only when the corresponding list request failed.
 */
export function buildEditorialOverviewTiles(input: {
  base: string;
  brief: StoryBriefResponse | null;
  workflow: CreatorWorkflowState | null;
  frames: ListFramesSuccess["data"] | null;
  sectionCount: number | null;
  eventCount: number | null;
  validation: GetLatestValidationSuccess["data"] | null;
  validationFetchFailed: boolean;
}): EditorialDimensionTile[] {
  const { base, brief, workflow, frames, sectionCount, eventCount, validation, validationFetchFailed } = input;
  const wf = workflow;

  const briefPrimary = brief
    ? (() => {
        const s = brief.subject?.trim();
        if (!s) return "Brief open — add a working subject";
        return s.length > 52 ? `${s.slice(0, 51)}…` : s;
      })()
    : "Brief not loaded in this browser yet";

  const briefSecondary = brief ? briefSecondaryLine(brief) : undefined;
  const briefTone: OverviewTone =
    wf === "drafting_brief" || wf === "awaiting_framing_choice" ? "emphasis" : brief ? "neutral" : "quiet";

  const fc = frames?.frame_drafts?.length ?? 0;
  const selected = frames?.frame_drafts?.some((f) => f.is_selected) ?? false;
  let framingPrimary = "No framing candidates yet";
  let framingSecondary: string | undefined;
  if (fc > 0) {
    framingPrimary = selected ? `${fc} candidates · framing locked in` : `${fc} framing candidates`;
    framingSecondary =
      wf === "awaiting_framing_choice" ? "Choose a frame to continue toward assembly." : undefined;
  }

  const hasDraft = Boolean(frames?.story_draft);
  let manuscriptPrimary = hasDraft ? "Draft row present" : "Awaiting draft assembly";
  let manuscriptSecondary: string | undefined;
  if (hasDraft && sectionCount !== null && eventCount !== null) {
    manuscriptSecondary = `${sectionCount} section${sectionCount === 1 ? "" : "s"} · ${eventCount} timeline row${eventCount === 1 ? "" : "s"}`;
  } else if (hasDraft) {
    manuscriptSecondary = "Open Draft for live counts.";
  }

  const published = frames?.story_lifecycle_status === "published";
  const livePrimary = published ? "Reader snapshot is live" : "Not published yet";
  const liveSecondary = published
    ? frames?.story_slug
      ? `Slug /stories/${frames.story_slug}`
      : "Public slug will appear after publish metadata syncs."
    : "Preview still reflects working draft material only.";

  const val = validationPrimary(validation, validationFetchFailed);

  const ev = eventCount;
  const timelinePrimary =
    ev === null ? "Timeline status unavailable" : ev === 0 ? "No ordered events yet" : `${ev} ordered event${ev === 1 ? "" : "s"}`;
  const timelineSecondary =
    ev !== null && ev > 0
      ? "Evidence is threaded per event in Sources & coverage."
      : "Add events to anchor dates, then attach references.";

  return [
    {
      id: "brief",
      label: "Brief",
      primary: briefPrimary,
      secondary: briefSecondary,
      tone: briefTone,
      to: `${base}/brief`,
    },
    {
      id: "framing",
      label: "Framing",
      primary: framingPrimary,
      secondary: framingSecondary,
      tone: fc > 0 && !selected && wf === "awaiting_framing_choice" ? "emphasis" : fc > 0 ? "neutral" : "quiet",
      to: `${base}/framing`,
    },
    {
      id: "manuscript",
      label: "Manuscript",
      primary: manuscriptPrimary,
      secondary: manuscriptSecondary,
      tone: hasDraft ? "neutral" : "quiet",
      to: `${base}/draft`,
    },
    {
      id: "checks",
      label: "Checks",
      primary: val.primary,
      secondary: val.secondary,
      tone: val.tone,
      to: `${base}/draft#editor-validation-heading`,
    },
    {
      id: "preview",
      label: "Reader preview",
      primary: hasDraft ? "Draft-fed reader layout ready" : "Preview unlocks after assembly",
      secondary: hasDraft
        ? "Same blocks as publish — still not the frozen public snapshot."
        : "Assemble a draft to load preview data.",
      tone: hasDraft ? "neutral" : "quiet",
      to: `${base}/draft#creator-story-preview`,
    },
    {
      id: "live",
      label: "Public story",
      primary: livePrimary,
      secondary: liveSecondary,
      tone: published ? "live" : "neutral",
      to: `${base}/draft#post-publish-live`,
    },
    {
      id: "timeline",
      label: "Timeline & evidence",
      primary: timelinePrimary,
      secondary: timelineSecondary,
      tone: ev !== null && ev > 0 ? "neutral" : "quiet",
      to: `${base}/draft#timeline-events`,
    },
  ];
}
