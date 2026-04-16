import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BriefImageryMode, CreatorWorkflowState } from "@storywall/shared";
import {
  ApiRequestError,
  assembleDraft,
  createEvent,
  createSection,
  extractConflictDraft,
  getLatestValidation,
  publishStory,
  patchValidationIssueResolution,
  listEvents,
  listFrames,
  listRevisions,
  listSections,
  patchStoryDraft,
  restoreRevision,
  runStoryValidation,
} from "../api/creatorClient";
import type {
  EventDraftResponse,
  PatchStoryDraftBody,
  SectionDraftResponse,
  SourceRecordResponse,
  RevisionEntryResponse,
  StoryDraftResponse,
  ValidationIssueRow,
  GetLatestValidationSuccess,
  ListFramesSuccess,
} from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { NarrativeSectionsCompositionPanel } from "../components/NarrativeSectionsComposition";
import { CreatorPreviewPanel } from "../components/CreatorPreviewPanel";
import { EvidenceWorkspacePanel } from "../components/EvidenceWorkspacePanel";
import { HeroMediaWorkflowPanel } from "../components/HeroMediaWorkflowPanel";
import { TimelineEventsManagementPanel } from "../components/TimelineEventsManagement";
import { rememberActiveJob } from "../lib/activeJobStorage";

const AUTOSAVE_MS = 600;

/** M3-T07 — publish confirmation wiring from DraftReadyPage into PublishReadinessBlock. */
type EditorPublishFlowProps = {
  needsWarningAck: boolean;
  publishConfirmOpen: boolean;
  publishBusy: boolean;
  publishError: string | null;
  warnAck: boolean;
  /** True when the story is already live — publish refreshes the frozen public snapshot (M4-T09). */
  isRepublish: boolean;
  onWarnAckChange: (v: boolean) => void;
  onOpenConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmPublish: () => void;
};

/** M3-T04 — editorial workspace states where validation UI and draft editing apply. */
const EDITORIAL_VALIDATION_WORKFLOWS: CreatorWorkflowState[] = [
  "ready_for_edit",
  "needs_validation",
  "blocked",
  "ready_to_publish",
  /** M4-T09 — post-publish draft edits while the reader still sees the last snapshot until republish. */
  "published",
];

function isEditorialValidationWorkspace(w: CreatorWorkflowState | null): boolean {
  return w !== null && EDITORIAL_VALIDATION_WORKFLOWS.includes(w);
}

