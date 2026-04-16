import type { BriefImageryMode } from "@storywall/shared";

const OPTIONS: BriefImageryMode[] = [
  "selective_editorial",
  "minimal",
  "sourced_only",
  "no_imagery",
];

const LABELS: Record<BriefImageryMode, string> = {
  selective_editorial: "Selective editorial",
  minimal: "Minimal imagery",
  sourced_only: "Sourced imagery only",
  no_imagery: "No imagery",
};

const HINTS: Record<BriefImageryMode, string> = {
  selective_editorial:
    "Allow a curated set of visuals where editorial standards allow — typical default for narrative Storywalls.",
  minimal: "Use imagery sparingly; text and structure lead.",
  sourced_only: "Prefer visuals that are clearly tied to cited material.",
  no_imagery: "Publish without story imagery beyond typographic treatment.",
};

export type HeroMediaWorkflowPanelProps = {
  value: BriefImageryMode;
  onChange: (next: BriefImageryMode) => void;
  disabled?: boolean;
};

/**
 * M4-T07 — story-level imagery policy (BriefImageryMode on `story_draft`). No upload API in this release.
 */
export function HeroMediaWorkflowPanel(props: HeroMediaWorkflowPanelProps) {
  const { value, onChange, disabled } = props;

  return (
    <section
      className="editor-panel editor-panel--hero-media"
      id="hero-media-workflow"
      aria-labelledby="hero-media-heading"
    >
      <div className="editor-panel__head">
        <p className="editor-panel__eyebrow">Visuals</p>
        <h3 id="hero-media-heading" className="editor-panel__title">
          Hero imagery policy
        </h3>
        <p className="editor-panel__hint">
          This control sets the story&apos;s <strong>imagery mode</strong> on the draft — the editorial rule for how
          strongly visuals should appear alongside text. It is saved with the rest of the story draft.
        </p>
        <p className="editor-panel__hint muted small">
          There is <strong>no creator upload or media library</strong> in this release: you are choosing policy, not
          picking image files. Concrete hero frames and per-event imagery still flow from assembly and image proposals in
          the pipeline; a dedicated proposal browser is not wired here yet.
        </p>
      </div>

      <label className="field">
        <span className="label">Imagery mode</span>
        <span className="field__hint">{HINTS[value]}</span>
        <select
          className="input"
          value={value}
          disabled={disabled}
          onChange={(ev) => onChange(ev.target.value as BriefImageryMode)}
          aria-label="Story imagery mode"
        >
          {OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {LABELS[opt]}
            </option>
          ))}
        </select>
      </label>
      {disabled ? (
        <p className="muted small" style={{ marginTop: "0.75rem" }} role="status">
          Imagery policy saves with the story draft. Finish framing and draft assembly from the brief workspace so this
          story loads here, then choose the rule that fits how you want visuals treated.
        </p>
      ) : null}
    </section>
  );
}
