import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { EventDraftResponse, SectionDraftResponse, StoryDraftResponse } from "../api/types";
import { buildCreatorDraftReflection } from "../lib/creatorDraftReflection";

export type PrePublishReflectionPanelProps = {
  storyId: string;
  draft: StoryDraftResponse;
  sections: SectionDraftResponse[];
  events: EventDraftResponse[];
};

const draftBase = (storyId: string) => `/creator/stories/${encodeURIComponent(storyId)}/draft`;

/**
 * Compact, deterministic pre-publish reflection: how the draft may read publicly and what to deepen next.
 * Not validation and not fabricated scoring — only structural signals from the working draft.
 */
export function PrePublishReflectionPanel(props: PrePublishReflectionPanelProps) {
  const { storyId, draft, sections, events } = props;
  const base = draftBase(storyId);

  const { items, needsAttention } = useMemo(
    () => buildCreatorDraftReflection({ draft, sections, events, maxItems: 5 }),
    [draft, sections, events],
  );

  return (
    <aside
      className={`pre-publish-reflection${needsAttention ? " pre-publish-reflection--attention" : ""}`}
      aria-labelledby="pre-publish-reflection-title"
    >
      <p className="pre-publish-reflection__eyebrow">Before publish</p>
      <h3 id="pre-publish-reflection-title" className="pre-publish-reflection__title">
        {needsAttention ? "How this draft may read on the public page" : "No strong structural contrasts flagged from rows alone"}
      </h3>
      <p className="pre-publish-reflection__lead muted small">
        Storywall cannot judge historical importance — it can only reflect what is in your working draft. These notes
        tie <strong>field depth and contrast</strong> to the same reader layout you will ship, so thin chronology, even
        pacing, or missing framing is easier to spot before you run checks. A clean bill here does{" "}
        <strong>not</strong> mean the prose is finished — only that obvious row-level gaps did not trigger.
      </p>

      <ul className="pre-publish-reflection__list">
        {items.map((row) => (
          <li key={row.id} className="pre-publish-reflection__item">
            <p className="pre-publish-reflection__item-title">{row.title}</p>
            <p className="pre-publish-reflection__item-detail muted small">{row.detail}</p>
          </li>
        ))}
      </ul>

      <p className="pre-publish-reflection__cta-label muted small">Jump to where you can act on this</p>
      <div className="pre-publish-reflection__actions">
        <Link to={`${base}#creator-story-preview`} className="btn ghost inline">
          Reader preview
        </Link>
        <Link to={`${base}#timeline-events`} className="btn ghost inline">
          Timeline &amp; events
        </Link>
        <Link to={`${base}#narrative-composition`} className="btn ghost inline">
          Narrative sections
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
