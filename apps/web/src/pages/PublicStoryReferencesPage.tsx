import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicStoryReferences } from "../api/publicClient";
import type { PublicStoryReferencesData } from "../api/publicTypes";

export function PublicStoryReferencesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [payload, setPayload] = useState<PublicStoryReferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const eventsWithRefs = useMemo(
    () => (payload?.events ?? []).filter((e) => (e.references ?? []).length > 0),
    [payload],
  );

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
        const r = await getPublicStoryReferences(slug);
        if (!cancelled) {
          setPayload(r.data);
        }
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setPayload(null);
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

  if (unavailable || !payload) {
    return (
      <div className="page public-story-page">
        <header className="public-story-header">
          <h1 className="public-story-title">References unavailable</h1>
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

  const hasStorySources = (payload.sources ?? []).length > 0;
  const hasTimelineRefs = eventsWithRefs.length > 0;
  const hasAnyRefs = hasStorySources || hasTimelineRefs;

  return (
    <article className="page public-story-page public-story-refs-page">
      <nav className="public-story-refs-page__nav" aria-label="Story">
        <Link to={`/stories/${encodeURIComponent(payload.slug)}`} className="public-story-back">
          ← Back to story
        </Link>
      </nav>

      <header className="public-story-header">
        <p className="public-story-eyebrow muted small">Storywall · References</p>
        <h1 className="public-story-title">{payload.title}</h1>
        {payload.subtitle ? <p className="public-story-subtitle">{payload.subtitle}</p> : null}
        <p className="public-story-meta muted small">
          {payload.published_at
            ? new Date(payload.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })
            : null}
        </p>
      </header>

      {!hasAnyRefs ? (
        <section className="public-story-block">
          <p className="muted small">No public references are listed for this story.</p>
        </section>
      ) : null}

      {hasStorySources ? (
        <section className="public-story-block" aria-labelledby="public-refs-all-label">
          <h2 id="public-refs-all-label" className="public-story-block__title">
            All references
          </h2>
          <ul className="public-story-source-list">
            {(payload.sources ?? []).map((src) => (
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
        </section>
      ) : null}

      {hasTimelineRefs ? (
        <section className="public-story-block" aria-labelledby="public-refs-timeline-label">
          <h2 id="public-refs-timeline-label" className="public-story-block__title">
            By timeline
          </h2>
          <div className="public-story-refs-page__timeline-groups">
            {eventsWithRefs.map((ev) => (
              <div key={ev.position_index} className="public-story-refs-page__event-group">
                <h3 className="public-story-refs-page__event-headline">
                  {ev.display_date ? <span className="muted small">{ev.display_date} · </span> : null}
                  {ev.headline}
                </h3>
                <ul className="public-story-event-refs__list">
                  {(ev.references ?? []).map((ref, ri) => (
                    <li key={`${ev.position_index}-r-${ri}`} className="public-story-event-refs__item">
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
            ))}
          </div>
        </section>
      ) : null}

      <footer className="public-story-footer">
        <Link to={`/stories/${encodeURIComponent(payload.slug)}`} className="public-story-back">
          Back to story
        </Link>
        <span className="muted small"> · </span>
        <Link to="/" className="public-story-back">
          Home
        </Link>
      </footer>
    </article>
  );
}
