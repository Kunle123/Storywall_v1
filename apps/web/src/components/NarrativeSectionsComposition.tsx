import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, extractConflictSection, patchSection } from "../api/creatorClient";
import type { PatchSectionBody, SectionDraftResponse } from "../api/types";

const AUTOSAVE_MS = 600;

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

function NarrativeSectionDraftRow(props: {
  token: string;
  storyId: string;
  section: SectionDraftResponse;
  ordinal: number;
  total: number;
  onPatched: (s: SectionDraftResponse) => void;
  onVersionConflict: () => void;
  onSaveError: (message: string) => void;
  regenInFlight: boolean;
  regenActive: boolean;
  onScopedSectionRegenerate: () => void | Promise<void>;
}) {
  const {
    token,
    storyId,
    section,
    ordinal,
    total,
    onPatched,
    onVersionConflict,
    onSaveError,
    regenInFlight,
    regenActive,
    onScopedSectionRegenerate,
  } = props;
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
    <article className="narrative-section-card editor-block editor-card">
      <header className="narrative-section-card__head">
        <p className="narrative-section-card__sequence muted small">
          Section {ordinal} of {total}
        </p>
      </header>
      <div className="editor-fieldgroup">
        <p className="editor-fieldgroup__title">Heading &amp; body</p>
        <p className="editor-fieldgroup__lead muted small">
          Each block is one beat in the story&apos;s narrative spine. Headings orient readers; the body carries the main
          prose for this part of the arc.
        </p>
        <label className="field">
          <span className="label">Heading</span>
          <span className="field__hint">Short section title (for example Origins, Aftermath).</span>
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
          <span className="label">Body</span>
          <span className="field__hint">Main narrative text for this section. Saves automatically after you pause.</span>
          <textarea
            className="input textarea narrative-section-card__body"
            value={summary}
            onChange={(ev) => setSummary(ev.target.value)}
            rows={10}
            maxLength={100000}
          />
        </label>
      </div>

      <div className="editor-regenerate-bar">
        <button
          type="button"
          className="btn ghost inline"
          disabled={!token || regenInFlight}
          onClick={() => void onScopedSectionRegenerate()}
        >
          {regenActive ? "Starting…" : "Reload from framing candidate"}
        </button>
        <span className="field__hint">
          Replaces this section&apos;s heading and body from the selected frame slot; timeline events are unchanged.
        </span>
      </div>
    </article>
  );
}

export type NarrativeSectionsCompositionPanelProps = {
  token: string;
  storyId: string;
  sections: SectionDraftResponse[];
  sectionsLoadError: string | null;
  addingSection: boolean;
  onAddSection: () => void;
  onSectionPatched: (s: SectionDraftResponse) => void;
  onSectionVersionConflict: () => void;
  onSectionSaveError: (message: string) => void;
  regenInFlight: boolean;
  regenSectionId: string | null;
  onScopedSectionRegenerate: (sectionId: string) => void | Promise<void>;
};

/**
 * M4-T04 — primary narrative section composition (ordered section drafts, autosave).
 */
export function NarrativeSectionsCompositionPanel(props: NarrativeSectionsCompositionPanelProps) {
  const {
    token,
    storyId,
    sections,
    sectionsLoadError,
    addingSection,
    onAddSection,
    onSectionPatched,
    onSectionVersionConflict,
    onSectionSaveError,
    regenInFlight,
    regenSectionId,
    onScopedSectionRegenerate,
  } = props;

  const ordered = useMemo(
    () =>
      [...sections].sort(
        (a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id),
      ),
    [sections],
  );
  const total = ordered.length;

  return (
    <section
      className="editor-panel editor-panel--composition narrative-composition"
      id="narrative-composition"
      aria-labelledby="narrative-composition-heading"
    >
      <div className="editor-panel__bar">
        <div className="editor-panel__bar-text">
          <p className="editor-panel__eyebrow">Composition</p>
          <h3 id="narrative-composition-heading" className="editor-panel__title">
            Narrative sections
          </h3>
          <p className="editor-panel__hint">
            The ordered story body: write and revise each section here. New sections are added at the end; changing order
            in the manuscript is planned for a later milestone.
          </p>
        </div>
        <button type="button" className="btn ghost inline" disabled={!token || addingSection} onClick={onAddSection}>
          {addingSection ? "Adding…" : "Add section"}
        </button>
      </div>
      {sectionsLoadError ? <p className="hint">{sectionsLoadError}</p> : null}
      {total === 0 && !sectionsLoadError ? (
        <p className="muted small narrative-composition__empty">
          No sections yet. Add a section to start the narrative spine, or run draft assembly from the brief workspace if
          you expect generated structure.
        </p>
      ) : null}
      <div className="narrative-composition__stack">
        {ordered.map((sec, i) => (
          <NarrativeSectionDraftRow
            key={sec.id}
            token={token}
            storyId={storyId}
            section={sec}
            ordinal={i + 1}
            total={total}
            onPatched={onSectionPatched}
            onVersionConflict={onSectionVersionConflict}
            onSaveError={onSectionSaveError}
            regenInFlight={regenInFlight}
            regenActive={regenInFlight && regenSectionId === sec.id}
            onScopedSectionRegenerate={() => void onScopedSectionRegenerate(sec.id)}
          />
        ))}
      </div>
    </section>
  );
}
