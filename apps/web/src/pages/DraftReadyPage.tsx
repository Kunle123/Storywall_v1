import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import {
  ApiRequestError,
  extractConflictDraft,
  listFrames,
  patchStoryDraft,
} from "../api/creatorClient";
import type { StoryDraftResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

const AUTOSAVE_MS = 600;

/**
 * M2-T06 entry + M2-T07 story-level draft autosave (title first; more fields follow).
 */
export function DraftReadyPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token, creator, logout } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null);
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        setWorkflow(r.data.story_state);
        const d = r.data.story_draft;
        setDraft(d);
        const t = d?.title ?? "";
        setTitle(t);
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

  useEffect(() => {
    if (!token || !storyId || !draft || workflow !== "ready_for_edit") return;
    if (title === draft.title) return;

    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchStoryDraft(token, storyId, draft.last_edited_at, { title });
          setDraft(res.data.story_draft);
          setSaveError(null);
          setSaveOk(true);
          window.setTimeout(() => setSaveOk(false), 2000);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const server = extractConflictDraft(e.body);
            if (server) {
              setDraft(server);
              setTitle(server.title);
            }
            setSaveError("Version conflict — loaded the latest draft from the server.");
          } else {
            setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(t);
  }, [token, storyId, draft, workflow, title]);

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
            Editorial workspace — story <code className="inline-code">{storyId}</code>
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
      {saveError ? <div className="banner error">{saveError}</div> : null}
      {saveOk ? (
        <div className="banner" style={{ borderColor: "var(--ok, #2e7d32)" }}>
          Draft saved.
        </div>
      ) : null}

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
          <p className="muted small">
            Story title autosaves (mutation §12.1). Sections, events, and sources will connect in later tickets.
          </p>
          {draft ? (
            <label className="draft-title-field" style={{ display: "block", marginTop: "1rem" }}>
              <span className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                Title
              </span>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                autoComplete="off"
                maxLength={500}
              />
            </label>
          ) : (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              No story draft row yet — complete framing selection and draft assembly from the brief workspace.
            </p>
          )}
          <div className="draft-ready-actions" style={{ marginTop: "1.25rem" }}>
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