/** M3-T06 + M3-T07 — publish readiness copy; `workflow` is primary; validation snapshot is explanatory only. */
function PublishReadinessBlock(props: {
  workflow: CreatorWorkflowState;
  validationData: GetLatestValidationSuccess["data"] | null;
  validationLoading: boolean;
  onScrollToIssues: () => void;
  publishFlow: EditorPublishFlowProps | null;
  /** Story lifecycle `published` — readers see a frozen snapshot until checks + republish. */
  storyLivePublished: boolean;
}): ReactNode {
  const { workflow, validationData, validationLoading, onScrollToIssues, publishFlow, storyLivePublished } = props;
  const report = validationData?.validation_report ?? null;
  const hasRun = validationData?.has_validation_run === true;
  const warnRemaining =
    workflow === "ready_to_publish" && report?.overall_result === "warn";

  if (workflow === "ready_for_edit") {
    return (
      <div className="editor-publish-readiness">
        <p className="editor-panel__eyebrow">Publish</p>
        <p className="editor-publish-readiness__status">Editing in progress</p>
        <p className="editor-publish-readiness__detail muted small">
          Keep shaping your draft. Publishing is not the active step yet. When you want a publish-readiness signal, run
          checks above.
        </p>
        {storyLivePublished ? (
          <p className="editor-publish-readiness__detail muted small">
            The public reader still shows your last published snapshot until you run checks and update the live story.
          </p>
        ) : null}
        {validationLoading ? (
          <p className="muted small editor-publish-readiness__meta">Loading latest check details…</p>
        ) : null}
      </div>
    );
  }

  if (workflow === "needs_validation") {
    return (
      <div className="editor-publish-readiness">
        <p className="editor-panel__eyebrow">Publish</p>
        <p className="editor-publish-readiness__status">Checks required</p>
        <p className="editor-publish-readiness__detail muted small">
          Publishing is not available in this workflow state until you run checks and the story can advance. Use{" "}
          <strong>Run checks</strong> above.
        </p>
        {storyLivePublished ? (
          <p className="editor-publish-readiness__detail muted small">
            While you wait, the live reader still shows your last published snapshot.
          </p>
        ) : null}
        {validationLoading ? (
          <p className="muted small editor-publish-readiness__meta">Loading latest check details…</p>
        ) : null}
      </div>
    );
  }

  if (workflow === "published" && storyLivePublished) {
    return (
      <div className="editor-publish-readiness">
        <p className="editor-panel__eyebrow">Publish</p>
        <p className="editor-publish-readiness__status">Live — snapshot refresh pending</p>
        <p className="editor-publish-readiness__detail muted small">
          Draft changes in this workspace are <strong>not</strong> on the public reader until you run{" "}
          <strong>Run checks</strong> and then <strong>Update live story</strong>. Readers still see the frozen snapshot
          from your last successful publish.
        </p>
        {validationLoading ? (
          <p className="muted small editor-publish-readiness__meta">Loading latest check details…</p>
        ) : null}
      </div>
    );
  }

  if (workflow === "blocked") {
    return (
      <div className="editor-publish-readiness">
        <p className="editor-panel__eyebrow">Publish</p>
        <p className="editor-publish-readiness__status">Publishing blocked</p>
        <p className="editor-publish-readiness__detail muted small">
          Your story cannot move toward publish until blockers from the latest run are addressed. Review the issues
          below, make edits, then run checks again.
        </p>
        {storyLivePublished ? (
          <p className="editor-publish-readiness__detail muted small">
            The live reader view stays on your last successful publish until checks pass again.
          </p>
        ) : null}
        <div className="editor-publish-readiness__actions">
          <button type="button" className="btn ghost inline" onClick={onScrollToIssues}>
            View issues list
          </button>
        </div>
        {validationLoading ? (
          <p className="muted small editor-publish-readiness__meta">Loading latest check details…</p>
        ) : null}
      </div>
    );
  }

  if (workflow === "ready_to_publish") {
    const needsRerunNote = !hasRun;
    const republish = storyLivePublished;
    return (
      <div className="editor-publish-readiness">
        <p className="editor-panel__eyebrow">Publish</p>
        <p className="editor-publish-readiness__status">
          {republish ? "Ready to update the live story" : "Ready for publish"}
        </p>
        {hasRun && report ? (
          <p className="editor-publish-readiness__detail muted small">
            {republish
              ? "Checks allow refreshing the published reader snapshot from your current draft."
              : "Your workflow allows moving toward publish. The latest recorded check run did not report blockers."}
          </p>
        ) : hasRun && !report ? (
          <p className="editor-publish-readiness__detail muted small">
            Your workflow allows moving toward publish. Check details were not returned; run <strong>Run checks</strong>{" "}
            above again if anything changed.
          </p>
        ) : (
          <p className="editor-publish-readiness__detail muted small">
            {republish
              ? "Your workflow is ready to push draft changes to the live reader."
              : "Your workflow is ready for publish from a process standpoint."}
          </p>
        )}
        {needsRerunNote ? (
          <p className="editor-publish-readiness__detail muted small">
            There is no completed check on file—run <strong>Run checks</strong> above again to confirm nothing changed
            since your workflow advanced.
          </p>
        ) : null}
        {warnRemaining ? (
          <p className="editor-publish-readiness__detail muted small">
            Warnings still appear in the list below; they do not block publishing when your workflow is ready.
          </p>
        ) : null}
        {validationLoading ? (
          <p className="muted small editor-publish-readiness__meta">Loading latest check details…</p>
        ) : null}
        {publishFlow ? (
          publishFlow.publishConfirmOpen ? (
            <div className="editor-publish-readiness__confirm">
              {publishFlow.publishError ? <p className="hint">{publishFlow.publishError}</p> : null}
              <p className="editor-publish-readiness__detail muted small">
                {publishFlow.isRepublish ? (
                  <>
                    This replaces the <strong>frozen reader snapshot</strong> with your current draft (title, body,
                    timeline, and public sources). It does not change the story&apos;s public address.
                  </>
                ) : (
                  <>
                    Publishing marks this story as published in Storywall. You can keep editing from other flows when
                    available, but this step is meant to be deliberate.
                  </>
                )}
              </p>
              {publishFlow.needsWarningAck ? (
                <label className="editor-publish-readiness__ack">
                  <input
                    type="checkbox"
                    checked={publishFlow.warnAck}
                    onChange={(e) => publishFlow.onWarnAckChange(e.target.checked)}
                  />
                  <span>I understand warnings remain on the latest check run.</span>
                </label>
              ) : null}
              <div className="editor-publish-readiness__actions">
                <button
                  type="button"
                  className="btn ghost inline"
                  disabled={publishFlow.publishBusy}
                  onClick={publishFlow.onCancelConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary inline"
                  disabled={
                    publishFlow.publishBusy ||
                    (publishFlow.needsWarningAck && !publishFlow.warnAck)
                  }
                  onClick={publishFlow.onConfirmPublish}
                >
                  {publishFlow.publishBusy
                    ? publishFlow.isRepublish
                      ? "Updating…"
                      : "Publishing…"
                    : publishFlow.isRepublish
                      ? "Confirm update to live story"
                      : "Confirm publish"}
                </button>
              </div>
            </div>
          ) : (
            <div className="editor-publish-readiness__actions">
              <button
                type="button"
                className="btn primary inline"
                disabled={validationLoading}
                onClick={publishFlow.onOpenConfirm}
              >
                {publishFlow.isRepublish ? "Update live story" : "Publish story"}
              </button>
            </div>
          )
        ) : null}
      </div>
    );
  }

  return null;
}

function validationObjectLabel(issue: ValidationIssueRow): string {
  if (issue.object_type === "story") return "Story";
  if (issue.object_type === "event") {
    return issue.event_label ? `Event — ${issue.event_label}` : "Event";
  }
  if (issue.object_type === "section") return "Section";
  if (issue.object_type === "source") return "Reference";
  if (issue.object_type === "image") return "Image";
  return issue.object_type;
}

function resolveIfMatchFromSnapshot(
  snapshot: unknown,
  ctx: {
    draft: StoryDraftResponse | null;
    sections: SectionDraftResponse[];
    events: EventDraftResponse[];
  },
): string | null {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const o = snapshot as { kind?: string; section_id?: string; event_id?: string };
  if (o.kind === "story_draft") {
    return ctx.draft?.last_edited_at ?? null;
  }
  if (o.kind === "section_draft" && o.section_id) {
    return ctx.sections.find((s) => s.id === o.section_id)?.updated_at ?? null;
  }
  if (o.kind === "event_draft" && o.event_id) {
    return ctx.events.find((e) => e.id === o.event_id)?.updated_at ?? null;
  }
  if (o.kind === "source_record") {
    return null;
  }
  return null;
}

type LocalDraftFields = {
  title: string;
  subtitle: string;
  summary: string;
  lens: string;
  conclusion: string;
  imageryMode: BriefImageryMode;
};

function normalizeSubtitle(s: string | null | undefined): string {
  return s ?? "";
}

function normalizeConclusion(s: string | null | undefined): string {
  return s ?? "";
}

function isDirtyVersusServer(draft: StoryDraftResponse, local: LocalDraftFields): boolean {
  if (local.title !== draft.title) return true;
  if (local.subtitle !== normalizeSubtitle(draft.subtitle)) return true;
  if (local.summary !== draft.summary) return true;
  if (local.lens !== draft.lens) return true;
  if (local.conclusion !== normalizeConclusion(draft.conclusion)) return true;
  if (local.imageryMode !== (draft.imagery_mode as BriefImageryMode)) return true;
  return false;
}

/** Partial PATCH body for changed fields only; returns null if nothing to send or if required fields would be invalid. */
function buildValidPatch(draft: StoryDraftResponse, local: LocalDraftFields): PatchStoryDraftBody | null {
  const p: PatchStoryDraftBody = {};
  if (local.title !== draft.title) {
    p.title = local.title;
  }
  if (local.subtitle !== normalizeSubtitle(draft.subtitle)) {
    p.subtitle = local.subtitle === "" ? null : local.subtitle;
  }
  if (local.summary !== draft.summary) {
    p.summary = local.summary;
  }
  if (local.lens !== draft.lens) {
    p.lens = local.lens;
  }
  if (local.conclusion !== normalizeConclusion(draft.conclusion)) {
    p.conclusion = local.conclusion === "" ? null : local.conclusion;
  }
  if (local.imageryMode !== (draft.imagery_mode as BriefImageryMode)) {
    p.imagery_mode = local.imageryMode;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.title !== undefined && p.title.trim().length < 1) return null;
  if (p.summary !== undefined && p.summary.trim().length < 1) return null;
  if (p.lens !== undefined && p.lens.trim().length < 1) return null;
  return p;
}

/** M4-T08 — include in-progress deck fields so preview matches the form before autosave completes. */
function mergeDraftWithLocalForPreview(draft: StoryDraftResponse, local: LocalDraftFields): StoryDraftResponse {
  return {
    ...draft,
    title: local.title,
    subtitle: local.subtitle.trim() === "" ? null : local.subtitle,
    summary: local.summary,
    lens: local.lens,
    conclusion: local.conclusion === "" ? null : local.conclusion,
    imagery_mode: local.imageryMode,
  };
}

function applyServerDraftToForm(d: StoryDraftResponse, setters: {
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setSummary: (v: string) => void;
  setLens: (v: string) => void;
  setConclusion: (v: string) => void;
  setImageryMode: (v: BriefImageryMode) => void;
}) {
  setters.setTitle(d.title);
  setters.setSubtitle(normalizeSubtitle(d.subtitle));
  setters.setSummary(d.summary);
  setters.setLens(d.lens);
  setters.setConclusion(normalizeConclusion(d.conclusion));
  setters.setImageryMode(d.imagery_mode as BriefImageryMode);
}

/**
 * M2-T06 entry + M2-T07 story-level draft autosave (mutation §12.1).
 */
export function DraftReadyPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [lens, setLens] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [imageryMode, setImageryMode] = useState<BriefImageryMode>("selective_editorial");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [sections, setSections] = useState<SectionDraftResponse[]>([]);
  const [sectionsLoadError, setSectionsLoadError] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [events, setEvents] = useState<EventDraftResponse[]>([]);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [scopedRegenBusy, setScopedRegenBusy] = useState(false);
  const [scopedRegenTarget, setScopedRegenTarget] = useState<
    { kind: "event" | "section"; id: string } | null
  >(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionEntryResponse[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<GetLatestValidationSuccess["data"] | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [runValidationBusy, setRunValidationBusy] = useState(false);
  const [resolutionBusyIssueId, setResolutionBusyIssueId] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishWarnAck, setPublishWarnAck] = useState(false);
  const [publishOk, setPublishOk] = useState(false);
  const [storyLifecycleStatus, setStoryLifecycleStatus] = useState<string | null>(null);
  const [publishedAtIso, setPublishedAtIso] = useState<string | null>(null);
  const [storySlug, setStorySlug] = useState<string | null>(null);
  const publishOutcomeKindRef = useRef<"first" | "republish">("first");
  const scrollValidationIssuesIntoView = useCallback(() => {
    const target =
      document.getElementById("editor-validation-issue-list") ??
      document.getElementById("editor-validation-report-start") ??
      document.getElementById("editor-validation-heading");
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const localFields: LocalDraftFields = { title, subtitle, summary, lens, conclusion, imageryMode };

  const previewDraftMerged = useMemo(
    () => (draft ? mergeDraftWithLocalForPreview(draft, localFields) : null),
    [draft, title, subtitle, summary, lens, conclusion, imageryMode],
  );

  const ingestFramesData = useCallback((data: ListFramesSuccess["data"]) => {
    setWorkflow(data.story_state);
    setStoryLifecycleStatus(data.story_lifecycle_status ?? null);
    setPublishedAtIso(data.published_at ?? null);
    setStorySlug(data.story_slug ?? null);
    const d = data.story_draft;
    setDraft(d);
    if (d) {
      applyServerDraftToForm(d, {
        setTitle,
        setSubtitle,
        setSummary,
        setLens,
        setConclusion,
        setImageryMode,
      });
    }
  }, []);

  const refreshSections = useCallback(async () => {
    if (!token || !storyId) return;
    setSectionsLoadError(null);
    try {
      const r = await listSections(token, storyId);
      setSections(r.data.sections);
    } catch (e) {
      setSectionsLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load sections.");
    }
  }, [token, storyId]);

  const refreshEvents = useCallback(async () => {
    if (!token || !storyId) return;
    setEventsLoadError(null);
    try {
      const r = await listEvents(token, storyId);
      setEvents(r.data.events);
    } catch (e) {
      setEventsLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load events.");
    }
  }, [token, storyId]);

  const handleSectionPatched = useCallback((s: SectionDraftResponse) => {
    setSections((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  const handleSectionConflict = useCallback(() => {
    setSaveError("Version conflict — section refreshed from the server.");
  }, []);

  const handleSectionSaveError = useCallback((message: string) => {
    setSaveError(message);
  }, []);

  const handleAddSection = useCallback(() => {
    if (!token || !storyId) return;
    setAddingSection(true);
    void (async () => {
      try {
        const r = await createSection(token, storyId, { label: "New section" });
        setSections((prev) => [...prev, r.data.section_draft]);
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add section.");
      } finally {
        setAddingSection(false);
      }
    })();
  }, [token, storyId]);

  const handleEventPatched = useCallback((ev: EventDraftResponse) => {
    setEvents((prev) => prev.map((x) => (x.id === ev.id ? ev : x)));
  }, []);

  const handleEventConflict = useCallback(() => {
    setSaveError("Version conflict — event refreshed from the server.");
  }, []);

  const handleEventSaveError = useCallback((message: string) => {
    setSaveError(message);
  }, []);

  const handleAddEvent = useCallback(
    (opts: { section_id?: string | null }) => {
      if (!token || !storyId) return;
      setAddingEvent(true);
      void (async () => {
        try {
          const body: { headline: string; summary: string; section_id?: string } = {
            headline: "New event",
            summary: "Draft event summary.",
          };
          if (opts.section_id) {
            body.section_id = opts.section_id;
          }
          const r = await createEvent(token, storyId, body);
          setEvents((prev) => [...prev, r.data.event_draft]);
          setSaveError(null);
        } catch (e) {
          setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add event.");
        } finally {
          setAddingEvent(false);
        }
      })();
    },
    [token, storyId],
  );

  const startScopedEventRegenerate = useCallback(
    async (eventId: string) => {
      if (!token || !storyId) return;
      if (
        !window.confirm(
          "Replace this event’s text, dates, and sources from the latest research chronology? Other events and story copy stay as you edited them. Your creator note on this event is kept.",
        )
      ) {
        return;
      }
      setScopedRegenBusy(true);
      setScopedRegenTarget({ kind: "event", id: eventId });
      setSaveError(null);
      try {
        const res = await assembleDraft(
          token,
          storyId,
          {
            mode: "scoped_event_regeneration",
            preserve_creator_notes: true,
            preserve_manual_event_positions: true,
            preserve_approved_images: true,
            scoped_event_id: eventId,
          },
          crypto.randomUUID(),
        );
        rememberActiveJob(storyId, res.data.job_id);
        navigate(`/creator/stories/${storyId}/jobs/${res.data.job_id}`);
      } catch (e) {
        setSaveError(
          e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not start event regeneration.",
        );
      } finally {
        setScopedRegenBusy(false);
        setScopedRegenTarget(null);
      }
    },
    [navigate, storyId, token],
  );

  useEffect(() => {
    if (!historyOpen || !token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setRevisionsLoading(true);
      setRevisionsError(null);
      try {
        const r = await listRevisions(token, storyId);
        if (!cancelled) {
          setRevisions(r.data.revisions);
        }
      } catch (e) {
        if (!cancelled) {
          setRevisionsError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load revisions.");
        }
      } finally {
        if (!cancelled) {
          setRevisionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyOpen, token, storyId]);

  const handleRestoreRevision = useCallback(
    async (rev: RevisionEntryResponse) => {
      if (!token || !storyId) return;
      const ifMatch = resolveIfMatchFromSnapshot(rev.recovery_snapshot, {
        draft,
        sections,
        events,
      });
      if (!ifMatch) {
        setSaveError(
          "Cannot restore this entry: refresh the page, or for sources load the event and use a future source-specific restore.",
        );
        return;
      }
      if (
        !window.confirm(
          "Replace the current version with the saved snapshot from this revision? Unsaved local edits to that object may be overwritten on the next refresh.",
        )
      ) {
        return;
      }
      setRestoringRevisionId(rev.id);
      setSaveError(null);
      try {
        await restoreRevision(token, storyId, rev.id, ifMatch);
        const rFrames = await listFrames(token, storyId);
        ingestFramesData(rFrames.data);
        await refreshSections();
        await refreshEvents();
        setSaveOk(true);
        window.setTimeout(() => setSaveOk(false), 2000);
        const rList = await listRevisions(token, storyId);
        setRevisions(rList.data.revisions);
      } catch (e) {
        setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Restore failed.");
      } finally {
        setRestoringRevisionId(null);
      }
    },
    [draft, events, ingestFramesData, refreshEvents, refreshSections, sections, storyId, token],
  );

  const startScopedSectionRegenerate = useCallback(
    async (sectionId: string) => {
      if (!token || !storyId) return;
      if (
        !window.confirm(
          "Reload this section’s label and summary from the selected framing candidate for this slot? Timeline events stay as edited.",
        )
      ) {
        return;
      }
      setScopedRegenBusy(true);
      setScopedRegenTarget({ kind: "section", id: sectionId });
      setSaveError(null);
      try {
        const res = await assembleDraft(
          token,
          storyId,
          {
            mode: "scoped_section_regeneration",
            preserve_creator_notes: true,
            preserve_manual_event_positions: true,
            preserve_approved_images: true,
            scoped_section_id: sectionId,
          },
          crypto.randomUUID(),
        );
        rememberActiveJob(storyId, res.data.job_id);
        navigate(`/creator/stories/${storyId}/jobs/${res.data.job_id}`);
      } catch (e) {
        setSaveError(
          e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not start section regeneration.",
        );
      } finally {
        setScopedRegenBusy(false);
        setScopedRegenTarget(null);
      }
    },
    [navigate, storyId, token],
  );

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        ingestFramesData(r.data);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load story.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId, ingestFramesData]);

  useEffect(() => {
    if (!token || !storyId || !draft || !isEditorialValidationWorkspace(workflow)) return;
    void refreshSections();
    void refreshEvents();
  }, [token, storyId, draft, workflow, refreshSections, refreshEvents]);

  useEffect(() => {
    if (!token || !storyId || !isEditorialValidationWorkspace(workflow)) return;
    let cancelled = false;
    void (async () => {
      setValidationLoading(true);
      setValidationError(null);
      try {
        const r = await getLatestValidation(token, storyId);
        if (!cancelled) {
          setValidationData(r.data);
        }
      } catch (e) {
        if (!cancelled) {
          setValidationError(
            e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load validation results.",
          );
        }
      } finally {
        if (!cancelled) {
          setValidationLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId, workflow]);

  useEffect(() => {
    if (!token || !storyId || !draft || !isEditorialValidationWorkspace(workflow)) return;
    if (!isDirtyVersusServer(draft, localFields)) return;
    const patch = buildValidPatch(draft, localFields);
    if (!patch) return;

    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchStoryDraft(token, storyId, draft.last_edited_at, patch);
          setDraft(res.data.story_draft);
          applyServerDraftToForm(res.data.story_draft, {
            setTitle,
            setSubtitle,
            setSummary,
            setLens,
            setConclusion,
            setImageryMode,
          });
          setSaveError(null);
          setSaveOk(true);
          window.setTimeout(() => setSaveOk(false), 2000);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const server = extractConflictDraft(e.body);
            if (server) {
              setDraft(server);
              applyServerDraftToForm(server, {
                setTitle,
                setSubtitle,
                setSummary,
                setLens,
                setConclusion,
                setImageryMode,
              });
            }
            setSaveError("Version conflict — loaded the latest draft from the server.");
          } else {
            setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(t);
  }, [token, storyId, draft, workflow, title, subtitle, summary, lens, conclusion, imageryMode]);

  const handleRunValidation = useCallback(async () => {
    if (!token || !storyId) return;
    setRunValidationBusy(true);
    setValidationError(null);
    try {
      await runStoryValidation(token, storyId, crypto.randomUUID(), {
        run_type: "full",
        include_style_checks: true,
        include_imagery_checks: true,
        include_dispute_checks: true,
      });
      const fr = await listFrames(token, storyId);
      ingestFramesData(fr.data);
      await refreshSections();
      await refreshEvents();
      const latest = await getLatestValidation(token, storyId);
      setValidationData(latest.data);
    } catch (e) {
      setValidationError(
        e instanceof ApiRequestError ? JSON.stringify(e.body) : "Validation run failed.",
      );
    } finally {
      setRunValidationBusy(false);
    }
  }, [token, storyId, ingestFramesData, refreshSections, refreshEvents]);

  const needsValidationWarningAck =
    validationData?.validation_report?.overall_result === "warn";

  const handleConfirmPublish = useCallback(async () => {
    if (!token || !storyId) return;
    if (needsValidationWarningAck && !publishWarnAck) {
      setPublishError("Check the box to acknowledge warnings before publishing.");
      return;
    }
    setPublishBusy(true);
    setPublishError(null);
    publishOutcomeKindRef.current = storyLifecycleStatus === "published" ? "republish" : "first";
    try {
      await publishStory(token, storyId, crypto.randomUUID(), {
        acknowledge_validation_warnings: needsValidationWarningAck ? true : undefined,
      });
      const fr = await listFrames(token, storyId);
      ingestFramesData(fr.data);
      await refreshSections();
      await refreshEvents();
      setPublishConfirmOpen(false);
      setPublishWarnAck(false);
      setPublishOk(true);
      window.setTimeout(() => setPublishOk(false), 5000);
    } catch (e) {
      setPublishError(
        e instanceof ApiRequestError ? JSON.stringify(e.body) : "Publish failed.",
      );
    } finally {
      setPublishBusy(false);
    }
  }, [
    token,
    storyId,
    storyLifecycleStatus,
    needsValidationWarningAck,
    publishWarnAck,
    ingestFramesData,
    refreshSections,
    refreshEvents,
  ]);

  const handlePatchIssueResolution = useCallback(
    async (issueId: string, resolution_status: "open" | "resolved") => {
      if (!token || !storyId) return;
      setResolutionBusyIssueId(issueId);
      setValidationError(null);
      try {
        await patchValidationIssueResolution(token, storyId, issueId, crypto.randomUUID(), {
          resolution_status,
        });
        const latest = await getLatestValidation(token, storyId);
        setValidationData(latest.data);
      } catch (e) {
        setValidationError(
          e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not update issue resolution.",
        );
      } finally {
        setResolutionBusyIssueId(null);
      }
    },
    [token, storyId],
  );

  if (!storyId) {
    return (
      <div className="page narrow">
        <p>Invalid story.</p>
      </div>
    );
  }

  const storyLivePublished = storyLifecycleStatus === "published";

  return (
    <div className="page draft-workspace-page">
      <h2 className="page-title">Draft ready</h2>
      <p className="page-lead muted">
        Main composition and checks — story <code className="inline-code">{storyId}</code>
      </p>

      {loadError ? <div className="banner error">{loadError}</div> : null}
      {saveError ? <div className="banner error">{saveError}</div> : null}
      {saveOk ? <div className="banner success">Draft saved.</div> : null}
      {publishOk ? (
        <div className="banner success">
          {publishOutcomeKindRef.current === "republish"
            ? "Published reader snapshot updated from your current draft."
            : "Story published."}
        </div>
      ) : null}

      {!loadError && workflow && !isEditorialValidationWorkspace(workflow) ? (
        <div className="banner warn">
          <p>
            Current workflow is <strong>{workflow}</strong>. This page is for editing an assembled draft. Use the brief
            workspace to run research or draft assembly, or open generation status if you have a job link.
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              Brief workspace
            </Link>
          </div>
        </div>
      ) : null}

      {!loadError && isEditorialValidationWorkspace(workflow) ? (
        <div className="card draft-ready-card">
          <p className="draft-ready-badge">{workflow}</p>
          <div className="editor-workspace-intro">
            <h2 className="draft-ready-title">Your draft workspace is open</h2>
            <p className="editor-workspace-lead muted small">
              Use <strong>Narrative sections</strong> for the ordered story body, <strong>Events</strong> for the
              timeline, <strong>Sources &amp; coverage</strong> for evidence, <strong>Hero imagery policy</strong> for
              how visuals are treated, <strong>Reader preview</strong> to see draft content in the public reader layout,
              and deck fields for discovery copy. Changes save automatically.
              {storyLivePublished ? (
                <>
                  {" "}
                  This story is <strong>already live</strong>: the public reader uses a frozen snapshot until you run
                  checks and update the live story.
                </>
              ) : null}
            </p>
          </div>
          {draft ? (
            <>
              <div className="editor-shell">
              {storyLivePublished && storySlug ? (
                <section
                  className="editor-panel editor-panel--post-publish"
                  id="post-publish-live"
                  aria-labelledby="post-publish-live-heading"
                >
                  <div className="editor-panel__head">
                    <p className="editor-panel__eyebrow">Live story</p>
                    <h3 id="post-publish-live-heading" className="editor-panel__title">
                      What readers see today
                    </h3>
                    <p className="editor-panel__hint">
                      The reader page is built from the last successful publish, not from unsaved draft edits. Open the
                      public story in another tab to compare; Storywall does not yet show an automatic diff between
                      snapshot and draft.
                    </p>
                  </div>
                  <p className="muted small">
                    Last published{" "}
                    {publishedAtIso
                      ? new Date(publishedAtIso).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                    . Public address:{" "}
                    <Link to={`/stories/${encodeURIComponent(storySlug)}`}>/stories/{storySlug}</Link>
                  </p>
                </section>
              ) : null}
              <section
                className="editor-panel editor-panel--validation"
                aria-labelledby="editor-validation-heading"
              >
                <div className="editor-panel__head">
                  <p className="editor-panel__eyebrow">Readiness</p>
                  <h3 id="editor-validation-heading" className="editor-panel__title">
                    Validation
                  </h3>
                  <p className="editor-panel__hint">
                    Latest checks against Storywall baseline and reference rules. Re-run after you edit.
                  </p>
                  <button
                    type="button"
                    className="btn ghost inline"
                    disabled={!token || runValidationBusy || validationLoading}
                    onClick={() => void handleRunValidation()}
                  >
                    {runValidationBusy ? "Running checks…" : "Run checks"}
                  </button>
                </div>
                {workflow ? (
                  <PublishReadinessBlock
                    workflow={workflow}
                    validationData={validationData}
                    validationLoading={validationLoading}
                    onScrollToIssues={scrollValidationIssuesIntoView}
                    storyLivePublished={storyLivePublished}
                    publishFlow={
                      workflow === "ready_to_publish"
                        ? {
                            needsWarningAck:
                              validationData?.validation_report?.overall_result === "warn",
                            publishConfirmOpen,
                            publishBusy,
                            publishError,
                            warnAck: publishWarnAck,
                            isRepublish: storyLivePublished,
                            onWarnAckChange: setPublishWarnAck,
                            onOpenConfirm: () => {
                              setPublishError(null);
                              setPublishConfirmOpen(true);
                            },
                            onCancelConfirm: () => {
                              setPublishConfirmOpen(false);
                              setPublishWarnAck(false);
                              setPublishError(null);
                            },
                            onConfirmPublish: () => void handleConfirmPublish(),
                          }
                        : null
                    }
                  />
                ) : null}
                {validationLoading ? (
                  <p className="muted small">Loading validation…</p>
                ) : validationError ? (
                  <p className="hint">{validationError}</p>
                ) : validationData && !validationData.has_validation_run ? (
                  <p className="muted small">No validation run yet. Run checks when you are ready to review publish readiness.</p>
                ) : validationData?.validation_report ? (
                  <div className="editor-validation-body" id="editor-validation-report-start">
                    <div className="editor-validation-summary">
                      <span
                        className={`editor-validation-badge editor-validation-badge--${validationData.validation_report.overall_result}`}
                      >
                        {validationData.validation_report.overall_result}
                      </span>
                      <span className="editor-validation-counts muted small">
                        {validationData.validation_report.blocker_count} blocker
                        {validationData.validation_report.blocker_count === 1 ? "" : "s"} ·{" "}
                        {validationData.validation_report.warning_count} warning
                        {validationData.validation_report.warning_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="editor-validation-note">{validationData.validation_report.summary_note}</p>
                    <p className="muted small editor-validation-meta">
                      {new Date(validationData.validation_report.created_at).toLocaleString()} ·{" "}
                      {validationData.validation_report.run_type} · {validationData.validation_report.run_source}
                    </p>
                    {validationData.issues.length > 0 ? (
                      <ul className="editor-validation-issue-list" id="editor-validation-issue-list">
                        {validationData.issues.map((issue) => (
                          <li key={issue.id} className="editor-validation-issue-list__item">
                            <div className="editor-validation-issue-list__scope">
                              <span
                                className={`editor-validation-issue-type editor-validation-issue-type--${issue.object_type}`}
                              >
                                {validationObjectLabel(issue)}
                              </span>
                              <span className="muted small">
                                {issue.issue_type} · {issue.publish_effect}
                              </span>
                            </div>
                            <p className="editor-validation-issue-list__explain">{issue.explanation}</p>
                            {issue.suggested_fix ? (
                              <p className="editor-validation-issue-list__fix">
                                <span className="muted small">Suggested: </span>
                                {issue.suggested_fix}
                              </p>
                            ) : null}
                            <div className="editor-validation-issue-list__actions">
                              {issue.resolution_status === "resolved" ? (
                                <button
                                  type="button"
                                  className="btn ghost inline"
                                  disabled={
                                    !token ||
                                    resolutionBusyIssueId === issue.id ||
                                    runValidationBusy ||
                                    validationLoading
                                  }
                                  onClick={() => void handlePatchIssueResolution(issue.id, "open")}
                                >
                                  {resolutionBusyIssueId === issue.id ? "Updating…" : "Reopen"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn ghost inline"
                                  disabled={
                                    !token ||
                                    resolutionBusyIssueId === issue.id ||
                                    runValidationBusy ||
                                    validationLoading
                                  }
                                  onClick={() => void handlePatchIssueResolution(issue.id, "resolved")}
                                >
                                  {resolutionBusyIssueId === issue.id ? "Updating…" : "Mark resolved"}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">No individual issues recorded for this run.</p>
                    )}
                  </div>
                ) : null}
              </section>

              <NarrativeSectionsCompositionPanel
                token={token!}
                storyId={storyId}
                sections={sections}
                sectionsLoadError={sectionsLoadError}
                addingSection={addingSection}
                onAddSection={handleAddSection}
                onSectionPatched={handleSectionPatched}
                onSectionVersionConflict={handleSectionConflict}
                onSectionSaveError={handleSectionSaveError}
                regenInFlight={scopedRegenBusy}
                regenSectionId={scopedRegenTarget?.kind === "section" ? scopedRegenTarget.id : null}
                onScopedSectionRegenerate={startScopedSectionRegenerate}
              />

              <section className="editor-panel editor-panel--story" aria-labelledby="editor-story-heading">
                <div className="editor-panel__head">
                  <p className="editor-panel__eyebrow">Story</p>
                  <h3 id="editor-story-heading" className="editor-panel__title">
                    Deck &amp; discovery
                  </h3>
                  <p className="editor-panel__hint">
                    Title, deck, and synthesis for discovery and feeds — distinct from ordered narrative sections above.
                  </p>
                </div>
                <div className="editor-fields-stack">
                  <div className="editor-fieldgroup">
                    <p className="editor-fieldgroup__title">Factual &amp; display copy</p>
                    <p className="editor-fieldgroup__lead muted small">
                      What readers see as the story’s neutral overview — keep interpretation out of the summary.
                    </p>
                    <label className="field">
                      <span className="label">Title</span>
                      <span className="field__hint">Working headline for discovery and sharing.</span>
                      <input
                        type="text"
                        className="input"
                        value={title}
                        onChange={(ev) => setTitle(ev.target.value)}
                        autoComplete="off"
                        maxLength={500}
                      />
                    </label>
                    <label className="field">
                      <span className="label">Subtitle</span>
                      <span className="field__hint">Optional supporting line — still factual, not commentary.</span>
                      <input
                        type="text"
                        className="input"
                        value={subtitle}
                        onChange={(ev) => setSubtitle(ev.target.value)}
                        autoComplete="off"
                        maxLength={500}
                      />
                    </label>
                    <label className="field">
                      <span className="label">Summary</span>
                      <span className="field__hint">Short factual overview of the story.</span>
                      <textarea
                        className="input textarea"
                        value={summary}
                        onChange={(ev) => setSummary(ev.target.value)}
                        rows={5}
                        maxLength={100_000}
                      />
                    </label>
                  </div>
                  <div className="editor-fieldgroup editor-fieldgroup--creator">
                    <p className="editor-fieldgroup__title">Framing &amp; synthesis</p>
                    <p className="editor-fieldgroup__lead muted small">
                      Explicit angle and closing synthesis — not neutral reporting.
                    </p>
                    <label className="field">
                      <span className="label">Lens</span>
                      <span className="field__hint">The story’s angle or framing line — interpretive by design.</span>
                      <textarea
                        className="input textarea"
                        value={lens}
                        onChange={(ev) => setLens(ev.target.value)}
                        rows={5}
                        maxLength={100_000}
                      />
                    </label>
                    <label className="field">
                      <span className="label">Conclusion</span>
                      <span className="field__hint">Optional closing synthesis — distinct from factual summary.</span>
                      <textarea
                        className="input textarea"
                        value={conclusion}
                        onChange={(ev) => setConclusion(ev.target.value)}
                        rows={4}
                        maxLength={100_000}
                      />
                    </label>
                  </div>
                </div>
              </section>

              <HeroMediaWorkflowPanel
                value={imageryMode}
                onChange={setImageryMode}
                disabled={!token || !draft}
              />

              <TimelineEventsManagementPanel
                token={token!}
                storyId={storyId}
                events={events}
                sections={sections}
                eventsLoadError={eventsLoadError}
                addingEvent={addingEvent}
                onAddEvent={handleAddEvent}
                onEventPatched={handleEventPatched}
                onEventVersionConflict={handleEventConflict}
                onEventSaveError={handleEventSaveError}
                onRefreshEvents={refreshEvents}
                regenInFlight={scopedRegenBusy}
                regenEventId={scopedRegenTarget?.kind === "event" ? scopedRegenTarget.id : null}
                onScopedEventRegenerate={startScopedEventRegenerate}
              />

              <EvidenceWorkspacePanel
                token={token!}
                storyId={storyId}
                events={events}
                sections={sections}
                onSaveError={handleEventSaveError}
                onVersionConflict={handleEventConflict}
                onRefreshEvents={refreshEvents}
              />

              <CreatorPreviewPanel
                token={token!}
                storyId={storyId}
                draft={previewDraftMerged}
                sections={sections}
                events={events}
              />
            </div>

              <section className="editor-panel editor-panel--revisions" aria-labelledby="editor-revisions-heading">
                <div className="editor-panel__head">
                  <p className="editor-panel__eyebrow">History</p>
                  <h3 id="editor-revisions-heading" className="editor-panel__title">
                    Revision log
                  </h3>
                  <p className="editor-panel__hint">
                    Recent autosaves and regenerations. Restore applies the saved snapshot when available (requires current version to match).
                  </p>
                  <button
                    type="button"
                    className="btn ghost inline"
                    onClick={() => setHistoryOpen((o) => !o)}
                  >
                    {historyOpen ? "Hide history" : "Show history"}
                  </button>
                </div>
                {historyOpen ? (
                  revisionsLoading ? (
                    <p className="muted small">Loading revision log…</p>
                  ) : revisionsError ? (
                    <p className="hint">{revisionsError}</p>
                  ) : revisions.length === 0 ? (
                    <p className="muted small">No revisions recorded yet.</p>
                  ) : (
                    <ul className="editor-revision-list">
                      {revisions.map((r) => {
                        const canRestore =
                          r.recovery_snapshot != null &&
                          resolveIfMatchFromSnapshot(r.recovery_snapshot, {
                            draft,
                            sections,
                            events,
                          }) !== null;
                        return (
                          <li key={r.id} className="editor-revision-list__item">
                            <div>
                              <p className="editor-revision-list__meta">
                                {new Date(r.created_at).toLocaleString()} · {r.revision_type} ·{" "}
                                {r.changed_object_type}
                              </p>
                              <p className="editor-revision-list__summary">{r.change_summary}</p>
                            </div>
                            {canRestore ? (
                              <button
                                type="button"
                                className="btn ghost inline"
                                disabled={restoringRevisionId !== null}
                                onClick={() => void handleRestoreRevision(r)}
                              >
                                {restoringRevisionId === r.id ? "Restoring…" : "Restore"}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : null}
              </section>
            </>
          ) : (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              No story draft row yet — complete framing selection and draft assembly from the brief workspace.
            </p>
          )}
          <div className="draft-ready-actions">
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              {"Brief & generation actions"}
            </Link>
            <Link to={`/creator/stories/${storyId}/framing`} className="btn ghost inline">
              Framing
            </Link>
          </div>
        </div>
      ) : null}

      {!loadError && workflow === null ? (
        <p className="muted" aria-busy="true">
          Loading workflow…
        </p>
      ) : null}
    </div>
  );
}
