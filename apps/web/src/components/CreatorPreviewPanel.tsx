import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, listSourcesForEvent } from "../api/creatorClient";
import type { EventDraftResponse, SectionDraftResponse, SourceRecordResponse, StoryDraftResponse } from "../api/types";
import { buildPublicPreviewFromDraft } from "../lib/draftToPublicPreview";
import { PublicStoryArticle } from "./PublicStoryArticle";

export type CreatorPreviewPanelProps = {
  token: string;
  storyId: string;
  draft: StoryDraftResponse | null;
  sections: SectionDraftResponse[];
  events: EventDraftResponse[];
};

/**
 * M4-T08 — reader-structure preview from current draft (not a publish snapshot).
 */
export function CreatorPreviewPanel(props: CreatorPreviewPanelProps) {
  const { token, storyId, draft, sections, events } = props;
  const [sourcesByEventId, setSourcesByEventId] = useState<Record<string, SourceRecordResponse[]>>({});
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !storyId || events.length === 0) {
      setSourcesByEventId({});
      setSourcesLoading(false);
      setSourcesError(null);
      return;
    }
    const ordered = [...events].sort(
      (a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id),
    );
    let cancelled = false;
    setSourcesLoading(true);
    setSourcesError(null);
    void (async () => {
      const next: Record<string, SourceRecordResponse[]> = {};
      try {
        await Promise.all(
          ordered.map(async (ev) => {
            try {
              const r = await listSourcesForEvent(token, storyId, ev.id);
              if (!cancelled) {
                next[ev.id] = r.data.sources;
              }
            } catch {
              if (!cancelled) {
                next[ev.id] = [];
              }
            }
          }),
        );
        if (!cancelled) {
          setSourcesByEventId(next);
        }
      } catch (e) {
        if (!cancelled) {
          setSourcesError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load sources for preview.");
        }
      } finally {
        if (!cancelled) {
          setSourcesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId, events]);

  const previewStory = useMemo(() => {
    if (!draft) return null;
    return buildPublicPreviewFromDraft({
      storyId,
      draft,
      sections,
      events,
      sourcesByEventId,
    });
  }, [draft, events, sections, sourcesByEventId, storyId]);

  return (
    <section
      className="editor-panel editor-panel--creator-preview"
      id="creator-story-preview"
      aria-labelledby="creator-preview-heading"
    >
      <div className="editor-panel__head">
        <p className="editor-panel__eyebrow">Preview</p>
        <h3 id="creator-preview-heading" className="editor-panel__title">
          Reader layout (draft-fed)
        </h3>
        <p className="editor-panel__hint">
          Scroll the frame below to see how your current draft maps to the same blocks readers see: overview, lens,
          sections, timeline with references, sources list, and closing.
        </p>
      </div>

      {!draft ? (
        <p className="muted small">Load a story draft to preview (complete framing and assembly from the brief workspace).</p>
      ) : (
        <>
          {sourcesLoading ? <p className="muted small">Loading evidence rows for preview…</p> : null}
          {sourcesError ? <p className="hint">{sourcesError}</p> : null}
          <div className="creator-preview-frame" tabIndex={0} aria-label="Story reader preview">
            {previewStory ? (
              <PublicStoryArticle story={previewStory} slug={previewStory.slug} variant="creator_preview" />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
