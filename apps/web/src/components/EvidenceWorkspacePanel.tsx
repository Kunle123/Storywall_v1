import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiRequestError, listSourcesForEvent } from "../api/creatorClient";
import type { EventDraftResponse, SectionDraftResponse, SourceRecordResponse } from "../api/types";
import { EventSourcesBlock } from "./EventSourcesBlock";

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

type GroupKey = string;

function sectionKey(sectionId: string | null): GroupKey {
  return sectionId ?? "__none__";
}

export type EvidenceWorkspacePanelProps = {
  token: string;
  storyId: string;
  events: EventDraftResponse[];
  sections: SectionDraftResponse[];
  onSaveError: (message: string) => void;
  onVersionConflict: () => void;
  onRefreshEvents: () => void | Promise<void>;
};

/**
 * M4-T06 — evidence overview: sources attach to timeline events only; grouped by narrative section when set.
 */
export function EvidenceWorkspacePanel(props: EvidenceWorkspacePanelProps) {
  const { token, storyId, events, sections, onSaveError, onVersionConflict, onRefreshEvents } = props;

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id)),
    [sections],
  );

  const sectionTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of orderedSections) {
      m.set(s.id, s.label);
    }
    return m;
  }, [orderedSections]);

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id)),
    [events],
  );

  const [counts, setCounts] = useState<Record<string, number | "err" | "loading">>({});
  const [countReload, setCountReload] = useState(0);

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    const next: Record<string, number | "err" | "loading"> = {};
    for (const ev of orderedEvents) {
      next[ev.id] = "loading";
    }
    setCounts(next);

    void (async () => {
      await Promise.all(
        orderedEvents.map(async (ev) => {
          try {
            const r = await listSourcesForEvent(token, storyId, ev.id);
            if (!cancelled) {
              setCounts((c) => ({ ...c, [ev.id]: r.data.sources.length }));
            }
          } catch {
            if (!cancelled) {
              setCounts((c) => ({ ...c, [ev.id]: "err" }));
            }
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [token, storyId, orderedEvents, countReload]);

  const handleAfterSourceMutation = useCallback(async () => {
    await onRefreshEvents();
    setCountReload((x) => x + 1);
  }, [onRefreshEvents]);

  const grouped = useMemo(() => {
    const map = new Map<GroupKey, EventDraftResponse[]>();
    for (const ev of orderedEvents) {
      const k = sectionKey(ev.section_id);
      const list = map.get(k) ?? [];
      list.push(ev);
      map.set(k, list);
    }
    return map;
  }, [orderedEvents]);

  const groupOrder = useMemo(() => {
    const out: GroupKey[] = [];
    for (const s of orderedSections) {
      if ((grouped.get(s.id)?.length ?? 0) > 0) {
        out.push(s.id);
      }
    }
    if ((grouped.get("__none__")?.length ?? 0) > 0) {
      out.push("__none__");
    }
    for (const k of grouped.keys()) {
      if (k === "__none__") continue;
      if (orderedSections.some((s) => s.id === k)) continue;
      if ((grouped.get(k)?.length ?? 0) > 0) {
        out.push(k);
      }
    }
    return out;
  }, [grouped, orderedSections]);

  const anyCountLoading = orderedEvents.some((ev) => counts[ev.id] === "loading");
  const eventsWithZero = orderedEvents.filter((ev) => counts[ev.id] === 0).length;

  return (
    <section
      className="editor-panel editor-panel--evidence"
      id="evidence-workspace"
      aria-labelledby="evidence-workspace-heading"
    >
      <div className="editor-panel__head">
        <p className="editor-panel__eyebrow">Evidence</p>
        <h3 id="evidence-workspace-heading" className="editor-panel__title">
          Sources &amp; coverage
        </h3>
        <p className="editor-panel__hint">
          In Storywall today, <strong>source records attach to timeline events only</strong>. There is no API to attach
          sources directly to narrative sections; when an event belongs to a section, evidence is still stored on the
          event.
        </p>
        <p className="editor-panel__hint muted small">
          This view groups events by narrative section (when set) so you can see coverage at a glance. Edit rows here
          or in the timeline — both use the same underlying records.
        </p>
      </div>

      {orderedEvents.length === 0 ? (
        <div className="muted small evidence-workspace__empty" role="status">
          <p>
            <strong>No events to attach evidence to.</strong> In Storywall, source rows belong to timeline events only.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            Add events under <strong>Events</strong> above, then return here — each event can carry one or more sources
            you edit in the timeline or in the rows below.
          </p>
        </div>
      ) : (
        <>
          <div className="evidence-workspace__summary card evidence-summary-card" role="status">
            <p className="evidence-summary-card__title">Coverage snapshot</p>
            <p className="muted small evidence-summary-card__body">
              {orderedEvents.length} timeline event{orderedEvents.length === 1 ? "" : "s"}
              {anyCountLoading ? (
                <> · loading source counts…</>
              ) : eventsWithZero > 0 ? (
                <>
                  {" "}
                  · <strong>{eventsWithZero}</strong> with no sources yet
                </>
              ) : (
                <> · each event has at least one source row</>
              )}
            </p>
            {!anyCountLoading && eventsWithZero > 0 ? (
              <p className="muted small" style={{ marginTop: "0.55rem" }}>
                Open an event (here or in the timeline) and use <strong>Add source</strong> under evidence rows. When
                you run checks, thin coverage may surface as issues — add what you intend readers to rely on.
              </p>
            ) : null}
          </div>

          <div className="evidence-workspace__groups">
            {groupOrder.map((key) => {
              const list = grouped.get(key) ?? [];
              const sectionTitle =
                key === "__none__" ? null : (sectionTitleById.get(key) ?? `Section ${key.slice(0, 8)}…`);
              return (
                <div key={key} className="evidence-workspace__group">
                  <h4 className="evidence-workspace__group-title">
                    {key === "__none__" ? "Timeline-wide events" : `Section: ${sectionTitle}`}
                  </h4>
                  <ul className="evidence-workspace__event-list">
                    {list.map((ev) => {
                      const c = counts[ev.id];
                      const countLabel =
                        c === "loading" ? "…" : c === "err" ? "?" : typeof c === "number" ? String(c) : "—";
                      return (
                        <li key={ev.id} className="evidence-workspace__event-item">
                          <details className="evidence-workspace__details">
                            <summary className="evidence-workspace__summary">
                              <span className="evidence-workspace__headline">{truncate(ev.headline, 120)}</span>
                              <span className="evidence-workspace__badge" aria-label="Source count">
                                {countLabel} source{typeof c === "number" && c === 1 ? "" : "s"}
                              </span>
                            </summary>
                            <div className="evidence-workspace__details-body">
                              <p className="muted small evidence-workspace__jump">
                                <Link to={`/creator/stories/${storyId}/draft#timeline-event-${ev.id}`}>
                                  Open this event in the timeline
                                </Link>
                              </p>
                              <EventSourcesBlock
                                token={token}
                                storyId={storyId}
                                eventId={ev.id}
                                onSaveError={onSaveError}
                                onVersionConflict={onVersionConflict}
                                onAfterMutation={handleAfterSourceMutation}
                              />
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
