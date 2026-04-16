import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicStoryArticle } from "../components/PublicStoryArticle";
import { ApiRequestError } from "../api/creatorClient";
import { getPublicStory } from "../api/publicClient";
import type { PublicStoryData } from "../api/publicTypes";
import { applyPublicStoryShareMeta, clearPublicStoryShareMeta } from "../lib/publicShareMeta";

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

  useEffect(() => {
    if (!slug || !story || story.slug !== slug) {
      clearPublicStoryShareMeta();
      return;
    }
    applyPublicStoryShareMeta(story, slug);
    return () => {
      clearPublicStoryShareMeta();
    };
  }, [slug, story]);

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

  return <PublicStoryArticle story={story} slug={slug} variant="published" />;
}
