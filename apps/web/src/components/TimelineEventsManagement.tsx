import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, extractConflictEvent, patchEvent } from "../api/creatorClient";
import type { EventDraftResponse, PatchEventBody, SectionDraftResponse } from "../api/types";
import { EventSourcesBlock } from "./EventSourcesBlock";

const AUTOSAVE_MS = 600;

function normalizeCreatorNote(s: string | null | undefined): string {
  return s ?? "";
}

function normalizeDek(s: string | null | undefined): string {
  return s ?? "";
}

function buildEventPatch(
  server: EventDraftResponse,
  headline: string,
  summary: string,
  creatorNote: string,
  dek: string,
): PatchEventBody | null {
  const p: PatchEventBody = {};
  if (headline !== server.headline) {
    p.headline = headline;
  }
  if (summary !== server.summary) {
    p.summary = summary;
  }
  const serverNote = normalizeCreatorNote(server.creator_note);
  if (creatorNote !== serverNote) {
    p.creator_note = creatorNote === "" ? null : creatorNote;
  }
  const nextDek = dek.trim() === "" ? null : dek.trim();
  const prevDek = server.dek == null || server.dek === "" ? null : server.dek;
  if (nextDek !== prevDek) {
    p.dek = nextDek;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.headline !== undefined && p.headline.trim().length < 1) return null;
  if (p.summary !== undefined && p.summary.trim().length < 1) return null;
  return p;
}

