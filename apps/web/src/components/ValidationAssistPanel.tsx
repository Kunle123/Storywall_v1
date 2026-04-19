import type { ValidationAssistSummaryV1 } from "../lib/validationAssist";

function postureLabel(p: ValidationAssistSummaryV1["overall_confidence_posture"]): string {
  switch (p) {
    case "strong_enough_to_continue":
      return "Enough signal to keep editing — still verify claims against sources";
    case "usable_with_caveats":
      return "Usable — proceed with documented caveats";
    case "weakly_supported_needs_research":
      return "Weakly supported — prioritize more research or narrower claims";
    case "incomplete_assessment":
      return "Incomplete — missing honesty or other inputs for a full read";
    default:
      return p;
  }
}

function statusLabel(s: ValidationAssistSummaryV1["status"]): string {
  return s === "ready" ? "Inputs sufficient for this assist pass" : "Partial inputs — read gaps below";
}

export type ValidationAssistPanelProps = {
  summary: ValidationAssistSummaryV1 | null;
  loading: boolean;
};

/**
 * M5-T14 — compact validation-assist derived from existing package honesty, provenance, audits, and workflow.
 */
export function ValidationAssistPanel(props: ValidationAssistPanelProps) {
  const { summary, loading } = props;

  if (loading) {
    return (
      <div className="card research-honesty-panel" aria-busy="true">
        <h3 className="research-honesty-title">Validation assist (M5-T14)</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Merging honesty, provenance, and optional audit envelopes…
        </p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div
      className="card research-honesty-panel"
      role="region"
      aria-label="Validation assist summary — advisory only, not publishability certification"
    >
      <h3 className="research-honesty-title">Validation assist (advisory)</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Computed locally from this research job&apos;s package + honesty + optional framing/enrichment/editorial
        audits. <strong>Not</strong> an authoritative validation result or publish approval.
      </p>
      <ul className="research-honesty-badges" style={{ marginTop: "0.5rem" }} aria-label="Assist status">
        <li>
          <span className={`research-honesty-badge ${summary.status === "partial_inputs" ? "research-honesty-badge--warn" : ""}`}>
            {statusLabel(summary.status)}
          </span>
          <span className="muted small">Assessment mode: {summary.assessment_mode}</span>
        </li>
        <li>
          <span className="research-honesty-badge research-honesty-badge--warn">Confidence posture</span>
          <span className="muted small">{postureLabel(summary.overall_confidence_posture)}</span>
        </li>
      </ul>

      {summary.strengths.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="research-honesty-title" style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            Strengths
          </h4>
          <ul className="research-honesty-hints">
            {summary.strengths.map((s, i) => (
              <li key={`s-${i}`}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.risks.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="research-honesty-title" style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            Risks / watchouts
          </h4>
          <ul className="research-honesty-hints">
            {summary.risks.map((s, i) => (
              <li key={`r-${i}`}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.blocking_conditions.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="research-honesty-title" style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            Blocking-style conditions
          </h4>
          <p className="muted small" style={{ marginTop: 0 }}>
            Workflow obstacles or hard gaps — not automatic server blocks.
          </p>
          <ul className="research-honesty-hints">
            {summary.blocking_conditions.map((s, i) => (
              <li key={`b-${i}`}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.input_gaps.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="research-honesty-title" style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            Missing, stale, or fallback-only inputs
          </h4>
          <ul className="research-honesty-hints">
            {summary.input_gaps.map((s, i) => (
              <li key={`g-${i}`}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.recommended_next_actions.length > 0 ? (
        <section style={{ marginTop: "0.75rem" }}>
          <h4 className="research-honesty-title" style={{ fontSize: "0.95rem", marginBottom: "0.25rem" }}>
            Suggested next actions
          </h4>
          <ol className="research-honesty-hints" style={{ paddingLeft: "1.2rem" }}>
            {summary.recommended_next_actions.map((s, i) => (
              <li key={`a-${i}`}>{s}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <details className="research-honesty-details" style={{ marginTop: "0.75rem" }}>
        <summary>Grounding sources for this assist pass</summary>
        <ul className="research-honesty-hints">
          {summary.grounding_refs.map((g, i) => (
            <li key={`gr-${i}`}>
              <code className="inline-code">{g.source}</code>
              {g.detail ? <> — {g.detail}</> : null}
            </li>
          ))}
        </ul>
      </details>

      <p className="hint footnote" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
        {summary.advisory_not_authoritative_note}
      </p>
    </div>
  );
}
