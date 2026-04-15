import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import {
  ApiRequestError,
  extractConflictDraft,
  listFrames,
  patchStoryDraft,
} from "../api/creatorClient";
import type { PatchStoryDraftBody, StoryDraftResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

const AUTOSAVE_MS = 600;

type LocalDraftFields = {
  title: string;
  subtitle: string;
  summary: string;
  lens: string;
  conclusion: string;
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
  if (Object.keys(p).length === 0) return null;
  if (p.title !== undefined && p.title.trim().length < 1) return null;
  if (p.summary !== undefined && p.summary.trim().length < 1) return null;
  if (p.lens !== undefined && p.lens.trim().length < 1) return null;
  return p;
}

function applyServerDraftToForm(d: StoryDraftResponse, setters: {
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setSummary: (v: string) => void;
  setLens: (v: string) => void;
  setConclusion: (v: string) => void;
}) {
  setters.setTitle(d.title);
  setters.setSubtitle(normalizeSubtitle(d.subtitle));
  setters.setSummary(d.summary);
  setters.setLens(d.lens);
  setters.setConclusion(normalizeConclusion(d.conclusion));
}

/**
 * M2-T06 entry + M2-T07 story-level draft autosave (mutation §12.1).
 */
export function DraftReadyPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token, creator, logout } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [lens, setLens] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const localFields: LocalDraftFields = { title, subtitle, summary, lens, conclusion };

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
        if (d) {
          applyServerDraftToForm(d, { setTitle, setSubtitle, setSummary, setLens, setConclusion });
        }
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
  }, [token, storyId, draft, workflow, title, subtitle, summary, lens, conclusion]);

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
            Story fields autosave (mutation §12.1). Sections, events, and sources will connect in later tickets.
          </p>
          {draft ? (
            <div className="draft-ready-fields" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label>
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
              <label>
                <span className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                  Subtitle
                </span>
                <input
                  type="text"
                  className="input"
                  value={subtitle}
                  onChange={(ev) => setSubtitle(ev.target.value)}
                  autoComplete="off"
                  maxLength={500}
                />
              </label>
              <label>
                <span className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                  Summary
                </span>
                <textarea
                  className="input textarea"
                  value={summary}
                  onChange={(ev) => setSummary(ev.target.value)}
                  rows={5}
                  maxLength={100_000}
                />
              </label>
              <label>
                <span className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                  Lens
                </span>
                <textarea
                  className="input textarea"
                  value={lens}
                  onChange={(ev) => setLens(ev.target.value)}
                  rows={5}
                  maxLength={100_000}
                />
              </label>
              <label>
                <span className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                  Conclusion
                </span>
                <textarea
                  className="input textarea"
                  value={conclusion}
                  onChange={(ev) => setConclusion(ev.target.value)}
                  rows={4}
                  maxLength={100_000}
                />
              </label>
            </div>
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
