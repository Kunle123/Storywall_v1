import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiRequestError } from "../api/creatorClient";
import { getPublicStoryReferences } from "../api/publicClient";
import type { PublicStoryData, PublicStoryReferencesData } from "../api/publicTypes";
import {
  splitConclusionForPresentation,
  splitSectionSummaryForPresentation,
} from "../lib/assemblyHonestyPresentation";
import { computeBeatPresentations } from "../lib/publicStoryBeatPresentation";
import { PublicTrustExplainer } from "./PublicTrustExplainer";

function CreatorPreviewDisclaimer() {
  return (
    <aside className="creator-preview-disclaimer" aria-labelledby="creator-preview-disclaimer-title">
      <h2 id="creator-preview-disclaimer-title" className="creator-preview-disclaimer__title">
        Creator preview
      </h2>
      <p className="creator-preview-disclaimer__p muted small">
        Same reader layout as the published Storywall, fed from your <strong>current draft</strong> (title, overview,
        lens, sections, timeline, sources, closing). It is <strong>not</strong> the live publish snapshot: trust copy,
        share metadata, and the standalone references index apply only on the public reader after publish. Hero imagery
        policy is set in the draft workspace but is not drawn in this text-first preview.
      </p>
    </aside>
  );
}

export type PublicStoryArticleProps = {
  story: PublicStoryData;
  slug: string;
  variant: "published" | "creator_preview";
};

function formatChronologySpan(story: PublicStoryData): string | null {
  const a = story.time_start?.trim();
  const b = story.time_end?.trim();
  if (a && b) return `${a} → ${b}`;
  if (story.time_display?.trim()) return story.time_display.trim();
  return null;
}

function sortEvents(events: PublicStoryData["events"]) {
  return [...events].sort(
    (a, b) => a.position_index - b.position_index || a.headline.localeCompare(b.headline),
  );
}

function sortSections(sections: PublicStoryData["sections"]) {
  return [...sections].sort(
    (a, b) => a.position_index - b.position_index || a.label.localeCompare(b.label),
  );
}

type RefsIxState =
  | { kind: "loading" }
  | { kind: "ready"; storySourceCount: number; timelineRefCount: number }
  | { kind: "empty" }
  | { kind: "unavailable" }
  | { kind: "error" };

