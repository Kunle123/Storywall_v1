import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import {
  ApiRequestError,
  assembleDraft,
  extractConflictBrief,
  listFrames,
  patchStoryBrief,
  runResearchPass,
} from "../api/creatorClient";
import type { StoryBriefResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { BriefIntakeFields } from "../components/BriefIntakeFields";
import { cacheBriefWorkspace, loadBriefCache } from "../lib/briefCache";
import { readActiveJob, rememberActiveJob } from "../lib/activeJobStorage";
import { briefResponseToForm, diffPatch, type BriefFormValues } from "../lib/briefFormModel";

type SaveUi = "idle" | "saving" | "saved" | "error" | "conflict";

const DEBOUNCE_MS = 900;

export function EditBriefPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, creator, logout } = useAuth();

  const navState = location.state as { story_brief?: StoryBriefResponse; story_state?: CreatorWorkflowState } | null;

  const [serverBrief, setServerBrief] = useState<StoryBriefResponse | null>(() => {
    if (!storyId) return null;
    return navState?.story_brief ?? loadBriefCache(storyId)?.story_brief ?? null;
  });

  const [storyState, setStoryState] = useState<CreatorWorkflowState | null>(() => {
    if (!storyId) return null;
    return navState?.story_state ?? loadBriefCache(storyId)?.story_state ?? null;
  });

  const [form, setForm] = useState<BriefFormValues | null>(() => {
    const sb = navState?.story_brief ?? (storyId ? loadBriefCache(storyId)?.story_brief : null);
    return sb ? briefResponseToForm(sb) : null;
  });

  const [saveUi, setSaveUi] = useState<SaveUi>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState<"research" | "assemble" | null>(null);

  const serverRef = useRef(serverBrief);
  serverRef.current = serverBrief;

  const formRef = useRef(form);
  formRef.current = form;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        setStoryState(r.data.story_state);
        const c = loadBriefCache(storyId);
        if (c?.story_brief) {
          cacheBriefWorkspace(storyId, {
            story_brief: c.story_brief,
            story_state: r.data.story_state,
            cached_at: new Date().toISOString(),
          });
        }
      } catch {
        /* ignore — offline or not ready */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId]);

  function mergeForm(patch: Partial<BriefFormValues>) {
    if (import.meta.env.DEV) {
      console.debug("[brief] mergeForm", Object.keys(patch));
    }
    setForm((f) => (f ? { ...f, ...patch } : f));
  }

  useEffect(() => {
    if (!token || !storyId || !form) return;
    if (!serverRef.current) return;

    const timer = setTimeout(() => {
      const baseline = serverRef.current;
      if (!baseline) return;
      const currentForm = formRef.current;
      const authToken = tokenRef.current;
      if (!currentForm || !authToken || !storyId) return;
      const patch = diffPatch(baseline, currentForm);
      if (import.meta.env.DEV) {
        console.debug("[brief] autosave debounce", { patchKeys: Object.keys(patch), baselineAt: baseline.updated_at });
      }
      if (Object.keys(patch).length === 0) return;

      setSaveUi("saving");
      setSaveMessage(null);

      void (async () => {
        try {
          const res = await patchStoryBrief(authToken, storyId, baseline.updated_at, patch);
          const next = res.data.story_brief;
          const st = res.data.story_state;
          setServerBrief(next);
          serverRef.current = next;
          setStoryState(st);
          setForm(briefResponseToForm(next));
          cacheBriefWorkspace(storyId, {
            story_brief: next,
            story_state: st,
            cached_at: new Date().toISOString(),
          });
          setLastSavedAt(res.meta?.saved_at ?? next.updated_at);
          setSaveUi("saved");
        } catch (err) {
          if (err instanceof ApiRequestError && err.status === 409) {
            const latest = extractConflictBrief(err.body);
            if (latest) {
              setServerBrief(latest);
              serverRef.current = latest;
              setForm(briefResponseToForm(latest));
              cacheBriefWorkspace(storyId, {
                story_brief: latest,
                story_state: loadBriefCache(storyId)?.story_state ?? "drafting_brief",
                cached_at: new Date().toISOString(),
              });
              setSaveUi("conflict");
              setSaveMessage(
                "Another version was saved first. The form now shows the latest brief from the server. Continue editing from here.",
              );
              return;
            }
          }
          setSaveUi("error");
          setSaveMessage(err instanceof ApiRequestError ? JSON.stringify(err.body) : "Save failed.");
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form, token, storyId]);

  if (!storyId || !serverBrief || !form) {
    return (
      <div className="page narrow">
        <h1 className="page-title">Brief not loaded</h1>
        <p className="page-lead">
          This screen needs a brief snapshot from creating a story or from cached data on this device. The workspace read
          API is not part of M1-T07/M1-T08.
        </p>
        <p>
          <Link to="/creator/stories/new" className="btn primary inline">
            Start a new Storywall
          </Link>
        </p>
      </div>
    );
  }

  const stateLabel = storyState ?? "—";
  const activeJobId = storyId ? readActiveJob(storyId) : null;

  async function onRunResearch() {
    if (!token || !storyId) return;
    setGenError(null);
    setGenBusy("research");
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await runResearchPass(
        token,
        storyId,
        {
          mode: "full",
          respect_existing_manual_events: true,
          respect_existing_sources: true,
          notes: "Creator-initiated research pass (M2-T06).",
        },
        idempotencyKey,
      );
      rememberActiveJob(storyId, res.data.job_id);
      navigate(`/creator/stories/${storyId}/jobs/${res.data.job_id}`);
    } catch (err) {
      setGenError(err instanceof ApiRequestError ? JSON.stringify(err.body) : "Could not start research.");
    } finally {
      setGenBusy(null);
    }
  }

  async function onAssembleDraft() {
    if (!token || !storyId) return;
    setGenError(null);
    setGenBusy("assemble");
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await assembleDraft(
        token,
        storyId,
        {
          mode: "full_regeneration",
          preserve_creator_notes: true,
          preserve_manual_event_positions: false,
          preserve_approved_images: true,
        },
        idempotencyKey,
      );
      rememberActiveJob(storyId, res.data.job_id);
      navigate(`/creator/stories/${storyId}/jobs/${res.data.job_id}`);
    } catch (err) {
      setGenError(err instanceof ApiRequestError ? JSON.stringify(err.body) : "Could not start draft assembly.");
    } finally {
      setGenBusy(null);
    }
  }

  return (
    <div className="page">
      <header className="creator-header">
        <div>
          <h1 className="page-title">Brief intake</h1>
          <p className="page-lead muted">
            Story <code className="inline-code">{storyId}</code> — workflow: <strong>{stateLabel}</strong>
          </p>
        </div>
        <div className="creator-header-actions">
          <span className="muted small">{creator?.email}</span>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className={`save-bar ${saveUi}`} role="status" aria-live="polite">
        <span className="save-bar-label">Autosave</span>
        {saveUi === "idle" ? <span className="muted">Edits save shortly after you pause typing.</span> : null}
        {saveUi === "saving" ? <span>Saving...</span> : null}
        {saveUi === "saved" ? (
          <span>Saved{lastSavedAt ? ` (${new Date(lastSavedAt).toLocaleString()})` : ""}</span>
        ) : null}
        {saveUi === "conflict" ? <span className="warn">Conflict resolved from server</span> : null}
        {saveUi === "error" ? <span className="error">Save error</span> : null}
      </div>
      {saveMessage ? <div className="banner warn">{saveMessage}</div> : null}
      {genError ? <div className="banner error">{genError}</div> : null}

      {storyState === "researching" || storyState === "assembling_draft" ? (
        <div className="banner warn" style={{ marginBottom: "1rem" }}>
          <strong>Generation is in progress on the server.</strong>{" "}
          {activeJobId ? (
            <>
              <Link to={`/creator/stories/${storyId}/jobs/${activeJobId}`}>Open generation status</Link> to watch the unified
              job poll.
            </>
          ) : (
            <>
              If you still have the status link from when you started, open it to watch progress. Otherwise wait and refresh
              this page — you cannot safely start a duplicate run while workflow is <code className="inline-code">{storyState}</code>.
            </>
          )}
        </div>
      ) : null}

      {storyState === "awaiting_framing_choice" || storyState === "ready_for_edit" ? (
        <div className="card gen-actions-card" style={{ marginBottom: "1rem" }}>
          <h2 className="gen-actions-title">AI generation (M2)</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Long-running jobs use one poll endpoint: <code className="inline-code">GET /api/v1/creator/jobs/:jobId</code>. After
            draft assembly succeeds and workflow is <code className="inline-code">ready_for_edit</code>, you will enter the draft
            workspace.
          </p>
          <div className="gen-actions-row">
            <button
              type="button"
              className="btn primary"
              disabled={!!genBusy}
              onClick={() => void onRunResearch()}
            >
              {genBusy === "research" ? "Starting…" : "Run research pass"}
            </button>
            {storyState === "ready_for_edit" ? (
              <button
                type="button"
                className="btn ghost"
                disabled={!!genBusy}
                onClick={() => void onAssembleDraft()}
              >
                {genBusy === "assemble" ? "Starting…" : "Assemble full draft"}
              </button>
            ) : null}
          </div>
          {storyState === "awaiting_framing_choice" ? (
            <p className="hint footnote" style={{ marginBottom: 0 }}>
              Choose a framing when you are ready; draft assembly is available after the story is <code className="inline-code">ready_for_edit</code> (selected frame and story draft shell).
            </p>
          ) : null}
        </div>
      ) : null}

      {storyState === "awaiting_framing_choice" ? (
        <div className="banner" style={{ background: "#e8f4ef", borderColor: "#b8d4c8", marginBottom: "1rem" }}>
          <strong>Framing options are ready.</strong>{" "}
          <Link to={`/creator/stories/${storyId}/framing`}>Choose a framing</Link> to lock in a story draft shell
          (workflow spec §8).
        </div>
      ) : null}
      {location.state && (location.state as { framing_selected?: boolean }).framing_selected ? (
        <div className="banner" style={{ background: "#e8f0ff", borderColor: "#a8c0f0", marginBottom: "1rem" }}>
          Framing selected — story workspace is <strong>ready_for_edit</strong>. Brief edits still autosave.
        </div>
      ) : null}

      <div className="card brief-card">
        <BriefIntakeFields value={form} onChange={mergeForm} />
        <p className="hint footnote">
          Patches use <code className="inline-code">If-Match</code> with the last{" "}
          <code className="inline-code">story_brief.updated_at</code> (mutation contract §6). Stale saves return 409; the
          UI loads the latest brief from <code className="inline-code">error.details.story_brief</code>.
        </p>
      </div>

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        <Link to="/creator/stories/new">+ New Storywall</Link>
      </p>
    </div>
  );
}
