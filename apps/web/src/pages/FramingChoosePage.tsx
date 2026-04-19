import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { ApiRequestError, listFrames, selectFrame } from "../api/creatorClient";
import type { FrameDraftResponse, StoryBriefResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { framingCapabilitySummary, framingQualityHonesty } from "../lib/capabilityHonestyCopy";
import { cacheBriefWorkspace, loadBriefCache } from "../lib/briefCache";

export function FramingChoosePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [storyState, setStoryState] = useState<CreatorWorkflowState | null>(null);
  const [frames, setFrames] = useState<FrameDraftResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [aiFraming, setAiFraming] = useState<unknown | null>(null);
  /** Stable per visit so retries / double-submit replay the same successful outcome (mutation §10.2). */
  const selectIdempotencyKeyRef = useRef<string | null>(null);
  if (!selectIdempotencyKeyRef.current) {
    selectIdempotencyKeyRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        setStoryState(r.data.story_state);
        setFrames(r.data.frame_drafts);
        setAiFraming(r.data.ai_framing_generation ?? null);
        const c = loadBriefCache(storyId);
        if (c?.story_brief) {
          cacheBriefWorkspace(storyId, {
            story_brief: c.story_brief,
            story_state: r.data.story_state,
            cached_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load framing options.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !storyId || !selectedId) return;
    setError(null);
    setPending(true);
    try {
      const res = await selectFrame(token, storyId, { frame_id: selectedId, selection_mode: "accept" }, selectIdempotencyKeyRef.current!);
      const brief = res.data.story_brief ?? loadBriefCache(storyId)?.story_brief ?? null;
      if (!brief) {
        setError("Server did not return story_brief — cannot open the brief workspace. Retry or contact support.");
        return;
      }
      cacheBriefWorkspace(storyId, {
        story_brief: brief,
        story_state: res.data.story_state,
        cached_at: new Date().toISOString(),
      });
      navigate(`/creator/stories/${storyId}/brief`, {
        replace: true,
        state: {
          story_brief: brief,
          story_state: res.data.story_state,
          framing_selected: true,
        },
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? JSON.stringify(err.body) : "Selection failed.");
    } finally {
      setPending(false);
    }
  }

  if (!storyId) {
    return (
      <div className="page narrow">
        <p>Invalid story.</p>
      </div>
    );
  }

  const proposedFrames = frames.filter((f) => f.status === "proposed");
  const canChoose = storyState === "awaiting_framing_choice" && proposedFrames.length > 0;
  const framingCaps = framingCapabilitySummary(aiFraming);
  const framingQuality = framingQualityHonesty(aiFraming);

  return (
    <div className="page">
      <h2 className="page-title">Choose a framing</h2>
      <p className="page-lead muted">
        Story <code className="inline-code">{storyId}</code>
      </p>
      {canChoose ? (
        <p className="hint" style={{ marginTop: "-0.25rem", marginBottom: "1rem" }}>
          Picking one option calls <code className="inline-code">POST …/frames/select</code> (mutation §10.2). The server
          creates your <strong>story draft shell</strong> from that frame and sets workflow to{" "}
          <code className="inline-code">ready_for_edit</code>. Candidates are angles to choose from — not final public copy.
          Next: refine the brief if needed, then run <strong>Assemble full draft</strong> from the brief workspace when you
          want the starter manuscript structure.
        </p>
      ) : null}

      {loadError ? <div className="banner error">{loadError}</div> : null}

      {framingCaps ? (
        <div className="banner" style={{ background: "#f4f6fb", borderColor: "#c8d0e0", marginBottom: "1rem" }} role="status">
          <strong>{framingCaps.title}</strong>
          <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
            {framingCaps.body}
          </p>
        </div>
      ) : null}

      {framingQuality ? (
        <div
          className="banner"
          style={{
            background: framingQuality.title.includes("weak") ? "#fff5f5" : "#f6faf6",
            borderColor: framingQuality.title.includes("weak") ? "#e8b4b4" : "#b8d4be",
            marginBottom: "1rem",
          }}
          role="status"
          data-testid="framing-quality-honesty"
        >
          <strong>{framingQuality.title}</strong>
          <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
            {framingQuality.body}
          </p>
        </div>
      ) : null}

      {!canChoose && !loadError ? (
        <div className="card">
          {storyState === "awaiting_framing_choice" && proposedFrames.length === 0 ? (
            <>
              <p>
                <strong>No framing candidates yet.</strong> From the brief workspace, run framing generation (live model when
                the host enables the AI runtime, otherwise deterministic scaffolding), wait for options to appear, then return
                here to pick one.
              </p>
              <p className="muted small" style={{ marginTop: "0.5rem" }}>
                If generation already finished, refresh this page — candidates only load when the server lists them as{" "}
                <code className="inline-code">proposed</code>.
              </p>
            </>
          ) : storyState === "ready_for_edit" ? (
            <p>
              A framing is already selected for this story — workflow is <code className="inline-code">ready_for_edit</code>.
              Continue in the{" "}
              <Link to={`/creator/stories/${storyId}/brief`}>brief workspace</Link> (research pass, assemble draft), or open{" "}
              <Link to={`/creator/stories/${storyId}/draft`}>Draft</Link> when a manuscript shell exists.
            </p>
          ) : (
            <p>
              Framing choice is not open in this workflow state ({storyState ?? "unknown"}). Use the brief workspace to
              move research and setup forward, then try again.
            </p>
          )}
          <p style={{ marginTop: "0.75rem" }}>
            <Link to={`/creator/stories/${storyId}/brief`}>Back to brief</Link>
          </p>
        </div>
      ) : null}

      {canChoose ? (
        <form onSubmit={onSubmit}>
          {error ? <div className="banner error">{error}</div> : null}
          <p className="hint" style={{ marginBottom: "1rem" }}>
            Pick one candidate. Unselected proposals are marked discarded; the chosen frame seeds your story draft (M1-T12).
          </p>
          {proposedFrames.length === 0 ? (
            <p className="muted small" role="status">
              No <code className="inline-code">proposed</code> framing rows are available right now (they may have been
              discarded or the list is stale). Return to the brief workspace to regenerate framing, then reload this
              page.
            </p>
          ) : null}
          <div className="framing-list" role="radiogroup" aria-label="Framing options">
            {proposedFrames.map((f) => (
                <label key={f.id} className={`framing-card ${selectedId === f.id ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="frame"
                    value={f.id}
                    checked={selectedId === f.id}
                    onChange={() => setSelectedId(f.id)}
                    disabled={pending}
                  />
                  <div className="framing-card-body">
                    <h2 className="framing-title">{f.title_candidate}</h2>
                    {f.subtitle_candidate ? (
                      <p className="framing-subtitle">{f.subtitle_candidate}</p>
                    ) : null}
                    <p className="framing-summary">{f.summary_candidate}</p>
                    <p className="framing-lens">
                      <strong>Lens:</strong> {f.lens_candidate}
                    </p>
                    <p className="framing-scope muted small">{f.scope_rationale}</p>
                  </div>
                </label>
              ))}
          </div>
          <div className="form-actions" style={{ marginTop: "1.25rem" }}>
            <button type="submit" className="btn primary" disabled={pending || !selectedId}>
              {pending ? "Saving…" : "Use this framing"}
            </button>
            <Link to={`/creator/stories/${storyId}/brief`} className="btn ghost inline" style={{ marginLeft: "0.75rem" }}>
              Cancel
            </Link>
          </div>
        </form>
      ) : null}
    </div>
  );
}
