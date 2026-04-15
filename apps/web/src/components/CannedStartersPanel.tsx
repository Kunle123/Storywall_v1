import { useState } from "react";
import type { BriefFormValues } from "../lib/briefFormModel";
import {
  CANNED_STARTER_GROUPS,
  applyCannedStarter,
  getStarterById,
  type CannedStarterId,
} from "../lib/cannedStarters";

export function CannedStartersPanel({
  value,
  onChange,
  disabled,
}: {
  value: BriefFormValues;
  onChange: (p: Partial<BriefFormValues>) => void;
  disabled?: boolean;
}) {
  const [blocked, setBlocked] = useState<string | null>(null);

  function apply(id: CannedStarterId) {
    const starter = getStarterById(id);
    if (!starter) return;
    const { patch, blocked: b } = applyCannedStarter(starter, value);
    if (b) {
      setBlocked(b);
      return;
    }
    setBlocked(null);
    onChange(patch);
  }

  const showVagueHint = Boolean(value.subject.trim()) && !value.research_brief.trim();

  return (
    <section className="brief-section starters-section" aria-labelledby="starters-heading">
      <h2 id="starters-heading" className="brief-h2">
        Canned starters
      </h2>
      <p className="hint starters-lead">
        Quick-start sentence patterns from the Storywall workflow spec. They set <strong>story type</strong>,{" "}
        <strong>subject type</strong>, and fill empty <strong>research brief</strong> / <strong>desired angle</strong>{" "}
        fields. You can edit everything afterward; autosave is unchanged.
      </p>
      {showVagueHint ? (
        <p className="hint starters-vague" role="status">
          Subject is set but the research brief is still empty — try a starter below or write your own (workflow spec §6).
        </p>
      ) : null}
      {CANNED_STARTER_GROUPS.map((group) => (
        <div key={group.title} className="starter-group">
          <h3 className="starter-group-title">{group.title}</h3>
          <div className="starter-chips" role="group" aria-label={`Starters for ${group.title}`}>
            {group.ids.map((id) => {
              const def = getStarterById(id);
              if (!def) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="starter-chip"
                  disabled={disabled}
                  onClick={() => apply(id)}
                  aria-label={`Apply starter: ${def.shortLabel}`}
                >
                  {def.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {blocked ? (
        <p className="banner warn starters-blocked" role="alert">
          {blocked}
        </p>
      ) : null}
    </section>
  );
}
