import { Link } from "react-router-dom";

export type PostAssemblyDepthNudgeProps = {
  storyId: string;
  sectionCount: number;
  eventCount: number;
  /** Events with no reader-facing “When” line yet (still honest to flag). */
  eventsMissingDisplayWhen: number;
  hasClosingSynthesis: boolean;
};

const basePath = (storyId: string) => `/creator/stories/${encodeURIComponent(storyId)}/draft`;

/**
 * Honest, subject-agnostic guidance after draft assembly: what the scaffold usually contains
 * and what most publishable Storywalls still need next. No fabricated scores.
 */
export function PostAssemblyDepthNudge(props: PostAssemblyDepthNudgeProps) {
  const { storyId, sectionCount, eventCount, eventsMissingDisplayWhen, hasClosingSynthesis } = props;
  const base = basePath(storyId);

  const needsNarrativeBlocks = sectionCount === 0;
  const thinNarrative = sectionCount === 1;
  const thinTimeline = eventCount <= 2;
  const modestTimeline = eventCount > 2 && eventCount <= 4;
  const needsWhenLines = eventsMissingDisplayWhen > 0;
  const needsClosing = !hasClosingSynthesis;

  const attention =
    needsNarrativeBlocks ||
    thinNarrative ||
    thinTimeline ||
    modestTimeline ||
    needsWhenLines ||
    needsClosing;

  return (
    <aside
      className={`post-assembly-depth-nudge${attention ? " post-assembly-depth-nudge--attention" : ""}`}
      aria-labelledby="post-assembly-depth-nudge-title"
    >
      <p className="post-assembly-depth-nudge__eyebrow">After assembly</p>
      <h3 id="post-assembly-depth-nudge-title" className="post-assembly-depth-nudge__title">
        {attention ? "Your draft is a scaffold — plan the next edits" : "First pass assembled — keep strengthening"}
      </h3>
      <p className="post-assembly-depth-nudge__lead muted small">
        Full draft assembly produces a <strong>usable first structure</strong> (framing shell, a starter timeline, and
        research-backed hooks). It is <strong>not</strong> meant to read as a finished public article. Most stories
        that ship still need clearer narrative sections, a denser chronology, stronger evidence rows, and a short
        closing synthesis — then <strong>Run checks</strong> when the manuscript reflects what you intend to publish.
      </p>

      <ul className="post-assembly-depth-nudge__signals" aria-label="Current manuscript shape">
        <li>
          <span className="post-assembly-depth-nudge__signal-label">Narrative sections</span>
          <span className="post-assembly-depth-nudge__signal-value">{sectionCount}</span>
          {needsNarrativeBlocks ? (
            <span className="post-assembly-depth-nudge__signal-flag">Add at least one section for reader-facing structure</span>
          ) : thinNarrative ? (
            <span className="post-assembly-depth-nudge__signal-flag muted small">
              One section is a start — consider more for publish-quality pacing
            </span>
          ) : (
            <span className="post-assembly-depth-nudge__signal-ok muted small">Sections present</span>
          )}
        </li>
        <li>
          <span className="post-assembly-depth-nudge__signal-label">Timeline rows</span>
          <span className="post-assembly-depth-nudge__signal-value">{eventCount}</span>
          {thinTimeline ? (
            <span className="post-assembly-depth-nudge__signal-flag">
              Very few events is common right after assembly — add beats until the arc feels complete
            </span>
          ) : modestTimeline ? (
            <span className="post-assembly-depth-nudge__signal-flag muted small">
              Consider more dated beats if the story still feels thin for readers
            </span>
          ) : (
            <span className="post-assembly-depth-nudge__signal-ok muted small">Timeline has depth to review</span>
          )}
        </li>
        <li>
          <span className="post-assembly-depth-nudge__signal-label">“When” lines on timeline</span>
          <span className="post-assembly-depth-nudge__signal-value">
            {eventsMissingDisplayWhen === 0 ? "All set" : `${eventsMissingDisplayWhen} missing`}
          </span>
          {needsWhenLines ? (
            <span className="post-assembly-depth-nudge__signal-flag">
              Fill reader-visible dates so cards are not stuck on “Date TBC”
            </span>
          ) : eventCount === 0 ? (
            <span className="post-assembly-depth-nudge__signal-flag muted small">—</span>
          ) : (
            <span className="post-assembly-depth-nudge__signal-ok muted small">Each event has a when line</span>
          )}
        </li>
        <li>
          <span className="post-assembly-depth-nudge__signal-label">Closing synthesis</span>
          <span className="post-assembly-depth-nudge__signal-value">{hasClosingSynthesis ? "Present" : "Empty"}</span>
          {needsClosing ? (
            <span className="post-assembly-depth-nudge__signal-flag">
              Add a short closing in Story → Framing &amp; synthesis — checks often expect it once the timeline grows
            </span>
          ) : (
            <span className="post-assembly-depth-nudge__signal-ok muted small">Closing drafted</span>
          )}
        </li>
      </ul>

      <p className="post-assembly-depth-nudge__cta-label muted small">Jump to the highest-impact areas</p>
      <div className="post-assembly-depth-nudge__actions">
        <Link to={`${base}#narrative-composition`} className="btn ghost inline">
          Narrative sections
        </Link>
        <Link to={`${base}#timeline-events`} className="btn ghost inline">
          Timeline &amp; events
        </Link>
        <Link to={`${base}#evidence-workspace`} className="btn ghost inline">
          Sources &amp; coverage
        </Link>
        <Link to={`${base}#editor-story-heading`} className="btn ghost inline">
          Story header &amp; closing
        </Link>
        <Link to={`${base}#editor-validation-heading`} className="btn ghost inline">
          Run checks
        </Link>
      </div>
    </aside>
  );
}
