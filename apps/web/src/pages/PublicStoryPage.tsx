import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiRequestError } from "../api/creatorClient";
import { getPublicStory } from "../api/publicClient";
import type { PublicStoryData } from "../api/publicTypes";

export function PublicStoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [story, setStory] = useState<PublicStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setUnavailable(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setUnavailable(false);
      try {
        const r = await getPublicStory(slug);
        if (!cancelled) {
          setStory(r.data);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 404) {
            setUnavailable(true);
          } else {
            setUnavailable(true);
          }
          setStory(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <div className="page public-story-page">
        <p className="public-story-unavailable">Invalid address.</p>
        <Link to="/" className="public-story-back">
          Home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page public-story-page public-story-page--loading">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (unavailable || !story) {
    return (
      <div className="page public-story-page">
        <header className="public-story-header">
          <h1 className="public-story-title">Story unavailable</h1>
          <p className="public-story-lead muted">
            This Storywall does not exist, is not published, or is not visible here.
          </p>
        </header>
        <Link to="/" className="public-story-back">
          Home
        </Link>
      </div>
    );
  }

  return (
    <article className="page public-story-page">
      <header className="public-story-header">
        <p className="public-story-eyebrow muted small">Storywall</p>
        <h1 className="public-story-title">{story.title}</h1>
        {story.subtitle ? <p className="public-story-subtitle">{story.subtitle}</p> : null}
        <p className="public-story-meta muted small">
          {story.published_at ? new Date(story.published_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : null}
          {story.time_display ? ` · ${story.time_display}` : null}
        </p>
      </header>

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
          <Link to={`/stories/${encodeURIComponent(slug)}/references`}>View all references</Link>
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
        <Link to="/" className="public-story-back">
          Home
        </Link>
      </footer>
    </article>
  );
}
