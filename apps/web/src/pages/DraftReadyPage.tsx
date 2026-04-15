import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { ApiRequestError, listFrames } from "../api/creatorClient";
import { useAuth } from "../auth/AuthProvider";

/**
 * M2-T06 transitional entry into the editorial shell when workflow is `ready_for_edit`.
 * Rich editing mutations arrive in later milestone tickets.
 */
export function DraftReadyPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token, creator, logout } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        setWorkflow(r.data.story_state);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load story.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId]);

  if (!storyId) {
    return (
      <div className="page narrow">
        <p>Invalid story.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="creator-header">
        <div>
          <h1 className="page-title">Draft ready</h1>
          <p className="page-lead muted">
            Editorial workspace (transitional) — story <code className="inline-code">{storyId}</code>
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

      {!loadError && workflow && workflow !== "ready_for_edit" ? (
        <div className="banner warn">
          Current workflow is <strong>{workflow}</strong>, not <code className="inline-code">ready_for_edit</code>. Use the brief
          workspace to run research or draft assembly, or open generation status if you have a job link.
          <div style={{ marginTop: "0.75rem" }}>
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              Brief workspace
            </Link>
          </div>
        </div>
      ) : null}

      {!loadError && workflow === "ready_for_edit" ? (
        <div className="card draft-ready-card">
          <p className="draft-ready-badge">ready_for_edit</p>
          <h2 className="draft-ready-title">Your draft workspace is open</h2>
          <p>
            Structured editing (story, sections, events, sources) will connect here in later tickets. For now, continue from the
            brief workspace or revisit framing if you need to adjust setup.
          </p>
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
