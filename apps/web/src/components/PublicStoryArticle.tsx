import { Link } from "react-router-dom";
import type { PublicStoryData } from "../api/publicTypes";
import { PublicTrustExplainer } from "./PublicTrustExplainer";

function CreatorPreviewDisclaimer() {
  return (
    <aside className="creator-preview-disclaimer" aria-labelledby="creator-preview-disclaimer-title">
      <h2 id="creator-preview-disclaimer-title" className="creator-preview-disclaimer__title">
        Creator preview
      </h2>
      <p className="creator-preview-disclaimer__p muted small">
        This layout uses the same reader structure as the published Storywall, fed from your <strong>current draft</strong>{" "}
        (title, overview, lens, sections, timeline, sources, closing). It is <strong>not</strong> a frozen publish snapshot:
        trust copy, share metadata, and the separate references index page only apply after publish. Hero imagery policy
        is configured in the workspace but is not rendered in this text-first reader preview.
      </p>
    </aside>
  );
}

export type PublicStoryArticleProps = {
  story: PublicStoryData;
  slug: string;
  variant: "published" | "creator_preview";
};

/**
 * Reader-facing story body — shared by `PublicStoryPage` and creator draft preview (M4-T08).
 */
export function PublicStoryArticle(props: PublicStoryArticleProps) {
  const { story, slug, variant } = props;

  return (
    <article className="page public-story-page">
      <header className="public-story-header">
        <p className="public-story-eyebrow muted small">Storywall</p>
        <h1 className="public-story-title">{story.title}</h1>
        {story.subtitle ? <p className="public-story-subtitle">{story.subtitle}</p> : null}
        <p className="public-story-meta muted small">
          {variant === "creator_preview" ? (
            <>
              Draft as of{" "}
              {story.published_at ? new Date(story.published_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </>
          ) : story.published_at ? (
            new Date(story.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })
          ) : null}
          {story.time_display ? ` · ${story.time_display}` : null}
        </p>
      </header>

      {variant === "published" ? <PublicTrustExplainer /> : <CreatorPreviewDisclaimer />}

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

      {story.sections.length > 0 ? (
        <section className="public-story-block" aria-labelledby="public-story-sections-label">
          <h2 id="public-story-sections-label" className="public-story-block__title">
            Sections
          </h2>
          <ol className="public-story-section-list">
            {story.sections.map((s) => (
              <li key={`${s.position_index}-${s.label}`} className="public-story-section-list__item">
                <h3 className="public-story-section-list__heading">{s.label}</h3>
                {s.summary ? <div className="public-story-prose">{s.summary}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {story.events.length > 0 ? (
        <section className="public-story-block" aria-labelledby="public-story-timeline-label">
          <h2 id="public-story-timeline-label" className="public-story-block__title">
            Timeline
          </h2>
          <ol className="public-story-event-list">
            {story.events.map((ev) => (
              <li key={`${ev.position_index}-${ev.headline}`} className="public-story-event-list__item">
                <p className="public-story-event-list__when muted small">
                  {ev.display_date ?? "Date TBC"}
                  {ev.location_name ? ` · ${ev.location_name}` : null}
                </p>
                <h3 className="public-story-event-list__headline">{ev.headline}</h3>
                {ev.context_label ? <p className="muted small">{ev.context_label}</p> : null}
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
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="public-story-block" aria-labelledby="public-story-sources-label">
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

      {story.conclusion ? (
        <section className="public-story-block" aria-labelledby="public-story-conclusion-label">
          <h2 id="public-story-conclusion-label" className="public-story-block__title">
            Closing
          </h2>
          <div className="public-story-prose">{story.conclusion}</div>
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
