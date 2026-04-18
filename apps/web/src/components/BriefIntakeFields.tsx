import type { BriefFormValues } from "../lib/briefFormModel";
import { CannedStartersPanel } from "./CannedStartersPanel";

const STORY_TYPES: { value: BriefFormValues["story_type"]; label: string }[] = [
  { value: "biography", label: "Biography" },
  { value: "issue_history", label: "Issue history" },
  { value: "influence", label: "Influence" },
  { value: "controversy", label: "Controversy" },
  { value: "movement_history", label: "Movement history" },
  { value: "relationship_impact", label: "Relationship impact" },
  { value: "custom", label: "Custom" },
];

const TIME_MODES: { value: BriefFormValues["time_scope_mode"]; label: string }[] = [
  { value: "entire_history", label: "Entire history / full arc" },
  { value: "bounded_range", label: "Bounded date range" },
  { value: "open_recent", label: "Open / recent focus" },
  { value: "custom", label: "Custom scope" },
];

const AUDIENCES: { value: string; label: string }[] = [
  { value: "", label: "— Optional —" },
  { value: "general", label: "General" },
  { value: "fan", label: "Fan" },
  { value: "student", label: "Student" },
  { value: "specialist", label: "Specialist" },
  { value: "custom", label: "Custom" },
];

const NARRATIVE: { value: BriefFormValues["narrative_intent"]; label: string }[] = [
  { value: "documentary", label: "Documentary" },
  { value: "explanatory", label: "Explanatory" },
  { value: "analytical", label: "Analytical" },
  { value: "commemorative", label: "Commemorative" },
  { value: "comparative", label: "Comparative" },
];

const IMAGERY: { value: BriefFormValues["imagery_mode"]; label: string }[] = [
  { value: "selective_editorial", label: "Selective editorial" },
  { value: "minimal", label: "Minimal" },
  { value: "sourced_only", label: "Sourced only" },
  { value: "no_imagery", label: "No imagery" },
];

const WRITING: { value: string; label: string }[] = [
  { value: "", label: "— Optional —" },
  { value: "neutral", label: "Neutral" },
  { value: "analytical", label: "Analytical" },
  { value: "concise", label: "Concise" },
  { value: "documentary", label: "Documentary" },
];

const CREATION: { value: BriefFormValues["creation_mode"]; label: string }[] = [
  { value: "ai_first", label: "AI-first" },
  { value: "hybrid", label: "Hybrid" },
  { value: "manual_heavy", label: "Manual-heavy" },
];

const SUBJECT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "— Let Storywall infer —" },
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" },
  { value: "event", label: "Event" },
  { value: "topic", label: "Topic" },
  { value: "place", label: "Place" },
  { value: "movement", label: "Movement" },
  { value: "conflict", label: "Conflict" },
  { value: "other", label: "Other" },
];

function patch<K extends keyof BriefFormValues>(onChange: (p: Partial<BriefFormValues>) => void, key: K, v: BriefFormValues[K]) {
  onChange({ [key]: v } as Partial<BriefFormValues>);
}

