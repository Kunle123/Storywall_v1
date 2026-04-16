import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { listFrames } from "../api/creatorClient";
import { useAuth } from "../auth/AuthProvider";
import { loadBriefCache } from "../lib/briefCache";
import { creatorWorkflowLabel } from "../lib/creatorWorkflowLabels";

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function CreatorWorkspaceLayout() {
  const { storyId } = useParams<{ storyId: string }>();
  const location = useLocation();
  const { token, creator, logout } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);

  const cached = storyId ? loadBriefCache(storyId) : null;
  const brief = cached?.story_brief;
  const storyTitle = brief?.subject?.trim() || (storyId ? `Story ${storyId.slice(0, 8)}…` : "Story workspace");
  const briefTeaser = brief?.research_brief ? truncate(brief.research_brief, 200) : null;

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await listFrames(token, storyId);
        if (!cancelled) {
          setWorkflow(r.data.story_state);
        }
      } catch {
        if (!cancelled) {
          const c = loadBriefCache(storyId);
          setWorkflow(c?.story_state ?? null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId, location.pathname]);

  if (!storyId) {
    return (
      <div className="page narrow">
        <p>Invalid workspace.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  const base = `/creator/stories/${storyId}`;
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `creator-workspace__tab${isActive ? " creator-workspace__tab--active" : ""}`;

  return (
    <div className="creator-workspace">
      <header className="creator-workspace__masthead">
        <div className="creator-workspace__masthead-row">
          <div className="creator-workspace__brand">
            <Link to="/" className="creator-workspace__home-link">
              Storywall
            </Link>
            <span className="muted small">Editor</span>
          </div>
          <nav className="creator-workspace__tabs" aria-label="Story workspace sections">
            <NavLink to={`${base}/brief`} className={navCls} end>
              Brief
            </NavLink>
            <NavLink to={`${base}/framing`} className={navCls}>
              Framing
            </NavLink>
            <NavLink to={`${base}/draft`} className={navCls}>
              Draft
            </NavLink>
          </nav>
          <div className="creator-workspace__user">
            <span className="muted small">{creator?.email}</span>
            <button type="button" className="btn ghost" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="creator-workspace__context">
          <h1 className="creator-workspace__story-title">{storyTitle}</h1>
          <p className="creator-workspace__state muted small">
            <span className="creator-workspace__state-label">Workflow</span>{" "}
            <strong>{creatorWorkflowLabel(workflow ?? cached?.story_state ?? null)}</strong>
          </p>
        </div>
      </header>

      <div className="creator-workspace__grid">
        <aside className="creator-workspace__rail" aria-label="Workspace map">
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Brief & framing</h2>
            <p className="creator-workspace-rail__text muted small">
              {briefTeaser ?? "Open the Brief tab to load or edit the canonical story brief for this workspace."}
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/brief`} className="creator-workspace-rail__link">
                Edit brief
              </Link>
              {" · "}
              <Link to={`${base}/framing`} className="creator-workspace-rail__link">
                Framing
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Composition</h2>
            <p className="creator-workspace-rail__text muted small">
              Write ordered narrative sections in the Draft tab under <strong>Narrative sections</strong>.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#narrative-composition`} className="creator-workspace-rail__link">
                Open composition
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Timeline</h2>
            <p className="creator-workspace-rail__text muted small">
              Manage ordered events in the Draft tab under <strong>Events</strong>.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#timeline-events`} className="creator-workspace-rail__link">
                Open timeline
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Hero imagery</h2>
            <p className="creator-workspace-rail__text muted small">
              Set story-level <strong>imagery mode</strong> on the Draft tab (policy, not file upload).
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#hero-media-workflow`} className="creator-workspace-rail__link">
                Open visuals
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Evidence</h2>
            <p className="creator-workspace-rail__text muted small">
              Review source rows per event and see coverage in <strong>Sources &amp; coverage</strong> on the Draft tab.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#evidence-workspace`} className="creator-workspace-rail__link">
                Open evidence
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Reader preview</h2>
            <p className="creator-workspace-rail__text muted small">
              See draft title, body, timeline, and sources in the same reader layout as the published story — before you
              publish.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#creator-story-preview`} className="creator-workspace-rail__link">
                Open preview
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Checks & publish</h2>
            <p className="creator-workspace-rail__text muted small">
              Run checks, resolve issues, and publish from the <strong>Draft</strong> tab when your story is ready.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft`} className="creator-workspace-rail__link">
                Open draft workspace
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Next step</h2>
            <p className="creator-workspace-rail__text muted small">
              Use the Brief tab for intake and generation; when a job is running, open the job link from that flow for
              generation status, then continue in Draft.
            </p>
          </section>
        </aside>
        <main id="creator-workspace-main" className="creator-workspace__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
