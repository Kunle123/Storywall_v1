import { useEffect, useState } from "react";
import { ApiRequestError, extractConflictSource, patchSource } from "../api/creatorClient";
import type { PatchSourceBody, SourceRecordResponse } from "../api/types";

const AUTOSAVE_MS = 600;

function buildSourcePatch(
  server: SourceRecordResponse,
  sourceTitle: string,
  relevanceNote: string,
  sourceUrl: string,
): PatchSourceBody | null {
  const p: PatchSourceBody = {};
  if (sourceTitle !== server.source_title) {
    p.source_title = sourceTitle;
  }
  if (relevanceNote !== server.relevance_note) {
    p.relevance_note = relevanceNote;
  }
  if (sourceUrl !== server.source_url) {
    p.source_url = sourceUrl;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.source_title !== undefined && p.source_title.trim().length < 1) return null;
  if (p.relevance_note !== undefined && p.relevance_note.trim().length < 1) return null;
  if (p.source_url !== undefined && p.source_url.trim().length < 8) return null;
  return p;
}

export type SourceDraftRowProps = {
  token: string;
  storyId: string;
  eventId: string;
  source: SourceRecordResponse;
  onPatched: (s: SourceRecordResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
};

export function SourceDraftRow(props: SourceDraftRowProps) {
  const { token, storyId, eventId, source, onPatched, onVersionConflict, onSaveError } = props;
  const [sourceTitle, setSourceTitle] = useState(source.source_title);
  const [relevanceNote, setRelevanceNote] = useState(source.relevance_note);
  const [sourceUrl, setSourceUrl] = useState(source.source_url);

  useEffect(() => {
    setSourceTitle(source.source_title);
    setRelevanceNote(source.relevance_note);
    setSourceUrl(source.source_url);
  }, [source.id, source.updated_at]);

  useEffect(() => {
    if (!token) return;
    const patch = buildSourcePatch(source, sourceTitle, relevanceNote, sourceUrl);
    if (!patch) return;

    const tm = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchSource(token, storyId, eventId, source.id, source.updated_at, patch);
          onPatched(res.data.source_record);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const snap = extractConflictSource(e.body);
            if (snap) onPatched(snap);
            onVersionConflict();
          } else {
            onSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Source save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(tm);
  }, [
    token,
    storyId,
    eventId,
    source.id,
    source.updated_at,
    source.source_title,
    source.relevance_note,
    source.source_url,
    sourceTitle,
    relevanceNote,
    sourceUrl,
    onPatched,
    onVersionConflict,
    onSaveError,
  ]);

  return (
    <div className="editor-block editor-block--source">
      <p className="editor-block__meta">
        Source <code className="inline-code">{source.id.slice(0, 8)}…</code>
      </p>
      <label className="field">
        <span className="label">URL</span>
        <span className="field__hint">Canonical evidence link.</span>
        <input
          type="url"
          className="input"
          value={sourceUrl}
          onChange={(ev) => setSourceUrl(ev.target.value)}
          autoComplete="off"
          maxLength={8000}
        />
      </label>
      <label className="field">
        <span className="label">Title</span>
        <span className="field__hint">Human-readable citation title.</span>
        <input
          type="text"
          className="input"
          value={sourceTitle}
          onChange={(ev) => setSourceTitle(ev.target.value)}
          autoComplete="off"
          maxLength={2000}
        />
      </label>
      <label className="field">
        <span className="label">Relevance to this event</span>
        <span className="field__hint">
          How this source supports the factual claim — evidence note, not general commentary.
        </span>
        <textarea
          className="input textarea"
          value={relevanceNote}
          onChange={(ev) => setRelevanceNote(ev.target.value)}
          rows={2}
          maxLength={100000}
        />
      </label>
    </div>
  );
}
