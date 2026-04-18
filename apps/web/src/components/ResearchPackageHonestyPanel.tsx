import type { ResearchPackageHonestySummary } from "../api/types";

export type ResearchPackageHonestyPanelProps = {
  summary: ResearchPackageHonestySummary | null;
  loading: boolean;
  error: string | null;
};

function provenanceLabel(trace: string): string {
  switch (trace) {
    case "full_m5_t08":
      return "Per-node provenance (M5-T08) available in this package.";
    case "legacy_package_no_node_provenance_index":
      return "Detailed provenance index unavailable for this package version — treat links as unaudited.";
    case "unavailable_no_enrichment":
      return "No draft enrichment layer to trace yet.";
    default:
      return trace;
  }
}

/**
 * M5-T09 — compact creator honesty rail for deterministic research + enrichment (no broad workspace redesign).
 */
export function ResearchPackageHonestyPanel(props: ResearchPackageHonestyPanelProps) {
  const { summary, loading, error } = props;

  if (error) {
    return (
      <div className="card research-honesty-panel research-honesty-panel--error" role="status">
        <h3 className="research-honesty-title">Research honesty signals</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {error}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card research-honesty-panel" aria-busy="true">
        <h3 className="research-honesty-title">Research honesty signals</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Loading package summary…
        </p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const r = summary.support_status_rollup;

  return (
    <div className="card research-honesty-panel" role="region" aria-label="Research package honesty summary">
      <h3 className="research-honesty-title">Research honesty signals</h3>
      <p className="research-honesty-lead">
        This package is <strong>deterministic research scaffolding</strong> (retrieval when enabled, then synthesis + chronology +
        enrichment rules). It is <strong>not</strong> implied live-authored narrative prose.
      </p>
      <p className="muted small" style={{ marginTop: "0.35rem" }}>
        Separate optional steps — <strong>live</strong> framing (M5-T10), event/section enrichment (M5-T11), and editorial
        review (M5-T12) — only run when your host arms the AI runtime and you trigger those actions; their modes are stored in
        their own audit envelopes, not in this honesty block.
      </p>
      <ul className="research-honesty-badges" aria-label="Status badges">
        <li>
          <span className="research-honesty-badge">Guidance only</span>
          <span className="muted small">Not a publishable narrative</span>
        </li>
        <li>
          <span className="research-honesty-badge">
            {summary.provenance_traceability === "full_m5_t08" ? "Provenance on" : "Provenance limited"}
          </span>
          <span className="muted small">{provenanceLabel(summary.provenance_traceability)}</span>
        </li>
        <li>
          <span className={`research-honesty-badge ${summary.has_mixed_or_weak_support ? "research-honesty-badge--warn" : ""}`}>
            {summary.has_mixed_or_weak_support ? "Mixed / weak support present" : "No flagged weak rollup"}
          </span>
          <span className="muted small">
            Rollup: {r.fully_source_backed} full · {r.partially_source_backed} partial · {r.chronology_thin_sources} thin ·{" "}
            {r.unresolved_weak} weak ({r.total_nodes} nodes)
          </span>
        </li>
        {summary.synthesis_retrieval_partial === true ? (
          <li>
            <span className="research-honesty-badge research-honesty-badge--warn">Partial retrieval</span>
            <span className="muted small">Bounded fetch reported incomplete coverage.</span>
          </li>
        ) : null}
      </ul>
      <details className="research-honesty-details">
        <summary>Why Storywall shows this</summary>
        <ul className="research-honesty-hints">
          {summary.ui_hints.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
