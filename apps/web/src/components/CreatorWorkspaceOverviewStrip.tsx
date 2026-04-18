import { Link } from "react-router-dom";
import type { EditorialDimensionTile } from "../lib/creatorWorkspaceOverview";

export type CreatorWorkspaceOverviewStripProps = {
  tiles: EditorialDimensionTile[];
  loading: boolean;
};

export function CreatorWorkspaceOverviewStrip(props: CreatorWorkspaceOverviewStripProps) {
  const { tiles, loading } = props;
  return (
    <section className="creator-overview" aria-label="Story editorial overview">
      <div className="creator-overview__head">
        <h2 className="creator-overview__title">Editorial overview</h2>
        <p className="creator-overview__lead muted small">
          Current counts from your brief, framing row, draft lists, checks, and publish state — no synthetic scores or hidden AI
          quality grades.
        </p>
      </div>
      {loading ? (
        <p className="creator-overview__loading muted small" role="status">
          Refreshing workspace signals…
        </p>
      ) : null}
      <div className="creator-overview__strip" role="list">
        {tiles.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            className={`creator-overview-tile creator-overview-tile--${t.tone}`}
            role="listitem"
          >
            <span className="creator-overview-tile__label">{t.label}</span>
            <span className="creator-overview-tile__primary">{t.primary}</span>
            {t.secondary ? <span className="creator-overview-tile__secondary muted small">{t.secondary}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
