import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { ApiRequestError, getCreatorJob, getResearchPackage, listFrames } from "../api/creatorClient";
import type { CreatorJobPollData, ResearchPackageHonestySummary } from "../api/types";
import { ResearchPackageHonestyPanel } from "../components/ResearchPackageHonestyPanel";
import { useAuth } from "../auth/AuthProvider";
import { clearActiveJob, rememberActiveJob } from "../lib/activeJobStorage";
import { describeJobLifecycle, generationHeadline, workflowLabelForJobKind } from "../lib/jobUi";

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

  const stoppedRef = useRef(false);

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
    setHonestyError(null);
    void (async () => {
      try {
        const res = await getResearchPackage(token, storyId, jobId);
        if (cancelled) return;
        setHonestySummary(res.data.honesty_summary);
      } catch (e) {
        if (cancelled) return;
        setHonestySummary(null);
        setHonestyError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load research package honesty summary.");
      } finally {
        if (!cancelled) setHonestyLoading(false);
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
          <h2 className="gen-card-title">Research complete</h2>
          <p>
            Story workflow is now <strong>{terminal.workflow}</strong>. Your next step depends on that state (creator workflow
            section 7).
          </p>
          <ResearchPackageHonestyPanel summary={honestySummary} loading={honestyLoading} error={honestyError} />
          <ul className="gen-next-list">
            {terminal.workflow === "awaiting_framing_choice" ? (
              <li>
                <Link to={`/creator/stories/${storyId}/framing`}>Choose a framing</Link> before assembling the full draft.
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
          Finishing up — entering the editorial workspace when the story is <code className="inline-code">ready_for_edit</code>…
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
