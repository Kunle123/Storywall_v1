import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { ApiRequestError, listFrames, selectFrame } from "../api/creatorClient";
import type { FrameDraftResponse, StoryBriefResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { cacheBriefWorkspace, loadBriefCache } from "../lib/briefCache";

export function FramingChoosePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token, creator, logout } = useAuth();
  const navigate = useNavigate();

  const [storyState, setStoryState] = useState<CreatorWorkflowState | null>(null);
  const [frames, setFrames] = useState<FrameDraftResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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
      const brief = loadBriefCache(storyId)?.story_brief;
      if (brief) {
        cacheBriefWorkspace(storyId, {
          story_brief: brief,
          story_state: res.data.story_state,
          cached_at: new Date().toISOString(),
        });
      }
      navigate(`/creator/stories/${storyId}/brief`, {
        replace: true,
        state: {
          story_brief: brief as StoryBriefResponse,
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

  const canChoose = storyState === "awaiting_framing_choice" && frames.length > 0;

  return (
    <div className="page">
      <header className="creator-header">
        <div>
          <h1 className="page-title">Choose a framing</h1>
          <p className="page-lead muted">
            Story <code className="inline-code">{storyId}</code> — workflow: <strong>{storyState ?? "…"}</strong>
          </p>
        </div>
        <div className="creator-header-actions">
          <span className="muted small">{creator?.email}</span>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      {loadError ? <div className="banner error">{loadError}</div> : null}

      {!canChoose && !loadError ? (
        <div className="card">
          <p>
            {storyState === "ready_for_edit"
              ? "A framing has already been selected. Continue editing the brief or proceed to later milestones when available."
              : "Generate framing options first (API POST …/frames/generate), then return here."}
          </p>
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
          <div className="framing-list" role="radiogroup" aria-label="Framing options">
            {frames
              .filter((f) => f.status === "proposed")
              .map((f) => (
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