/** M5-T31 — live `GET /api/v1/stories/:slug/references` summary on the published reader (same visibility as the story). */
function PublishedReferencesIndexCard({ slug }: { slug: string }) {
  const [st, setSt] = useState<RefsIxState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSt({ kind: "loading" });
      try {
        const r = await getPublicStoryReferences(slug);
        if (cancelled) return;
        const d = r.data;
        const storySourceCount = (d.sources ?? []).length;
        const timelineRefCount = (d.events ?? []).reduce((acc, ev) => acc + (ev.references ?? []).length, 0);
        if (storySourceCount === 0 && timelineRefCount === 0) {
          setSt({ kind: "empty" });
        } else {
          setSt({ kind: "ready", storySourceCount, timelineRefCount });
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 404) {
          setSt({ kind: "unavailable" });
        } else {
          setSt({ kind: "error" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <section
      className="public-story-block public-story-block--refs-api"
      data-testid="public-story-references-index"
      aria-labelledby="public-story-refs-api-heading"
    >
      <h2 id="public-story-refs-api-heading" className="public-story-block__title">
        References index
      </h2>
      <p className="muted small" style={{ marginBottom: "0.5rem" }}>
        Snapshot from <code className="inline-code">GET /api/v1/stories/…/references</code> (same anonymous rules as the
        story body).
      </p>
      {st.kind === "loading" ? (
        <p className="muted small" role="status">
          Loading references from API…
        </p>
      ) : null}
      {st.kind === "ready" ? (
        <>
          <p className="muted small">
            <strong>{st.storySourceCount}</strong> story-level source{st.storySourceCount === 1 ? "" : "s"} and{" "}
            <strong>{st.timelineRefCount}</strong> timeline inline reference row{st.timelineRefCount === 1 ? "" : "s"}{" "}
            as the creator attached them for this published snapshot — density here is not a trust score.
          </p>
          <p>
            <Link to={`/stories/${encodeURIComponent(slug)}/references`}>Open full references index</Link>
          </p>
        </>
      ) : null}
      {st.kind === "empty" ? (
        <>
          <p className="muted small" role="status">
            The references index returned no rows for this snapshot (timeline may carry no outbound links yet, or the
            public contract may omit some rows).
          </p>
          <p>
            <Link to={`/stories/${encodeURIComponent(slug)}/references`}>Open full references index</Link>
          </p>
        </>
      ) : null}
      {st.kind === "unavailable" ? (
        <p className="muted small" role="status">
          References are not available here — same visibility as the story (for example, live{" "}
          <strong>private</strong> blocks anonymous access).
        </p>
      ) : null}
      {st.kind === "error" ? (
        <p className="muted small" role="alert">
          Could not load the references index. Try again later.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Reader-facing story body — shared by `PublicStoryPage` and creator draft preview (M4-T08).
 */
export function PublicStoryArticle(props: PublicStoryArticleProps) {
  const { story, slug, variant } = props;

  const orderedEvents = useMemo(() => sortEvents(story.events), [story.events]);
  const orderedSections = useMemo(() => sortSections(story.sections), [story.sections]);
  const beatPresentation = useMemo(() => computeBeatPresentations(orderedEvents), [orderedEvents]);
  const conclusionPresentation = useMemo(
    () => splitConclusionForPresentation(story.conclusion),
    [story.conclusion],
  );
  const chronology = formatChronologySpan(story);

  return (
    <article className="page public-story-page" data-testid="public-story-article" data-public-story-slug={slug}>
      <header className="public-story-header">
        <p className="public-story-eyebrow muted small">Storywall</p>
        <h1 className="public-story-title">{story.title}</h1>
        {story.subtitle ? <p className="public-story-subtitle">{story.subtitle}</p> : null}
        {chronology ? (
          <p className="public-story-header__chronology">
            <span className="public-story-header__chronology-label">Chronology in this edition</span>
            <span className="public-story-header__chronology-value">{chronology}</span>
          </p>
        ) : null}
        <p className="public-story-meta muted small">
          {variant === "creator_preview" ? (
            <>
              Draft as of{" "}
              {story.published_at ? new Date(story.published_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </>
          ) : story.published_at ? (
            new Date(story.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })
          ) : null}
          {story.time_display && !chronology ? ` · ${story.time_display}` : null}
        </p>
      </header>

      {variant === "published" ? <PublicTrustExplainer /> : <CreatorPreviewDisclaimer />}

      {story.summary && story.lens ? (
        <section className="public-story-block public-story-open-dual" aria-labelledby="public-story-summary-label">
          <div className="public-story-open-dual__grid">
            <div className="public-story-open-dual__col">
              <h2 id="public-story-summary-label" className="public-story-block__title">
                Overview
              </h2>
              <div className="public-story-prose">{story.summary}</div>
            </div>
            <div className="public-story-open-dual__col">
              <h2 id="public-story-lens-dual" className="public-story-block__title">
                Lens
              </h2>
              <div className="public-story-prose">{story.lens}</div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {story.summary ? (
            <section className="public-story-block" aria-labelledby="public-story-summary-label">
              <h2 id="public-story-summary-label" className="public-story-block__title">
                Overview
              </h2>
              <div className="public-story-prose">{story.summary}</div>
            </section>
          ) : null}
          {story.lens ? (
            <section className="public-story-block" aria-labelledby="public-story-lens-label">
              <h2 id="public-story-lens-label" className="public-story-block__title">
                Lens
              </h2>
              <div className="public-story-prose">{story.lens}</div>
            </section>
          ) : null}
        </>
      )}

      {orderedSections.length > 0 ? (
        <section className="public-story-block" aria-labelledby="public-story-sections-label">
          <h2 id="public-story-sections-label" className="public-story-block__title">
            Narrative arc
          </h2>
          <p className="public-story-sections-intro muted small">
            These section titles and summaries mirror how the creator grouped the story for readers — use them as
            signposts before the dated timeline below.
          </p>
          <ol className="public-story-section-list public-story-section-list--editorial">
            {orderedSections.map((s) => {
              const sec = splitSectionSummaryForPresentation(s.summary);
              return (
                <li key={`${s.position_index}-${s.label}`} className="public-story-section-list__item">
                  <div className="public-story-section-list__marker" aria-hidden />
                  <div className="public-story-section-list__body">
                    <h3 className="public-story-section-list__heading">{s.label}</h3>
                    {sec.body ? (
                      <div className="public-story-prose public-story-prose--compact">{sec.body}</div>
                    ) : null}
                    {sec.researchDepthNote ? (
                      <aside className="public-story-assembly-honesty" aria-label="Research depth note">
                        <p className="public-story-assembly-honesty__label">Research &amp; sourcing depth</p>
                        <div className="public-story-prose public-story-prose--compact public-story-assembly-honesty__text">
                          {sec.researchDepthNote}
                        </div>
                      </aside>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {orderedEvents.length > 0 ? (
        <section
          className="public-story-block public-story-block--timeline"
          aria-labelledby="public-story-timeline-label"
          aria-describedby="public-story-timeline-intro"
          data-testid="public-story-timeline-section"
        >
          <h2 id="public-story-timeline-label" className="public-story-block__title">
            Timeline
          </h2>
          <p id="public-story-timeline-intro" className="public-story-timeline-intro muted small">
            Each row is one dated beat in the order this publication was edited to tell it. Rows with more supporting
            labels, prose, or references in the snapshot are visually emphasized so you can see where this edition goes
            deeper — not every moment carries the same weight on the page.
          </p>
          <ol className="public-story-event-list public-story-event-list--editorial">
            {orderedEvents.map((ev, i) => {
              const pres = beatPresentation[i]!;
              const rail =
                (ev.context_label?.trim() || ev.location_name?.trim()) && (pres.band === "focal" || pres.band === "standard");
              const itemClass = [
                "public-story-event-list__item",
                `public-story-event-list__item--${pres.band}`,
                `public-story-event-list__item--pos-${pres.positionRole}`,
                rail ? "public-story-event-list__item--has-rail" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li key={`${ev.position_index}-${ev.headline}`} className={itemClass}>
                  <div className="public-story-event-list__core">
                    <p className="public-story-event-list__when muted small">
                      {ev.display_date ?? "Date TBC"}
                      {ev.location_name && !rail ? ` · ${ev.location_name}` : null}
                    </p>
                    <h3 className="public-story-event-list__headline">{ev.headline}</h3>
                    {ev.context_label && !rail ? <p className="public-story-event-list__context muted small">{ev.context_label}</p> : null}
                    {ev.dek ? <p className="public-story-event-list__dek">{ev.dek}</p> : null}
                    <div className="public-story-prose public-story-prose--compact">{ev.summary}</div>
                    {(ev.references ?? []).length > 0 ? (
                      <div className="public-story-event-refs" aria-label="References for this event">
                        <p className="public-story-event-refs__label muted small">References</p>
                        <ul className="public-story-event-refs__list">
                          {(ev.references ?? []).map((ref, ri) => (
                            <li key={`${ev.position_index}-ref-${ri}`} className="public-story-event-refs__item">
                              {ref.outbound_url ? (
                                <a
                                  href={ref.outbound_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="public-story-event-refs__link"
                                >
                                  {ref.title}
                                </a>
                              ) : (
                                <span className="public-story-event-refs__text">{ref.title}</span>
                              )}
                              {ref.publisher_name ? (
                                <span className="public-story-event-refs__pub muted small"> · {ref.publisher_name}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  {rail ? (
                    <aside className="public-story-event-rail" aria-label="Context from this edition">
                      {ev.context_label?.trim() ? (
                        <p className="public-story-event-rail__context">{ev.context_label}</p>
                      ) : null}
                      {ev.location_name?.trim() ? (
                        <p className="public-story-event-rail__where muted small">{ev.location_name}</p>
                      ) : null}
                    </aside>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="public-story-block public-story-block--sources" aria-labelledby="public-story-sources-label">
        <h2 id="public-story-sources-label" className="public-story-block__title">
          Sources
        </h2>
        <p className="muted small public-story-sources-index">
          {variant === "published" ? (
            <Link to={`/stories/${encodeURIComponent(slug)}/references`}>View all references</Link>
          ) : (
            <span>
              The full references index page is only on the <strong>published</strong> reader; below lists draft
              evidence rows mapped into the same list shape.
            </span>
          )}
        </p>
        {(story.sources ?? []).length > 0 ? (
          <ul className="public-story-source-list">
            {(story.sources ?? []).map((src) => (
              <li key={`src-${src.position_index}`} className="public-story-source-list__item">
                <p className="public-story-source-list__title">
                  {src.outbound_url ? (
                    <a
                      href={src.outbound_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="public-story-source-list__link"
                    >
                      {src.title}
                    </a>
                  ) : (
                    <span className="public-story-source-list__text">{src.title}</span>
                  )}
                </p>
                {src.publisher_name ? (
                  <p className="public-story-source-list__meta muted small">{src.publisher_name}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No public sources are listed for this story.</p>
        )}
      </section>

      {variant === "published" ? <PublishedReferencesIndexCard slug={slug} /> : null}

      {story.conclusion ? (
        <section className="public-story-block public-story-block--closing" aria-labelledby="public-story-conclusion-label">
          <h2 id="public-story-conclusion-label" className="public-story-block__title">
            Closing
          </h2>
          {conclusionPresentation.body ? (
            <div className="public-story-prose">{conclusionPresentation.body}</div>
          ) : null}
          {conclusionPresentation.editorialReadiness ? (
            <aside
              className="public-story-assembly-honesty public-story-assembly-honesty--readiness"
              aria-label="Editorial readiness"
            >
              <p className="public-story-assembly-honesty__label">Editorial readiness</p>
              <div className="public-story-prose public-story-prose--compact public-story-assembly-honesty__text">
                {conclusionPresentation.editorialReadiness}
              </div>
            </aside>
          ) : null}
        </section>
      ) : null}

      <footer className="public-story-footer">
        {variant === "published" ? (
          <Link to="/" className="public-story-back">
            Home
          </Link>
        ) : (
          <p className="muted small public-story-footer__preview-note">End of preview — reader layout, draft content.</p>
        )}
      </footer>
    </article>
  );
}