function TimelineEventDraftRow(props: {
  token: string;
  storyId: string;
  event: EventDraftResponse;
  ordinal: number;
  total: number;
  sectionLabel: string | null;
  onPatched: (e: EventDraftResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
  onRefreshEvents: () => void | Promise<void>;
  regenInFlight: boolean;
  regenActive: boolean;
  onScopedEventRegenerate: () => void | Promise<void>;
}) {
  const {
    token,
    storyId,
    event,
    ordinal,
    total,
    sectionLabel,
    onPatched,
    onVersionConflict,
    onSaveError,
    onRefreshEvents,
    regenInFlight,
    regenActive,
    onScopedEventRegenerate,
  } = props;
  const [headline, setHeadline] = useState(event.headline);
  const [dek, setDek] = useState(normalizeDek(event.dek));
  const [summary, setSummary] = useState(event.summary);
  const [creatorNote, setCreatorNote] = useState(normalizeCreatorNote(event.creator_note));

  useEffect(() => {
    setHeadline(event.headline);
    setDek(normalizeDek(event.dek));
    setSummary(event.summary);
    setCreatorNote(normalizeCreatorNote(event.creator_note));
  }, [event.id, event.updated_at]);

  useEffect(() => {
    if (!token) return;
    const patch = buildEventPatch(event, headline, summary, creatorNote, dek);
    if (!patch) return;

    const tm = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchEvent(token, storyId, event.id, event.updated_at, patch);
          onPatched(res.data.event_draft);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const snap = extractConflictEvent(e.body);
            if (snap) onPatched(snap);
            onVersionConflict();
          } else {
            onSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Event save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(tm);
  }, [
    token,
    storyId,
    event.id,
    event.updated_at,
    event.headline,
    event.summary,
    event.creator_note,
    event.dek,
    headline,
    dek,
    summary,
    creatorNote,
    onPatched,
    onVersionConflict,
    onSaveError,
  ]);

  return (
    <article
      id={`timeline-event-${event.id}`}
      className="timeline-event-card editor-block editor-card editor-card--event"
    >
      <header className="timeline-event-card__head">
        <p className="timeline-event-card__sequence">
          Event {ordinal} of {total}
          <span className="muted small timeline-event-card__index"> · Index {event.position_index}</span>
        </p>
        <p className="timeline-event-card__section muted small">
          {sectionLabel ? (
            <>
              Narrative section: <strong>{sectionLabel}</strong>
            </>
          ) : (
            <>
              Not linked to a narrative section. You can set section only when <strong>adding</strong> an event; moving
              between sections is not supported by the API yet.
            </>
          )}
        </p>
      </header>
      <div className="editor-fieldgroup">
        <p className="editor-fieldgroup__title">Factual event copy</p>
        <p className="editor-fieldgroup__lead muted small">
          What happened — restrained, source-aware account. Keep opinion out of these fields.
        </p>
        <label className="field">
          <span className="label">Headline</span>
          <span className="field__hint">Event-led title for the timeline card.</span>
          <input
            type="text"
            className="input"
            value={headline}
            onChange={(ev) => setHeadline(ev.target.value)}
            autoComplete="off"
            maxLength={500}
          />
        </label>
        <label className="field">
          <span className="label">Dek</span>
          <span className="field__hint">Optional one-line factual deck under the headline.</span>
          <input
            type="text"
            className="input"
            value={dek}
            onChange={(ev) => setDek(ev.target.value)}
            autoComplete="off"
            maxLength={2000}
          />
        </label>
        <label className="field">
          <span className="label">Summary</span>
          <span className="field__hint">Factual account of the event for readers.</span>
          <textarea
            className="input textarea timeline-event-card__summary"
            value={summary}
            onChange={(ev) => setSummary(ev.target.value)}
            rows={5}
            maxLength={100000}
          />
        </label>
      </div>
      <div className="editor-fieldgroup editor-fieldgroup--creator">
        <p className="editor-fieldgroup__title">Creator note</p>
        <p className="editor-fieldgroup__lead muted small">
          Interpretation or significance — separate from the factual summary.
        </p>
        <label className="field">
          <span className="label">Note</span>
          <span className="field__hint">Optional. Commentary that must not read as neutral fact.</span>
          <textarea
            className="input textarea"
            value={creatorNote}
            onChange={(ev) => setCreatorNote(ev.target.value)}
            rows={3}
            maxLength={100000}
          />
        </label>
      </div>

      <div className="editor-regenerate-bar">
        <button
          type="button"
          className="btn ghost inline"
          disabled={!token || regenInFlight}
          onClick={() => void onScopedEventRegenerate()}
        >
          {regenActive ? "Starting…" : "Regenerate event from research"}
        </button>
        <span className="field__hint">
          Rebuilds this event and its sources from the latest chronology; other events stay as you edited them.
        </span>
      </div>

      <details className="timeline-event-card__sources">
        <summary className="timeline-event-card__sources-summary">Sources on this event</summary>
        <div className="timeline-event-card__sources-body">
          <EventSourcesBlock
            token={token}
            storyId={storyId}
            eventId={event.id}
            onSaveError={onSaveError}
            onVersionConflict={onVersionConflict}
            onAfterMutation={onRefreshEvents}
          />
        </div>
      </details>
    </article>
  );
}

export type TimelineEventsManagementPanelProps = {
  token: string;
  storyId: string;
  events: EventDraftResponse[];
  sections: SectionDraftResponse[];
  eventsLoadError: string | null;
  addingEvent: boolean;
  onAddEvent: (opts: { section_id?: string | null }) => void;
  onEventPatched: (e: EventDraftResponse) => void;
  onEventVersionConflict: () => void;
  onEventSaveError: (message: string) => void;
  onRefreshEvents: () => void | Promise<void>;
  regenInFlight: boolean;
  regenEventId: string | null;
  onScopedEventRegenerate: (eventId: string) => void | Promise<void>;
};

/**
 * M4-T05 — timeline event management (ordered events, edit, optional section on create).
 */
export function TimelineEventsManagementPanel(props: TimelineEventsManagementPanelProps) {
  const {
    token,
    storyId,
    events,
    sections,
    eventsLoadError,
    addingEvent,
    onAddEvent,
    onEventPatched,
    onEventVersionConflict,
    onEventSaveError,
    onRefreshEvents,
    regenInFlight,
    regenEventId,
    onScopedEventRegenerate,
  } = props;

  const [assignSectionId, setAssignSectionId] = useState<string>("");

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id)),
    [sections],
  );

  const sectionLabelById = useMemo(() => {
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

  const total = orderedEvents.length;

  return (
    <section
      className="editor-panel editor-panel--timeline editor-panel--timeline-mgmt"
      id="timeline-events"
      aria-labelledby="timeline-events-heading"
    >
      <div className="editor-panel__bar">
        <div className="editor-panel__bar-text">
          <p className="editor-panel__eyebrow">Timeline</p>
          <h3 id="timeline-events-heading" className="editor-panel__title">
            Events
          </h3>
          <p className="editor-panel__hint">
            Chronological story beats. Order matches the server list (index values); drag-and-drop or manual reorder is
            not available in the editor yet — new events are appended at the end.
          </p>
          <p className="editor-panel__hint muted small">
            Main narrative prose lives under <strong>Narrative sections</strong> above. Use events for dated or ordered
            beats and evidence rows.
          </p>
        </div>
        <div className="timeline-mgmt__add">
          <label className="field timeline-mgmt__section-pick">
            <span className="label">Section for new event</span>
            <select
              className="input"
              value={assignSectionId}
              onChange={(e) => setAssignSectionId(e.target.value)}
              aria-label="Assign new event to narrative section"
            >
              <option value="">None (timeline-wide)</option>
              {orderedSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="field__hint">Optional. Cannot be changed here after the event exists.</span>
          </label>
          <button
            type="button"
            className="btn ghost inline timeline-mgmt__add-btn"
            disabled={!token || addingEvent}
            onClick={() =>
              onAddEvent({
                section_id: assignSectionId === "" ? undefined : assignSectionId,
              })
            }
          >
            {addingEvent ? "Adding…" : "Add event"}
          </button>
        </div>
      </div>
      {eventsLoadError ? <p className="hint">{eventsLoadError}</p> : null}
      {total === 0 && !eventsLoadError ? (
        <p className="muted small timeline-mgmt__empty">
          No events yet. Add an event to start the timeline, or run research and draft assembly from the brief workspace
          if you expect generated chronology.
        </p>
      ) : null}
      <div className="timeline-mgmt__stack">
        {orderedEvents.map((ev, i) => (
          <TimelineEventDraftRow
            key={ev.id}
            token={token}
            storyId={storyId}
            event={ev}
            ordinal={i + 1}
            total={total}
            sectionLabel={
              ev.section_id
                ? (sectionLabelById.get(ev.section_id) ?? `${ev.section_id.slice(0, 8)}…`)
                : null
            }
            onPatched={onEventPatched}
            onVersionConflict={onEventVersionConflict}
            onSaveError={onEventSaveError}
            onRefreshEvents={onRefreshEvents}
            regenInFlight={regenInFlight}
            regenActive={regenInFlight && regenEventId === ev.id}
            onScopedEventRegenerate={() => void onScopedEventRegenerate(ev.id)}
          />
        ))}
      </div>
    </section>
  );
}
