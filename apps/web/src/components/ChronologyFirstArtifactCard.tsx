import type { EventDraftResponse } from "../api/types";

export type ChronologyFirstArtifactCardProps = {
  events: EventDraftResponse[];
  eventsLoadError: string | null;
  /** Creator workflow state from framing/draft context (e.g. assembling_draft, ready_for_edit). */
  workflow: string | null | undefined;
};

/**
 * M5-T22 — Canonical chronology-first surfacing: explicit contract + honest strength for `event_draft` timeline rows.
 */
export function ChronologyFirstArtifactCard(props: ChronologyFirstArtifactCardProps) {
  const { events, eventsLoadError, workflow } = props;
  const n = events.length;
  const missingWhen = events.filter((e) => !(e.display_date ?? "").trim()).length;

  let strength: "thin" | "partial" | "solid" = "solid";
  let strengthNote = "";
  if (eventsLoadError) {
    strength = "thin";
    strengthNote = "Events list failed to load — fix the error above, then refresh.";
  } else if (n === 0) {
    strength = "thin";
    strengthNote =
      workflow === "assembling_draft"
        ? "Assembly may still be writing rows — finish the job and reload. If this stays empty after success, add beats manually or re-run assembly when research supports it."
        : "No event_draft rows yet — add beats or run another assembly pass; chronology cannot be the spine until events exist.";
  } else if (n <= 2 || missingWhen > 0) {
    strength = "partial";
    strengthNote =
      missingWhen > 0
        ? `${missingWhen} event(s) lack a reader-visible “When” line — fill dates so the chronology reads honestly.`
        : "Few beats so far — expand the timeline until the arc matches what you want readers to feel.";
  } else {
    strengthNote = "Enough beats to review order, dates, and evidence — treat this list as the primary chronology artifact.";
  }

  return (
    <section
      id="canonical-chronology-first-surfacing"
      className="chronology-first-callout card"
      data-testid="canonical-chronology-first-surfacing"
      aria-labelledby="canonical-chronology-first-heading"
    >
      <h3 id="canonical-chronology-first-heading" className="chronology-first-callout__title">
        Chronology-first timeline
      </h3>
      <p className="chronology-first-callout__lede muted small">
        Storywall surfaces <strong>timeline events</strong> as a first-class artifact: each row is an{" "}
        <code className="inline-code">event_draft</code> materialized from research chronology through draft assembly (or
        added by you), read via <code className="inline-code">GET /api/v1/creator/stories/&lt;id&gt;/events</code>.{" "}
        <strong>Narrative sections</strong> are separate <code className="inline-code">section_draft</code> blocks — the
        ordered story body — not interchangeable with dated beats.
      </p>
      <p className="chronology-first-callout__stats muted small">
        Loaded <strong>{n}</strong> event(s).{" "}
        <span data-chronology-strength={strength}>
          Shape: <strong>{strength}</strong> — {strengthNote}
        </span>
      </p>
      {workflow === "assembling_draft" ? (
        <p className="chronology-first-callout__status muted small" role="status">
          While <code className="inline-code">draft_assemble</code> runs, the timeline editor may be read-only — reload
          after the job succeeds to edit beats.
        </p>
      ) : null}
    </section>
  );
}
