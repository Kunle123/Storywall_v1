import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicStoryArticle } from "../components/PublicStoryArticle";
import { ApiRequestError } from "../api/creatorClient";
import { getPublicStory } from "../api/publicClient";
import type { PublicStoryData } from "../api/publicTypes";
import { applyPublicStoryShareMeta, clearPublicStoryShareMeta } from "../lib/publicShareMeta";

type PublicStoryFailKind = "not_found" | "load_error";

export function PublicStoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [story, setStory] = useState<PublicStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  /** When set, anonymous reader cannot show this story (404 / private, or other load failure). */
  const [failKind, setFailKind] = useState<PublicStoryFailKind | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setFailKind("not_found");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setFailKind(null);
      try {
        const r = await getPublicStory(slug);
        if (!cancelled) {
          setStory(r.data);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 404) {
            setFailKind("not_found");
          } else {
            setFailKind("load_error");
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
      <div className="page public-story-page" data-testid="public-story-unavailable">
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

  if (failKind !== null || !story) {
    const isNotFound = failKind === "not_found";
    return (
      <div className="page public-story-page" data-testid="public-story-unavailable">
        <header className="public-story-header">
          <h1 className="public-story-title">{isNotFound ? "Story unavailable" : "Could not load story"}</h1>
          <p className="public-story-lead muted">
            {isNotFound ? (
              <>
                This Storywall is not available here. It may not exist, may not be published yet, or live visibility may
                be <strong>private</strong> (anonymous readers cannot open it). <strong>Unlisted</strong> stories stay
                readable by direct link but do not appear on the public homepage list.
              </>
            ) : (
              <>The server returned an error while loading this story. Try again later.</>
            )}
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
