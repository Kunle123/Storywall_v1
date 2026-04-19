import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { ApiRequestError, generateEditorialReview, getCreatorJob, getResearchPackage, listFrames } from "../api/creatorClient";
import type { CreatorJobPollData, GetResearchPackageSuccess, ResearchPackageHonestySummary } from "../api/types";
import { ResearchPackageHonestyPanel } from "../components/ResearchPackageHonestyPanel";
import { ValidationAssistPanel } from "../components/ValidationAssistPanel";
import { useAuth } from "../auth/AuthProvider";
import { clearActiveJob, rememberActiveJob } from "../lib/activeJobStorage";
import { editorialReviewCapabilitySummary } from "../lib/capabilityHonestyCopy";
import { buildValidationAssistFromArtifacts } from "../lib/validationAssist";
import { describeJobCapability, describeJobLifecycle, generationHeadline, workflowLabelForJobKind } from "../lib/jobUi";

const POLL_MS = 2000;

type TerminalView =
  | { kind: "research_done"; workflow: CreatorWorkflowState }
  | { kind: "failed"; job: CreatorJobPollData }
  | { kind: "cancelled"; job: CreatorJobPollData }
  | { kind: "draft_state_mismatch"; workflow: CreatorWorkflowState };

export function JobStatusPage() {
  const { storyId, jobId } = useParams<{ storyId: string; jobId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<CreatorJobPollData | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<TerminalView | null>(null);
  const [finishing, setFinishing] = useState(false);

  const [honestySummary, setHonestySummary] = useState<ResearchPackageHonestySummary | null>(null);
  const [honestyLoading, setHonestyLoading] = useState(false);
  const [honestyError, setHonestyError] = useState<string | null>(null);

  const [editorialReview, setEditorialReview] = useState<unknown | null>(null);
  const [editorialLoading, setEditorialLoading] = useState(false);
  const [editorialError, setEditorialError] = useState<string | null>(null);
  const [editorialRunning, setEditorialRunning] = useState(false);

  const [packageSnapshot, setPackageSnapshot] = useState<GetResearchPackageSuccess["data"] | null>(null);
  const [aiFramingGeneration, setAiFramingGeneration] = useState<unknown | null>(null);

  const stoppedRef = useRef(false);
  /** Which job kind triggered the finishing overlay (refs do not re-render). */
  const finishingKindRef = useRef<CreatorJobPollData["kind"] | null>(null);

  const finishSucceeded = useCallback(
    async (j: CreatorJobPollData) => {
      if (!token || !storyId) return;
      try {
        const frames = await listFrames(token, storyId);
        const workflow = frames.data.story_state;

        if (j.kind === "draft_assemble") {
          clearActiveJob(storyId);
          if (workflow === "ready_for_edit") {
            navigate(`/creator/stories/${storyId}/draft`, { replace: true });
            return;
          }
          setTerminal({ kind: "draft_state_mismatch", workflow });
          return;
        }

        clearActiveJob(storyId);
        setTerminal({ kind: "research_done", workflow });
      } catch (e) {
        setPollError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not refresh story state after job success.");
      } finally {
        setFinishing(false);
      }
    },
    [navigate, storyId, token],
  );

  useEffect(() => {
    if (!storyId || !jobId || !token) return;
    rememberActiveJob(storyId, jobId);
    stoppedRef.current = false;

    async function tick() {
      if (stoppedRef.current) return;
      if (!token || !jobId) return;
      try {
        setPollError(null);
        const res = await getCreatorJob(token, jobId);
        const j = res.data;
        if (j.story_id !== storyId) {
          setPollError("This job does not belong to the story in the URL.");
          return;
        }
        setJob(j);

        if (j.status === "succeeded") {
          stoppedRef.current = true;
          finishingKindRef.current = j.kind;
          setFinishing(true);
          await finishSucceeded(j);
          return;
        }
        if (j.status === "failed") {
          stoppedRef.current = true;
          setTerminal({ kind: "failed", job: j });
          return;
        }
        if (j.status === "cancelled") {
          stoppedRef.current = true;
          setTerminal({ kind: "cancelled", job: j });
          return;
        }
      } catch (e) {
        if (!stoppedRef.current) {
          setPollError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not poll job.");
        }
      }
    }

    void tick();
    const id = window.setInterval(() => {
      if (!stoppedRef.current) void tick();
    }, POLL_MS);

    return () => {
      stoppedRef.current = true;
      window.clearInterval(id);
    };
  }, [finishSucceeded, jobId, storyId, token]);

  useEffect(() => {
    if (terminal?.kind !== "research_done" || !token || !storyId || !jobId) {
      return;
    }
    let cancelled = false;
    setHonestyLoading(true);
    setEditorialLoading(true);
    setHonestyError(null);
    void (async () => {
      try {
        const res = await getResearchPackage(token, storyId, jobId);
        if (cancelled) return;
        setPackageSnapshot(res.data);
        setHonestySummary(res.data.honesty_summary);
        setEditorialReview(res.data.ai_editorial_review ?? null);
        const fr = await listFrames(token, storyId);
        if (cancelled) return;
        setAiFramingGeneration(fr.data.ai_framing_generation ?? null);
      } catch (e) {
        if (cancelled) return;
        setPackageSnapshot(null);
        setAiFramingGeneration(null);
        setHonestySummary(null);
        setEditorialReview(null);
        setHonestyError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load research package honesty summary.");
      } finally {
        if (!cancelled) {
          setHonestyLoading(false);
          setEditorialLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [terminal?.kind, token, storyId, jobId]);

  if (!storyId || !jobId) {
    return (
      <div className="page narrow">
        <p>Invalid job link.</p>
      </div>
    );
  }

  const wfHint = job ? workflowLabelForJobKind(job.kind) : "—";

  async function runEditorialReview() {
    if (!token || !storyId || !jobId) return;
    setEditorialRunning(true);
    setEditorialError(null);
    try {
      const res = await generateEditorialReview(token, storyId, jobId, { notes: "Job status page" });
      setEditorialReview(res.data.ai_editorial_review);
      const pkg = await getResearchPackage(token, storyId, jobId);
      setPackageSnapshot(pkg.data);
      setHonestySummary(pkg.data.honesty_summary);
      const fr = await listFrames(token, storyId);
      setAiFramingGeneration(fr.data.ai_framing_generation ?? null);
    } catch (e) {
      setEditorialError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Editorial review request failed.");
    } finally {
      setEditorialRunning(false);
    }
  }

  const editorialCaps = editorialReviewCapabilitySummary(editorialReview);

  const validationAssist = useMemo(() => {
    if (terminal?.kind !== "research_done" || !jobId || !packageSnapshot) return null;
    return buildValidationAssistFromArtifacts({
      researchJobId: jobId,
      workflow: terminal.workflow,
      honesty: packageSnapshot.honesty_summary ?? honestySummary,
      draftEnrichmentProvenance: packageSnapshot.draft_enrichment_provenance,
      liveEventDraftEnrichment: packageSnapshot.live_event_draft_enrichment ?? null,
      aiEditorialReview: editorialReview ?? packageSnapshot.ai_editorial_review ?? null,
      aiFramingGeneration,
    });
  }, [terminal, jobId, packageSnapshot, honestySummary, editorialReview, aiFramingGeneration]);

  return (
    <div className="page">
      <h2 className="page-title">Generation status</h2>
      <p className="page-lead muted">
        Story <code className="inline-code">{storyId}</code> — job phase <strong>{wfHint}</strong>
      </p>

      {pollError ? (
        <div className="banner error" style={{ marginBottom: "1rem" }}>
          {pollError}
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn ghost inline"
              onClick={() => {
                setPollError(null);
                stoppedRef.current = false;
                void (async () => {
                  if (!token) return;
                  try {
                    const res = await getCreatorJob(token, jobId);
                    setJob(res.data);
                  } catch (e) {
                    setPollError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Retry failed.");
                  }
                })();
              }}
            >
              Retry poll
            </button>
          </div>
        </div>
      ) : null}

      {terminal?.kind === "research_done" ? (
        <div className="card gen-terminal">
          <h2 className="gen-card-title">Research job finished</h2>
          <p>
            Workflow is now <strong>{terminal.workflow}</strong>. The research package from this job is{" "}
            <strong>deterministic scaffolding</strong> (retrieval when enabled, then synthesis + chronology + enrichment rules)
            plus honesty and fallback signals — not a single live-authored story and not implied publish-ready coverage.
          </p>
          <p className="muted small" style={{ marginTop: "0.5rem" }}>
            Optional <strong>live</strong> steps (framing, event/section enrichment, editorial review) only run when your host
            enables the AI runtime and you trigger those actions separately.
          </p>
          <ResearchPackageHonestyPanel
            summary={honestySummary}
            enrichmentMaterializationQuality={packageSnapshot?.enrichment_materialization_quality}
            provenanceTruthfulness={packageSnapshot?.provenance_truthfulness}
            workflowFallbackSemantics={packageSnapshot?.workflow_fallback_semantics}
            loading={honestyLoading}
            error={honestyError}
          />
          <div style={{ marginTop: "1rem" }}>
            <ValidationAssistPanel summary={validationAssist} loading={honestyLoading && !packageSnapshot} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <h3 className="gen-card-title" style={{ fontSize: "1rem" }}>
              Editorial risk review (optional, M5-T12)
            </h3>
            <p className="muted small" style={{ marginBottom: "0.75rem" }}>
              <strong>Advisory only</strong> — not validation, not legal review, and not a publishability score. When the live
              model path is off or fails, Storywall may surface the same risks using honesty/coverage-gap signals instead.
            </p>
            {editorialError ? <div className="banner error">{editorialError}</div> : null}
            {editorialLoading ? <p className="muted small">Loading any saved review…</p> : null}
            {!editorialLoading && editorialReview && (editorialReview as { schema_version?: string }).schema_version === "m5-t12-v1" ? (
              <div className="muted small" style={{ marginBottom: "0.5rem" }}>
                <strong>How produced:</strong> {editorialCaps.modeLabel} · <strong>Outcome:</strong> {editorialCaps.statusLabel}
              </div>
            ) : null}
            {editorialCaps.fallbackNote ? (
              <p className="hint small" style={{ marginBottom: "0.5rem" }}>
                {editorialCaps.fallbackNote}
              </p>
            ) : null}
            {!editorialLoading &&
            editorialReview &&
            Array.isArray((editorialReview as { review_findings?: unknown }).review_findings) ? (
              <ul style={{ paddingLeft: "1.1rem", maxHeight: "14rem", overflow: "auto" }}>
                {(
                  (editorialReview as { review_findings: Array<{ id?: string; severity?: string; category?: string; explanation?: string }> })
                    .review_findings
                )
                  .slice(0, 8)
                  .map((f) => (
                    <li key={f.id ?? f.explanation} style={{ marginBottom: "0.5rem" }}>
                      <span className="muted small">
                        [{f.severity ?? "?"}/{f.category ?? "?"}]
                      </span>{" "}
                      {f.explanation}
                    </li>
                  ))}
              </ul>
            ) : null}
            {!editorialLoading && (editorialReview as { overall_editorial_posture?: string } | null)?.overall_editorial_posture ? (
              <p className="small" style={{ marginTop: "0.5rem" }}>
                <strong>Posture:</strong> {(editorialReview as { overall_editorial_posture: string }).overall_editorial_posture}
              </p>
            ) : null}
            <button
              type="button"
              className="btn ghost inline"
              style={{ marginTop: "0.5rem" }}
              disabled={editorialRunning || !token}
              onClick={() => void runEditorialReview()}
            >
              {editorialRunning ? "Running review…" : editorialReview ? "Re-run editorial review" : "Run editorial review"}
            </button>
          </div>
          <ul className="gen-next-list">
            {terminal.workflow === "awaiting_framing_choice" ? (
              <li>
                <Link to={`/creator/stories/${storyId}/framing`}>Choose a framing</Link> — <code className="inline-code">POST …/frames/select</code>{" "}
                creates the story draft shell and moves workflow to <code className="inline-code">ready_for_edit</code>. Then
                return to the brief workspace to run <strong>Assemble full draft</strong> when you want the starter manuscript.
              </li>
            ) : null}
            {terminal.workflow === "ready_for_edit" ? (
              <li>
                <Link to={`/creator/stories/${storyId}/brief`}>Open the brief workspace</Link> and run <strong>Assemble full draft</strong> when you are ready.
              </li>
            ) : null}
            <li>
              <Link to={`/creator/stories/${storyId}/brief`}>Back to brief workspace</Link>
            </li>
          </ul>
        </div>
      ) : null}

      {terminal?.kind === "draft_state_mismatch" ? (
        <div className="banner warn">
          Draft assembly finished, but the story workflow is <strong>{terminal.workflow}</strong> instead of{" "}
          <code className="inline-code">ready_for_edit</code>. Return to the brief workspace or retry assembly from there.
          <div style={{ marginTop: "0.75rem" }}>
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              Brief workspace
            </Link>
          </div>
        </div>
      ) : null}

      {terminal?.kind === "failed" ? (
        <div className="card gen-terminal gen-terminal-error">
          <h2 className="gen-card-title">Job failed</h2>
          {terminal.job.story_state ? (
            <p className="muted small" style={{ marginBottom: "0.5rem" }}>
              Story workflow at failure: <code className="inline-code">{terminal.job.story_state}</code> (from the same job
              poll).
            </p>
          ) : null}
          <p className="gen-error-detail">
            {terminal.job.error_message ?? "No error details were returned — check server logs."}
          </p>
          <p className="muted small">
            The server may have restored your story to a safe workflow state. Retry from the brief workspace with a new
            request (new idempotency key).
          </p>
          <div className="gen-actions">
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              Back to brief — retry from there
            </Link>
          </div>
        </div>
      ) : null}

      {terminal?.kind === "cancelled" ? (
        <div className="card gen-terminal">
          <h2 className="gen-card-title">Job cancelled</h2>
          <p>This job was cancelled. Return to your story to start a new run if appropriate.</p>
          <Link to={`/creator/stories/${storyId}/brief`} className="btn ghost inline">
            Brief workspace
          </Link>
        </div>
      ) : null}

      {!terminal && !job && !pollError && !finishing ? (
        <p className="muted" aria-busy="true">
          Loading job…
        </p>
      ) : null}

      {!terminal && job && !finishing ? (
        <section className="card gen-status-card" aria-live="polite" aria-busy={job.status === "pending" || job.status === "running"}>
          <div className="gen-status-header">
            <h2 className="gen-card-title">{generationHeadline(job)}</h2>
            <span className={`gen-pill gen-pill-${job.status}`}>{job.status}</span>
          </div>
          <p className="gen-status-body">{describeJobLifecycle(job.status)}</p>
          <p className="hint small" style={{ marginTop: "0.35rem" }}>
            {describeJobCapability(job)}
          </p>
          {job.kind === "research_run" ? (
            <p className="hint small" style={{ marginTop: "0.35rem" }}>
              <strong>Truthful signals:</strong> <code className="inline-code">status</code> here is the persisted{" "}
              <code className="inline-code">research_job.status</code> (queued / running / terminal).{" "}
              {job.story_state ? (
                <>
                  <code className="inline-code">story_state</code> is the live story workflow — usually{" "}
                  <code className="inline-code">researching</code> until the worker finishes, then it returns to the state you
                  had before starting research (for example <code className="inline-code">awaiting_framing_choice</code>).
                </>
              ) : (
                <>Your API may be older than M5-T18; refresh the brief page or poll again after the job shows succeeded.</>
              )}
            </p>
          ) : null}
          <dl className="gen-meta">
            <div>
              <dt>Job</dt>
              <dd>
                <code className="inline-code">{job.job_id}</code>
              </dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd>{job.kind}</dd>
            </div>
            {job.story_state ? (
              <div>
                <dt>Story workflow</dt>
                <dd>
                  <code className="inline-code">{job.story_state}</code>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Mode</dt>
              <dd>{job.mode}</dd>
            </div>
            {job.started_at ? (
              <div>
                <dt>Started</dt>
                <dd>{new Date(job.started_at).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
          <p className="hint footnote">
            Unified poll: <code className="inline-code">GET /api/v1/creator/jobs/:jobId</code> for research and draft assembly
            (mutation contract section 6).
          </p>
        </section>
      ) : null}

      {finishing ? (
        <div className="banner" style={{ background: "#e8f0ff", borderColor: "#a8c0f0" }}>
          {finishingKindRef.current === "draft_assemble" ? (
            <>
              Finishing up — entering the draft workspace when the story is{" "}
              <code className="inline-code">ready_for_edit</code>…
            </>
          ) : (
            <>
              Finishing up — restoring story workflow and loading the research package (honesty summary, optional editorial
              tools)…
            </>
          )}
        </div>
      ) : null}

      <p style={{ marginTop: "1.25rem" }}>
        <Link to={`/creator/stories/${storyId}/brief`}>Brief workspace</Link>
        {" · "}
        <Link to="/">Home</Link>
      </p>
    </div>
  );
}
