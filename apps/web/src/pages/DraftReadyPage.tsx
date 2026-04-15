import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CreatorWorkflowState } from "@storywall/shared";
import {
  ApiRequestError,
  createEvent,
  createSection,
  createSource,
  extractConflictDraft,
  extractConflictEvent,
  extractConflictSection,
  extractConflictSource,
  listEvents,
  listFrames,
  listSections,
  listSourcesForEvent,
  patchEvent,
  patchSection,
  patchSource,
  patchStoryDraft,
} from "../api/creatorClient";
import type {
  EventDraftResponse,
  PatchEventBody,
  PatchSectionBody,
  PatchSourceBody,
  PatchStoryDraftBody,
  SectionDraftResponse,
  SourceRecordResponse,
  StoryDraftResponse,
} from "../api/types";
import { useAuth } from "../auth/AuthProvider";

const AUTOSAVE_MS = 600;

type LocalDraftFields = {
  title: string;
  subtitle: string;
  summary: string;
  lens: string;
  conclusion: string;
};

function normalizeSubtitle(s: string | null | undefined): string {
  return s ?? "";
}

function normalizeConclusion(s: string | null | undefined): string {
  return s ?? "";
}

function isDirtyVersusServer(draft: StoryDraftResponse, local: LocalDraftFields): boolean {
  if (local.title !== draft.title) return true;
  if (local.subtitle !== normalizeSubtitle(draft.subtitle)) return true;
  if (local.summary !== draft.summary) return true;
  if (local.lens !== draft.lens) return true;
  if (local.conclusion !== normalizeConclusion(draft.conclusion)) return true;
  return false;
}

/** Partial PATCH body for changed fields only; returns null if nothing to send or if required fields would be invalid. */
function buildValidPatch(draft: StoryDraftResponse, local: LocalDraftFields): PatchStoryDraftBody | null {
  const p: PatchStoryDraftBody = {};
  if (local.title !== draft.title) {
    p.title = local.title;
  }
  if (local.subtitle !== normalizeSubtitle(draft.subtitle)) {
    p.subtitle = local.subtitle === "" ? null : local.subtitle;
  }
  if (local.summary !== draft.summary) {
    p.summary = local.summary;
  }
  if (local.lens !== draft.lens) {
    p.lens = local.lens;
  }
  if (local.conclusion !== normalizeConclusion(draft.conclusion)) {
    p.conclusion = local.conclusion === "" ? null : local.conclusion;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.title !== undefined && p.title.trim().length < 1) return null;
  if (p.summary !== undefined && p.summary.trim().length < 1) return null;
  if (p.lens !== undefined && p.lens.trim().length < 1) return null;
  return p;
}

function applyServerDraftToForm(d: StoryDraftResponse, setters: {
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setSummary: (v: string) => void;
  setLens: (v: string) => void;
  setConclusion: (v: string) => void;
}) {
  setters.setTitle(d.title);
  setters.setSubtitle(normalizeSubtitle(d.subtitle));
  setters.setSummary(d.summary);
  setters.setLens(d.lens);
  setters.setConclusion(normalizeConclusion(d.conclusion));
}

function buildSectionPatch(
  server: SectionDraftResponse,
  label: string,
  summary: string,
): PatchSectionBody | null {
  const p: PatchSectionBody = {};
  if (label !== server.label) {
    p.label = label;
  }
  const localSum = summary ?? "";
  const srvSum = server.summary ?? "";
  if (localSum !== srvSum) {
    p.summary = localSum === "" ? null : summary;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.label !== undefined && p.label.trim().length < 1) return null;
  return p;
}

function buildEventPatch(
  server: EventDraftResponse,
  headline: string,
  summary: string,
): PatchEventBody | null {
  const p: PatchEventBody = {};
  if (headline !== server.headline) {
    p.headline = headline;
  }
  if (summary !== server.summary) {
    p.summary = summary;
  }
  if (Object.keys(p).length === 0) return null;
  if (p.headline !== undefined && p.headline.trim().length < 1) return null;
  if (p.summary !== undefined && p.summary.trim().length < 1) return null;
  return p;
}

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

