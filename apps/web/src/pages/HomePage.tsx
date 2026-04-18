import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { ApiRequestError } from "../api/creatorClient";
import { getPublicDiscover } from "../api/publicClient";
import type { PublicDiscoveryStoryCard } from "../api/publicTypes";
import { useAuth } from "../auth/AuthProvider";

type DiscoverLoadState = "loading" | "ready" | "empty" | "error";

const DISCOVER_LIMIT = 12;

/**
 * M5-T28 — minimal anonymous discover strip (GET /api/v1/stories/discover). `data-testid` is probed by staging verify.
 */
export function HomePage() {
  const { token, creator } = useAuth();
  const [discoverState, setDiscoverState] = useState<DiscoverLoadState>("loading");
  const [discoverStories, setDiscoverStories] = useState<PublicDiscoveryStoryCard[]>([]);
  const [discoverLimit, setDiscoverLimit] = useState<number | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDiscoverState("loading");
      setDiscoverError(null);
      try {
        const r = await getPublicDiscover(DISCOVER_LIMIT);
        if (cancelled) return;
        const stories = r.data.stories ?? [];
        setDiscoverLimit(r.data.limit_applied ?? DISCOVER_LIMIT);
        if (stories.length === 0) {
          setDiscoverStories([]);
          setDiscoverState("empty");
        } else {
          setDiscoverStories(stories);
          setDiscoverState("ready");
        }
      } catch (e) {
        if (cancelled) return;
        setDiscoverState("error");
        setDiscoverError(
          e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load discoverable stories.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page narrow">
      <h1 className="page-title">Storywall</h1>
      <p className="page-lead">
        Mobile-first non-fiction story workspace. Contract baseline: <code className="inline-code">{API_CONTRACT_VERSION}</code>
      </p>

      <section
        className="card homepage-discover-strip"
        style={{ marginTop: "1.25rem" }}
        data-testid="homepage-discover-strip"
        aria-labelledby="homepage-discover-heading"
      >
        <h2 id="homepage-discover-heading" className="page-title" style={{ fontSize: "1.15rem", marginBottom: "0.35rem" }}>
          Recently published
        </h2>
        <p className="muted small" style={{ marginBottom: "0.75rem" }}>
          Public discovery from <code className="inline-code">GET /api/v1/stories/discover</code>
          {discoverLimit !== null ? (
            <>
              {" "}
              (up to <strong>{discoverLimit}</strong> newest live-<code className="inline-code">public</code> stories).
              Unlisted and private are not listed here; unlisted stays readable by direct slug.
            </>
          ) : (
            <> — limit loads with the list.</>
          )}
        </p>
        {discoverState === "loading" ? (
          <p className="muted small" role="status">
            Loading discoverable stories…
          </p>
        ) : null}
        {discoverState === "error" ? (
          <div className="banner error" role="alert">
            <p>{discoverError ?? "Discover request failed."}</p>
          </div>
        ) : null}
        {discoverState === "empty" ? (
          <p className="muted small" role="status">
            No public stories are listed yet. When creators publish with live visibility <code className="inline-code">public</code>, they can appear here.
          </p>
        ) : null}
        {discoverState === "ready" && discoverStories.length > 0 ? (
          <ul className="homepage-discover-strip__list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {discoverStories.map((s) => (
              <li
                key={s.slug}
                style={{ padding: "0.65rem 0", borderTop: "1px solid var(--border-subtle, #e5e7eb)" }}
                data-discover-slug={s.slug}
              >
                <Link to={`/stories/${encodeURIComponent(s.slug)}`} className="homepage-discover-strip__link">
                  <strong>{s.title}</strong>
                </Link>
                {s.subtitle ? <span className="muted small"> — {s.subtitle}</span> : null}
                <p className="muted small" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
                  {(s.summary ?? "").length > 160 ? `${(s.summary ?? "").slice(0, 157)}…` : s.summary}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {token ? (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <p>
            Signed in as <strong>{creator?.email}</strong>
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/creator/stories/new" className="btn primary inline">
              New Storywall
            </Link>
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <p>
            <Link to="/login" className="btn primary inline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link to="/register" className="btn ghost inline">
              Register
            </Link>{" "}
            to open the creator brief workspace.
          </p>
        </div>
      )}
    </div>
  );
}
