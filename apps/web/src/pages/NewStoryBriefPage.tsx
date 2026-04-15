import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiRequestError, createStory } from "../api/creatorClient";
import { useAuth } from "../auth/AuthProvider";
import { BriefIntakeFields } from "../components/BriefIntakeFields";
import { defaultBriefForm, formToCreateBody, type BriefFormValues, validateCreateForm } from "../lib/briefFormModel";
import { cacheBriefWorkspace } from "../lib/briefCache";

export function NewStoryBriefPage() {
  const { token, creator, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<BriefFormValues>(defaultBriefForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function mergeForm(patch: Partial<BriefFormValues>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateCreateForm(form);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await createStory(token!, formToCreateBody(form));
      const { story_id, story_brief, story_state } = res.data;
      cacheBriefWorkspace(story_id, {
        story_brief,
        story_state,
        cached_at: new Date().toISOString(),
      });
      navigate(`/creator/stories/${story_id}/brief`, {
        replace: false,
        state: { story_brief, story_state },
      });
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? JSON.stringify(err.body) : "Could not create workspace.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <header className="creator-header">
        <div>
          <h1 className="page-title">New Storywall</h1>
          <p className="page-lead muted">
            Structured brief intake — stage <strong>drafting brief</strong> (workflow spec §6).
          </p>
        </div>
        <div className="creator-header-actions">
          <span className="muted small">{creator?.email}</span>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      <form className="card brief-card" onSubmit={onSubmit}>
        {error ? <div className="banner error">{error}</div> : null}
        <BriefIntakeFields value={form} onChange={mergeForm} disabled={pending} />
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Creating workspace…" : "Create workspace"}
          </button>
        </div>
      </form>
    </div>
  );
}