function AdvancedBriefOptions({
  value,
  onChange,
  disabled,
}: {
  value: BriefFormValues;
  onChange: (p: Partial<BriefFormValues>) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <CannedStartersPanel value={value} onChange={onChange} disabled={disabled} />
      <section className="brief-section">
        <h2 className="brief-h2">Story type & subject kind</h2>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Story type</span>
            <select
              className="input"
              value={value.story_type}
              onChange={(e) => patch(onChange, "story_type", e.target.value as BriefFormValues["story_type"])}
              disabled={disabled}
            >
              {STORY_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Subject kind (optional)</span>
            <select
              className="input"
              value={value.subject_type_input}
              onChange={(e) => patch(onChange, "subject_type_input", e.target.value)}
              disabled={disabled}
            >
              {SUBJECT_TYPES.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="brief-section">
        <h2 className="brief-h2">Audience & voice defaults</h2>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Audience</span>
            <select
              className="input"
              value={value.audience}
              onChange={(e) => patch(onChange, "audience", e.target.value)}
              disabled={disabled}
            >
              {AUDIENCES.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Writing style (optional)</span>
            <select
              className="input"
              value={value.writing_style_preference}
              onChange={(e) => patch(onChange, "writing_style_preference", e.target.value)}
              disabled={disabled}
            >
              {WRITING.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="brief-section">
        <h2 className="brief-h2">Imagery & creation mode</h2>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Imagery mode</span>
            <select
              className="input"
              value={value.imagery_mode}
              onChange={(e) => patch(onChange, "imagery_mode", e.target.value as BriefFormValues["imagery_mode"])}
              disabled={disabled}
            >
              {IMAGERY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Creation mode</span>
            <select
              className="input"
              value={value.creation_mode}
              onChange={(e) => patch(onChange, "creation_mode", e.target.value as BriefFormValues["creation_mode"])}
              disabled={disabled}
            >
              {CREATION.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="brief-section">
        <h2 className="brief-h2">Reference seeds (optional)</h2>
        <label className="field">
          <span className="label">Source URLs</span>
          <textarea
            className="input textarea"
            rows={3}
            value={value.source_inputs_text}
            onChange={(e) => patch(onChange, "source_inputs_text", e.target.value)}
            disabled={disabled}
            placeholder={"One URL per line. Clear the field to remove reference seeds on save."}
          />
        </label>
      </section>
    </>
  );
}

export function BriefIntakeFields({
  value,
  onChange,
  disabled,
  variant = "default",
}: {
  value: BriefFormValues;
  onChange: (p: Partial<BriefFormValues>) => void;
  disabled?: boolean;
  variant?: "default" | "new_story_setup";
}) {
  const showDates = value.time_scope_mode !== "entire_history";

  if (variant === "new_story_setup") {
    return (
      <div className="brief-grid story-setup-brief">
        <header className="story-setup-intro">
          <p className="story-setup-intro__lead muted">
            Define the brief your Storywall will build on: a clear title, what you are exploring, the lens you bring,
            and the boundaries of the work. Defaults for story type, imagery, and research style live below—you can
            change them anytime before you run generation.
          </p>
        </header>

        <section className="brief-section story-setup-primary">
          <h2 className="brief-h2">Story title</h2>
          <p className="hint">Working title for this Storywall. It also seeds the public slug.</p>
          <label className="field">
            <span className="label">Title</span>
            <input
              className="input"
              value={value.subject}
              onChange={(e) => patch(onChange, "subject", e.target.value)}
              disabled={disabled}
              placeholder="e.g. The 1979 energy crisis in the Midwest"
              autoComplete="off"
            />
          </label>
        </section>

        <section className="brief-section story-setup-primary">
          <h2 className="brief-h2">Working summary</h2>
          <p className="hint">What this Storywall is about in plain language—enough that another editor could pick it up.</p>
          <label className="field">
            <span className="label">Summary</span>
            <textarea
              className="input textarea"
              rows={5}
              value={value.research_brief}
              onChange={(e) => patch(onChange, "research_brief", e.target.value)}
              disabled={disabled}
              placeholder="Central question, stakes, and what a reader should leave with."
            />
          </label>
        </section>

        <section className="brief-section story-setup-primary">
          <h2 className="brief-h2">Angle & lens</h2>
          <p className="hint">The point of view, hypothesis, or editorial emphasis—not the full narrative yet.</p>
          <label className="field">
            <span className="label">Angle or lens</span>
            <textarea
              className="input textarea"
              rows={4}
              value={value.desired_angle}
              onChange={(e) => patch(onChange, "desired_angle", e.target.value)}
              disabled={disabled}
              placeholder="How you are approaching the subject and what you want to prove or illuminate."
            />
          </label>
        </section>

        <section className="brief-section story-setup-primary">
          <h2 className="brief-h2">Scope & boundaries</h2>
          <p className="hint">Time horizon and anything you already know is in or out of scope.</p>
          <label className="field">
            <span className="label">Time horizon</span>
            <select
              className="input"
              value={value.time_scope_mode}
              onChange={(e) => patch(onChange, "time_scope_mode", e.target.value as BriefFormValues["time_scope_mode"])}
              disabled={disabled}
            >
              {TIME_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {showDates ? (
            <div className="field-row">
              <label className="field flex-1">
                <span className="label">Start (YYYY-MM-DD)</span>
                <input
                  className="input"
                  type="date"
                  value={value.time_scope_start}
                  onChange={(e) => patch(onChange, "time_scope_start", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field flex-1">
                <span className="label">End (YYYY-MM-DD)</span>
                <input
                  className="input"
                  type="date"
                  value={value.time_scope_end}
                  onChange={(e) => patch(onChange, "time_scope_end", e.target.value)}
                  disabled={disabled}
                />
              </label>
            </div>
          ) : null}
          <label className="field">
            <span className="label">Scope note (optional)</span>
            <textarea
              className="input textarea"
              rows={3}
              value={value.suggested_time_scope}
              onChange={(e) => patch(onChange, "suggested_time_scope", e.target.value)}
              disabled={disabled}
              placeholder="Regions, eras, people, or angles that are explicitly in or out of scope."
            />
          </label>
          <label className="field">
            <span className="label">Storytelling approach</span>
            <select
              className="input"
              value={value.narrative_intent}
              onChange={(e) => patch(onChange, "narrative_intent", e.target.value as BriefFormValues["narrative_intent"])}
              disabled={disabled}
            >
              {NARRATIVE.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <details className="story-setup-advanced">
          <summary className="story-setup-advanced__summary">Optional defaults & starters</summary>
          <div className="story-setup-advanced__body">
            <AdvancedBriefOptions value={value} onChange={onChange} disabled={disabled} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="brief-grid">
      <CannedStartersPanel value={value} onChange={onChange} disabled={disabled} />
      <section className="brief-section">
        <h2 className="brief-h2">Subject & type</h2>
        <label className="field">
          <span className="label">Subject</span>
          <input
            className="input"
            value={value.subject}
            onChange={(e) => patch(onChange, "subject", e.target.value)}
            disabled={disabled}
            placeholder="Person, topic, issue, or organization"
            autoComplete="off"
          />
        </label>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Story type</span>
            <select
              className="input"
              value={value.story_type}
              onChange={(e) => patch(onChange, "story_type", e.target.value as BriefFormValues["story_type"])}
              disabled={disabled}
            >
              {STORY_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Subject type (optional)</span>
            <select
              className="input"
              value={value.subject_type_input}
              onChange={(e) => patch(onChange, "subject_type_input", e.target.value)}
              disabled={disabled}
            >
              {SUBJECT_TYPES.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="brief-section">
        <h2 className="brief-h2">Angle & research brief</h2>
        <label className="field">
          <span className="label">Research brief</span>
          <textarea
            className="input textarea"
            rows={4}
            value={value.research_brief}
            onChange={(e) => patch(onChange, "research_brief", e.target.value)}
            disabled={disabled}
            placeholder="Plain-language description of the story you want."
          />
        </label>
        <label className="field">
          <span className="label">Desired angle</span>
          <textarea
            className="input textarea"
            rows={3}
            value={value.desired_angle}
            onChange={(e) => patch(onChange, "desired_angle", e.target.value)}
            disabled={disabled}
            placeholder="Your initial framing or hypothesis."
          />
        </label>
      </section>

      <section className="brief-section">
        <h2 className="brief-h2">Scope & audience</h2>
        <label className="field">
          <span className="label">Time scope mode</span>
          <select
            className="input"
            value={value.time_scope_mode}
            onChange={(e) => patch(onChange, "time_scope_mode", e.target.value as BriefFormValues["time_scope_mode"])}
            disabled={disabled}
          >
            {TIME_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {showDates ? (
          <div className="field-row">
            <label className="field flex-1">
              <span className="label">Start (YYYY-MM-DD)</span>
              <input
                className="input"
                type="date"
                value={value.time_scope_start}
                onChange={(e) => patch(onChange, "time_scope_start", e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="field flex-1">
              <span className="label">End (YYYY-MM-DD)</span>
              <input
                className="input"
                type="date"
                value={value.time_scope_end}
                onChange={(e) => patch(onChange, "time_scope_end", e.target.value)}
                disabled={disabled}
              />
            </label>
          </div>
        ) : null}
        <p className="hint">Clear dates to remove bounds when the API allows null clears (optional fields).</p>
        <label className="field">
          <span className="label">Scope note (optional)</span>
          <textarea
            className="input textarea"
            rows={3}
            value={value.suggested_time_scope}
            onChange={(e) => patch(onChange, "suggested_time_scope", e.target.value)}
            disabled={disabled}
            placeholder="Temporal or topical boundaries in plain language (optional)."
          />
        </label>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Audience</span>
            <select
              className="input"
              value={value.audience}
              onChange={(e) => patch(onChange, "audience", e.target.value)}
              disabled={disabled}
            >
              {AUDIENCES.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Narrative intent</span>
            <select
              className="input"
              value={value.narrative_intent}
              onChange={(e) => patch(onChange, "narrative_intent", e.target.value as BriefFormValues["narrative_intent"])}
              disabled={disabled}
            >
              {NARRATIVE.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="brief-section">
        <h2 className="brief-h2">Imagery & creation mode</h2>
        <div className="field-row">
          <label className="field flex-1">
            <span className="label">Imagery mode</span>
            <select
              className="input"
              value={value.imagery_mode}
              onChange={(e) => patch(onChange, "imagery_mode", e.target.value as BriefFormValues["imagery_mode"])}
              disabled={disabled}
            >
              {IMAGERY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-1">
            <span className="label">Writing style (optional)</span>
            <select
              className="input"
              value={value.writing_style_preference}
              onChange={(e) => patch(onChange, "writing_style_preference", e.target.value)}
              disabled={disabled}
            >
              {WRITING.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="label">Creation mode</span>
          <select
            className="input"
            value={value.creation_mode}
            onChange={(e) => patch(onChange, "creation_mode", e.target.value as BriefFormValues["creation_mode"])}
            disabled={disabled}
          >
            {CREATION.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {value.creation_mode === "ai_first" ? (
          <p className="hint small" style={{ marginTop: "0.35rem" }}>
            “AI-first” means Storywall&apos;s workflow can call <strong>live</strong> model steps where the host enables them;
            research packaging, honesty rails, and fallbacks remain rule-based unless those steps succeed.
          </p>
        ) : null}
      </section>

      <section className="brief-section">
        <h2 className="brief-h2">Reference seeds (optional)</h2>
        <label className="field">
          <span className="label">Source URLs</span>
          <textarea
            className="input textarea"
            rows={3}
            value={value.source_inputs_text}
            onChange={(e) => patch(onChange, "source_inputs_text", e.target.value)}
            disabled={disabled}
            placeholder={"One URL per line. Clear the field to remove reference seeds on save."}
          />
        </label>
      </section>
    </div>
  );
}