function SourceDraftRow(props: {
  token: string;
  storyId: string;
  eventId: string;
  source: SourceRecordResponse;
  onPatched: (s: SourceRecordResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
}) {
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
        <span className="label">Relevance</span>
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

function EventDraftRow(props: {
  token: string;
  storyId: string;
  event: EventDraftResponse;
  onPatched: (e: EventDraftResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
  onRefreshEvents: () => void | Promise<void>;
}) {
  const { token, storyId, event, onPatched, onVersionConflict, onSaveError, onRefreshEvents } = props;
  const [headline, setHeadline] = useState(event.headline);
  const [summary, setSummary] = useState(event.summary);
  const [sources, setSources] = useState<SourceRecordResponse[]>([]);
  const [sourcesLoadError, setSourcesLoadError] = useState<string | null>(null);
  const [addingSource, setAddingSource] = useState(false);

  useEffect(() => {
    setHeadline(event.headline);
    setSummary(event.summary);
  }, [event.id, event.updated_at]);

  const loadSources = useCallback(async () => {
    if (!token) return;
    setSourcesLoadError(null);
    try {
      const r = await listSourcesForEvent(token, storyId, event.id);
      setSources(r.data.sources);
    } catch (e) {
      setSourcesLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load sources.");
    }
  }, [token, storyId, event.id]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const handleSourcePatched = useCallback((s: SourceRecordResponse) => {
    setSources((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  useEffect(() => {
    if (!token) return;
    const patch = buildEventPatch(event, headline, summary);
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
    headline,
    summary,
    onPatched,
    onVersionConflict,
    onSaveError,
  ]);

  return (
    <div className="editor-block editor-card editor-card--event">
      <p className="editor-block__meta">
        Event <code className="inline-code">{event.id.slice(0, 8)}…</code>
      </p>
      <label className="field">
        <span className="label">Headline</span>
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
        <span className="label">Summary</span>
        <textarea
          className="input textarea"
          value={summary}
          onChange={(ev) => setSummary(ev.target.value)}
          rows={3}
          maxLength={100000}
        />
      </label>

      <div className="editor-source-nest">
        <div className="editor-source-nest__bar">
          <span className="editor-source-nest__label">Sources</span>
          <button
            type="button"
            className="btn ghost inline"
            disabled={!token || addingSource}
            onClick={() => {
              if (!token || !storyId) return;
              setAddingSource(true);
              void (async () => {
                try {
                  const r = await createSource(token, storyId, event.id, {
                    source_url: "https://example.com/evidence",
                    source_title: "New source",
                    publisher_name: "Publisher",
                    relevance_note: "Why this source supports the event.",
                  });
                  setSources((prev) => [...prev, r.data.source_record]);
                  void onRefreshEvents();
                } catch (e) {
                  onSaveError(
                    e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add source.",
                  );
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
        {sources.map((src) => (
          <SourceDraftRow
            key={src.id}
            token={token}
            storyId={storyId}
            eventId={event.id}
            source={src}
            onPatched={handleSourcePatched}
            onVersionConflict={onVersionConflict}
            onSaveError={onSaveError}
          />
        ))}
      </div>
    </div>
  );
}

function SectionDraftRow(props: {
  token: string;
  storyId: string;
  section: SectionDraftResponse;
  onPatched: (s: SectionDraftResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
}) {
  const { token, storyId, section, onPatched, onVersionConflict, onSaveError } = props;
  const [label, setLabel] = useState(section.label);
  const [summary, setSummary] = useState(section.summary ?? "");

  useEffect(() => {
    setLabel(section.label);
    setSummary(section.summary ?? "");
  }, [section.id, section.updated_at]);

  useEffect(() => {
    if (!token) return;
    const patch = buildSectionPatch(section, label, summary);
    if (!patch) return;

    const tm = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchSection(token, storyId, section.id, section.updated_at, patch);
          onPatched(res.data.section_draft);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const snap = extractConflictSection(e.body);
            if (snap) onPatched(snap);
            onVersionConflict();
          } else {
            onSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Section save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(tm);
  }, [
    token,
    storyId,
    section.id,
    section.updated_at,
    section.label,
    section.summary,
    label,
    summary,
    onPatched,
    onVersionConflict,
    onSaveError,
  ]);

  return (
    <div className="editor-block editor-card">
      <p className="editor-block__meta">
        Section <code className="inline-code">{section.id.slice(0, 8)}…</code>
      </p>
      <label className="field">
        <span className="label">Label</span>
        <input
          type="text"
          className="input"
          value={label}
          onChange={(ev) => setLabel(ev.target.value)}
          autoComplete="off"
          maxLength={500}
        />
      </label>
      <label className="field">
        <span className="label">Summary</span>
        <textarea
          className="input textarea"
          value={summary}
          onChange={(ev) => setSummary(ev.target.value)}
          rows={3}
          maxLength={100000}
        />
      </label>
    </div>
  );
}

/**
 * M2-T06 entry + M2-T07 story-level draft autosave (mutation §12.1).
 */
export function DraftReadyPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { token, creator, logout } = useAuth();
  const [workflow, setWorkflow] = useState<CreatorWorkflowState | null>(null);
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [lens, setLens] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [sections, setSections] = useState<SectionDraftResponse[]>([]);
  const [sectionsLoadError, setSectionsLoadError] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [events, setEvents] = useState<EventDraftResponse[]>([]);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);

  const localFields: LocalDraftFields = { title, subtitle, summary, lens, conclusion };

  const refreshSections = useCallback(async () => {
    if (!token || !storyId) return;
    setSectionsLoadError(null);
    try {
      const r = await listSections(token, storyId);
      setSections(r.data.sections);
    } catch (e) {
      setSectionsLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load sections.");
    }
  }, [token, storyId]);

  const refreshEvents = useCallback(async () => {
    if (!token || !storyId) return;
    setEventsLoadError(null);
    try {
      const r = await listEvents(token, storyId);
      setEvents(r.data.events);
    } catch (e) {
      setEventsLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load events.");
    }
  }, [token, storyId]);

  const handleSectionPatched = useCallback((s: SectionDraftResponse) => {
    setSections((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  const handleSectionConflict = useCallback(() => {
    setSaveError("Version conflict — section refreshed from the server.");
  }, []);

  const handleSectionSaveError = useCallback((message: string) => {
    setSaveError(message);
  }, []);

  const handleEventPatched = useCallback((ev: EventDraftResponse) => {
    setEvents((prev) => prev.map((x) => (x.id === ev.id ? ev : x)));
  }, []);

  const handleEventConflict = useCallback(() => {
    setSaveError("Version conflict — event refreshed from the server.");
  }, []);

  const handleEventSaveError = useCallback((message: string) => {
    setSaveError(message);
  }, []);

  useEffect(() => {
    if (!token || !storyId) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const r = await listFrames(token, storyId);
        if (cancelled) return;
        setWorkflow(r.data.story_state);
        const d = r.data.story_draft;
        setDraft(d);
        if (d) {
          applyServerDraftToForm(d, { setTitle, setSubtitle, setSummary, setLens, setConclusion });
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not load story.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storyId]);

  useEffect(() => {
    if (!token || !storyId || !draft || workflow !== "ready_for_edit") return;
    void refreshSections();
    void refreshEvents();
  }, [token, storyId, draft, workflow, refreshSections, refreshEvents]);

  useEffect(() => {
    if (!token || !storyId || !draft || workflow !== "ready_for_edit") return;
    if (!isDirtyVersusServer(draft, localFields)) return;
    const patch = buildValidPatch(draft, localFields);
    if (!patch) return;

    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await patchStoryDraft(token, storyId, draft.last_edited_at, patch);
          setDraft(res.data.story_draft);
          applyServerDraftToForm(res.data.story_draft, {
            setTitle,
            setSubtitle,
            setSummary,
            setLens,
            setConclusion,
          });
          setSaveError(null);
          setSaveOk(true);
          window.setTimeout(() => setSaveOk(false), 2000);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 409) {
            const server = extractConflictDraft(e.body);
            if (server) {
              setDraft(server);
              applyServerDraftToForm(server, {
                setTitle,
                setSubtitle,
                setSummary,
                setLens,
                setConclusion,
              });
            }
            setSaveError("Version conflict — loaded the latest draft from the server.");
          } else {
            setSaveError(e instanceof ApiRequestError ? JSON.stringify(e.body) : "Save failed.");
          }
        }
      })();
    }, AUTOSAVE_MS);

    return () => clearTimeout(t);
  }, [token, storyId, draft, workflow, title, subtitle, summary, lens, conclusion]);

  if (!storyId) {
    return (
      <div className="page narrow">
        <p>Invalid story.</p>
      </div>
    );
  }

  return (
    <div className="page draft-workspace-page">
      <header className="creator-header draft-workspace-header">
        <div>
          <h1 className="page-title">Draft ready</h1>
          <p className="page-lead muted">
            Editorial workspace — story <code className="inline-code">{storyId}</code>
          </p>
        </div>
        <div className="creator-header-actions">
          <span className="muted small">{creator?.email}</span>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>

      {loadError ? <div className="banner error">{loadError}</div> : null}
      {saveError ? <div className="banner error">{saveError}</div> : null}
      {saveOk ? <div className="banner success">Draft saved.</div> : null}

      {!loadError && workflow && workflow !== "ready_for_edit" ? (
        <div className="banner warn">
          Current workflow is <strong>{workflow}</strong>, not <code className="inline-code">ready_for_edit</code>. Use the brief
          workspace to run research or draft assembly, or open generation status if you have a job link.
          <div style={{ marginTop: "0.75rem" }}>
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              Brief workspace
            </Link>
          </div>
        </div>
      ) : null}

      {!loadError && workflow === "ready_for_edit" ? (
        <div className="card draft-ready-card">
          <p className="draft-ready-badge">ready_for_edit</p>
          <div className="editor-workspace-intro">
            <h2 className="draft-ready-title">Your draft workspace is open</h2>
            <p className="editor-workspace-lead muted small">
              Edit story copy, outline sections, and build the timeline. Changes save automatically (creator mutations §12–15).
            </p>
          </div>
          {draft ? (
            <div className="editor-shell">
              <section className="editor-panel editor-panel--story" aria-labelledby="editor-story-heading">
                <div className="editor-panel__head">
                  <p className="editor-panel__eyebrow">Story</p>
                  <h3 id="editor-story-heading" className="editor-panel__title">
                    Narrative &amp; discovery
                  </h3>
                  <p className="editor-panel__hint">
                    How this Storywall presents in feeds and search — title through conclusion.
                  </p>
                </div>
                <div className="editor-fields-stack">
                  <label className="field">
                    <span className="label">Title</span>
                    <input
                      type="text"
                      className="input"
                      value={title}
                      onChange={(ev) => setTitle(ev.target.value)}
                      autoComplete="off"
                      maxLength={500}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Subtitle</span>
                    <input
                      type="text"
                      className="input"
                      value={subtitle}
                      onChange={(ev) => setSubtitle(ev.target.value)}
                      autoComplete="off"
                      maxLength={500}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Summary</span>
                    <textarea
                      className="input textarea"
                      value={summary}
                      onChange={(ev) => setSummary(ev.target.value)}
                      rows={5}
                      maxLength={100_000}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Lens</span>
                    <textarea
                      className="input textarea"
                      value={lens}
                      onChange={(ev) => setLens(ev.target.value)}
                      rows={5}
                      maxLength={100_000}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Conclusion</span>
                    <textarea
                      className="input textarea"
                      value={conclusion}
                      onChange={(ev) => setConclusion(ev.target.value)}
                      rows={4}
                      maxLength={100_000}
                    />
                  </label>
                </div>
              </section>

              <section className="editor-panel editor-panel--outline" aria-labelledby="editor-sections-heading">
                <div className="editor-panel__bar">
                  <div className="editor-panel__bar-text">
                    <p className="editor-panel__eyebrow">Structure</p>
                    <h3 id="editor-sections-heading" className="editor-panel__title">
                      Sections
                    </h3>
                    <p className="editor-panel__hint">Optional arcs or chapters that group the timeline.</p>
                  </div>
                  <button
                    type="button"
                    className="btn ghost inline"
                    disabled={!token || addingSection}
                    onClick={() => {
                      if (!token || !storyId) return;
                      setAddingSection(true);
                      void (async () => {
                        try {
                          const r = await createSection(token, storyId, { label: "New section" });
                          setSections((prev) => [...prev, r.data.section_draft]);
                          setSaveError(null);
                        } catch (e) {
                          setSaveError(
                            e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add section.",
                          );
                        } finally {
                          setAddingSection(false);
                        }
                      })();
                    }}
                  >
                    {addingSection ? "Adding…" : "Add section"}
                  </button>
                </div>
                {sectionsLoadError ? <p className="hint">{sectionsLoadError}</p> : null}
                {sections.map((sec) => (
                  <SectionDraftRow
                    key={sec.id}
                    token={token!}
                    storyId={storyId}
                    section={sec}
                    onPatched={handleSectionPatched}
                    onVersionConflict={handleSectionConflict}
                    onSaveError={handleSectionSaveError}
                  />
                ))}
              </section>

              <section className="editor-panel editor-panel--timeline" aria-labelledby="editor-events-heading">
                <div className="editor-panel__bar">
                  <div className="editor-panel__bar-text">
                    <p className="editor-panel__eyebrow">Timeline</p>
                    <h3 id="editor-events-heading" className="editor-panel__title">
                      Events
                    </h3>
                    <p className="editor-panel__hint">Chronology and evidence. Each event can carry sources.</p>
                  </div>
                  <button
                    type="button"
                    className="btn ghost inline"
                    disabled={!token || addingEvent}
                    onClick={() => {
                      if (!token || !storyId) return;
                      setAddingEvent(true);
                      void (async () => {
                        try {
                          const r = await createEvent(token, storyId, {
                            headline: "New event",
                            summary: "Draft event summary.",
                          });
                          setEvents((prev) => [...prev, r.data.event_draft]);
                          setSaveError(null);
                        } catch (e) {
                          setSaveError(
                            e instanceof ApiRequestError ? JSON.stringify(e.body) : "Could not add event.",
                          );
                        } finally {
                          setAddingEvent(false);
                        }
                      })();
                    }}
                  >
                    {addingEvent ? "Adding…" : "Add event"}
                  </button>
                </div>
                {eventsLoadError ? <p className="hint">{eventsLoadError}</p> : null}
                {events.map((ev) => (
                  <EventDraftRow
                    key={ev.id}
                    token={token!}
                    storyId={storyId}
                    event={ev}
                    onPatched={handleEventPatched}
                    onVersionConflict={handleEventConflict}
                    onSaveError={handleEventSaveError}
                    onRefreshEvents={refreshEvents}
                  />
                ))}
              </section>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              No story draft row yet — complete framing selection and draft assembly from the brief workspace.
            </p>
          )}
          <div className="draft-ready-actions">
            <Link to={`/creator/stories/${storyId}/brief`} className="btn primary inline">
              {"Brief & generation actions"}
            </Link>
            <Link to={`/creator/stories/${storyId}/framing`} className="btn ghost inline">
              Framing
            </Link>
          </div>
        </div>
      ) : null}

      {!loadError && workflow === null ? (
        <p className="muted" aria-busy="true">
          Loading workflow…
        </p>
      ) : null}
    </div>
  );
}
