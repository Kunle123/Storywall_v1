import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, createSource, listSourcesForEvent } from "../api/creatorClient";
import type { SourceRecordResponse } from "../api/types";
import { SourceDraftRow } from "./SourceDraftRow";

export type EventSourcesBlockProps = {
  token: string;
  storyId: string;
  eventId: string;
  onSaveError: (message: string) => void;
  onVersionConflict: () => void;
  /** Called after a source is added so parents can refresh aggregates or event rows. */
  onAfterMutation?: () => void | Promise<void>;
};

/**
 * Loads and edits source rows for one timeline event (mutation §15).
 */
export function EventSourcesBlock(props: EventSourcesBlockProps) {
  const { token, storyId, eventId, onSaveError, onVersionConflict, onAfterMutation } = props;
  const [sources, setSources] = useState<SourceRecordResponse[]>([]);
  const [sourcesLoadError, setSourcesLoadError] = useState<string | null>(null);
  const [addingSource, setAddingSource] = useState(false);

  const loadSources = useCallback(async () => {
    if (!token) return;
    setSourcesLoadError(null);
    try {
      const r = await listSourcesForEvent(token, storyId, eventId);
      setSources(r.data.sources);
    } catch (e) {
      setSourcesLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load sources.");
    }
  }, [token, storyId, eventId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const handleSourcePatched = useCallback((s: SourceRecordResponse) => {
    setSources((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  return (
    <div className="editor-source-nest event-sources-block">
      <div className="editor-source-nest__bar">
        <span className="editor-source-nest__label">Evidence rows</span>
        <button
          type="button"
          className="btn ghost inline"
          disabled={!token || addingSource}
          onClick={() => {
            if (!token || !storyId) return;
            setAddingSource(true);
            void (async () => {
              try {
                const r = await createSource(token, storyId, eventId, {
                  source_url: "https://example.com/evidence",
                  source_title: "New source",
                  publisher_name: "Publisher",
                  relevance_note: "Why this source supports the event.",
                });
                setSources((prev) => [...prev, r.data.source_record]);
                await onAfterMutation?.();
              } catch (e) {
                onSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add source.");
              } finally {
                setAddingSource(false);
              }
            })();
          }}
        >
          {addingSource ? "Adding…" : "Add source"}
        </button>
      </div>
      {sourcesLoadError ? <p className="hint">{sourcesLoadError}</p> : null}
      {!sourcesLoadError && sources.length === 0 ? (
        <p className="muted small" style={{ marginTop: "0.35rem" }} role="status">
          No source rows for this event yet. Use <strong>Add source</strong> to create a starter row, then replace the
          placeholder URL, title, and publisher with the real reference.
        </p>
      ) : null}
      {sources.map((src) => (
        <SourceDraftRow
          key={src.id}
          token={token}
          storyId={storyId}
          eventId={eventId}
          source={src}
          onPatched={handleSourcePatched}
          onVersionConflict={onVersionConflict}
          onSaveError={onSaveError}
        />
      ))}
    </div>
  );
}
