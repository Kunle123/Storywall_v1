import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import { getLatestValidation, listEvents, listFrames, listSections } from "../api/creatorClient";
import type { GetLatestValidationSuccess, ListFramesSuccess } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { loadBriefCache } from "../lib/briefCache";
import { buildEditorialOverviewTiles } from "../lib/creatorWorkspaceOverview";
import { heroRailLine, railPrimaryLine } from "../lib/creatorWorkspaceRailHints";
import { creatorWorkflowLabel } from "../lib/creatorWorkflowLabels";
import { CreatorWorkspaceOverviewStrip } from "./CreatorWorkspaceOverviewStrip";

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
  const [framesData, setFramesData] = useState<ListFramesSuccess["data"] | null>(null);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [validationData, setValidationData] = useState<GetLatestValidationSuccess["data"] | null>(null);
  const [validationFetchFailed, setValidationFetchFailed] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const cached = storyId ? loadBriefCache(storyId) : null;
  const brief = cached?.story_brief;
  const storyTitle = brief?.subject?.trim() || (storyId ? `Story ${storyId.slice(0, 8)}…` : "Story workspace");
  const briefTeaser = brief?.research_brief ? truncate(brief.research_brief, 200) : null;

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setOverviewLoading(true);
      setValidationFetchFailed(false);
      setSectionCount(null);
      setEventCount(null);
      setValidationData(null);
      try {
        const fr = await listFrames(token, storyId);
        if (cancelled) return;
        setWorkflow(fr.data.story_state);
        setFramesData(fr.data);
        const [sec, ev, valRes] = await Promise.all([
          listSections(token, storyId).catch(() => null),
          listEvents(token, storyId).catch(() => null),
          getLatestValidation(token, storyId)
            .then((r) => ({ data: r.data, failed: false as const }))
            .catch(() => ({ data: null, failed: true as const })),
        ]);
        if (cancelled) return;
        if (sec) setSectionCount(sec.data.sections.length);
        else setSectionCount(null);
        if (ev) setEventCount(ev.data.events.length);
        else setEventCount(null);
        setValidationData(valRes.data);
        setValidationFetchFailed(valRes.failed);
      } catch {
        if (!cancelled) {
          const c = loadBriefCache(storyId);
          setWorkflow(c?.story_state ?? null);
          setFramesData(null);
          setSectionCount(null);
          setEventCount(null);
          setValidationData(null);
          setValidationFetchFailed(false);
        }
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId, location.pathname]);

  const overviewTiles = useMemo(() => {
    if (!storyId) return [];
    return buildEditorialOverviewTiles({
      base: `/creator/stories/${storyId}`,
      brief: brief ?? null,
      workflow: workflow ?? cached?.story_state ?? null,
      frames: framesData,
      sectionCount,
      eventCount,
      validation: validationData,
      validationFetchFailed,
    });
  }, [
    storyId,
    brief,
    workflow,
    cached?.story_state,
    framesData,
    sectionCount,
    eventCount,
    validationData,
    validationFetchFailed,
  ]);

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

      <CreatorWorkspaceOverviewStrip tiles={overviewTiles} loading={overviewLoading} />

      <div className="creator-workspace__grid">
        <aside className="creator-workspace__rail" aria-label="Workspace map">
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Brief & framing</h2>
            {railPrimaryLine(overviewTiles, "brief") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "brief")}</p>
            ) : null}
            {railPrimaryLine(overviewTiles, "framing") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "framing")}</p>
            ) : null}
            <p className="creator-workspace-rail__text muted small">
              {briefTeaser ??
                "Open the Brief tab first: intake, research, framing generation, and draft assembly all start there before the Draft tab can load a full manuscript."}
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
            {railPrimaryLine(overviewTiles, "manuscript") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "manuscript")}</p>
            ) : null}
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
            {railPrimaryLine(overviewTiles, "timeline") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "timeline")}</p>
            ) : null}
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
            {heroRailLine(brief ?? null) ? (
              <p className="creator-workspace-rail__status muted small">{heroRailLine(brief ?? null)}</p>
            ) : null}
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
            {eventCount !== null ? (
              <p className="creator-workspace-rail__status muted small">
                {eventCount === 0
                  ? "No events yet — add timeline rows to anchor references."
                  : `${eventCount} event${eventCount === 1 ? "" : "s"} — attach references per row in Sources & coverage.`}
              </p>
            ) : null}
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
            {railPrimaryLine(overviewTiles, "preview") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "preview")}</p>
            ) : null}
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
            <h2 className="creator-workspace-rail__h">After publish</h2>
            {railPrimaryLine(overviewTiles, "live") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "live")}</p>
            ) : null}
            <p className="creator-workspace-rail__text muted small">
              Live stories use a frozen reader snapshot. Run checks, then update the live story from the Draft tab when
              draft edits should become public.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft#post-publish-live`} className="creator-workspace-rail__link">
                Live vs draft
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block">
            <h2 className="creator-workspace-rail__h">Checks & publish</h2>
            {railPrimaryLine(overviewTiles, "checks") ? (
              <p className="creator-workspace-rail__status muted small">{railPrimaryLine(overviewTiles, "checks")}</p>
            ) : null}
            <p className="creator-workspace-rail__text muted small">
              Run checks, resolve issues, then publish or update the live story from the <strong>Draft</strong> tab when
              readiness allows.
            </p>
            <p className="creator-workspace-rail__actions">
              <Link to={`${base}/draft`} className="creator-workspace-rail__link">
                Open draft workspace
              </Link>
            </p>
          </section>
          <section className="creator-workspace-rail__block creator-workspace-rail__block--tip">
            <h2 className="creator-workspace-rail__h">Navigator</h2>
            <p className="creator-workspace-rail__text muted small">
              The <strong>Editorial overview</strong> above tracks live counts. Use Brief for intake and long jobs,
              then continue in Draft for composition, checks, and publish.
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
