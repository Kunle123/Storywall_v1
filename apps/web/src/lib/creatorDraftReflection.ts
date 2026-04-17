import type { EventDraftResponse, SectionDraftResponse, StoryDraftResponse } from "../api/types";

/** Deterministic reflection row — no scores, only plain-language gaps tied to draft fields. */
export type CreatorDraftReflectionItem = {
  id: string;
  title: string;
  detail: string;
};

function eventMaterial(ev: EventDraftResponse): number {
  let s = (ev.summary ?? "").trim().length;
  if ((ev.dek ?? "").trim()) s += 45;
  if ((ev.context_label ?? "").trim()) s += 35;
  if ((ev.location_name ?? "").trim()) s += 20;
  return s;
}

function isBareBeat(ev: EventDraftResponse): boolean {
  const sumLen = (ev.summary ?? "").trim().length;
  const hasFraming = Boolean((ev.dek ?? "").trim() || (ev.context_label ?? "").trim());
  return !hasFraming && sumLen < 140;
}

const readerPreviewItem: CreatorDraftReflectionItem = {
  id: "reader-preview",
  title: "Use the reader preview as the honest rehearsal",
  detail:
    "Scroll the reader-faithful frame in this tab: it mirrors the same composition readers get (overview, lens, sections, timeline emphasis, sources, closing). If it feels flat there, strengthen framing and contrast before publish — not just field completeness.",
};

/**
 * Build at most `maxItems` honest pre-publish reflection bullets from the current draft rows.
 * Intended to nudge richer public reading — not validation, not importance rankings.
 */
export function buildCreatorDraftReflection(params: {
  draft: StoryDraftResponse;
  sections: SectionDraftResponse[];
  events: EventDraftResponse[];
  maxItems?: number;
}): { items: CreatorDraftReflectionItem[]; needsAttention: boolean } {
  const { draft, sections, events } = params;
  const maxItems = params.maxItems ?? 5;
  const gapBudget = Math.max(0, maxItems - 1);
  const gaps: CreatorDraftReflectionItem[] = [];

  const nEvents = events.length;
  const nSections = sections.length;
  const missingWhen = events.filter((e) => !(e.display_date ?? "").trim()).length;
  const hasClosing = Boolean((draft.conclusion ?? "").trim());

  const ordered = [...events].sort(
    (a, b) => a.position_index - b.position_index || a.id.localeCompare(b.id),
  );
  const scores = ordered.map(eventMaterial);
  const maxS = scores.length ? Math.max(...scores) : 0;
  const minS = scores.length ? Math.min(...scores) : 0;
  const spread = maxS - minS;

  const bareCount = ordered.filter(isBareBeat).length;
  const bareRatio = nEvents > 0 ? bareCount / nEvents : 0;

  const sectionsThinSummary = sections.filter((s) => !(s.summary ?? "").trim()).length;
  const sectionThinRatio = nSections > 0 ? sectionsThinSummary / nSections : 0;

  const pushGap = (row: CreatorDraftReflectionItem) => {
    if (gaps.length >= gapBudget) return;
    if (gaps.some((x) => x.id === row.id)) return;
    gaps.push(row);
  };

  if (nEvents <= 2 && nEvents > 0) {
    pushGap({
      id: "few-events",
      title: "Timeline is very short for a chronology-led Storywall",
      detail:
        "Readers mostly experience this story through dated beats. A handful of rows often reads as a sketch, not a shaped arc — add more dated beats where your sources support them, then tighten how they build toward your closing.",
    });
  }

  if (nEvents > 0 && missingWhen > 0) {
    const heavy = missingWhen >= Math.max(2, Math.ceil(nEvents * 0.35));
    if (heavy) {
      pushGap({
        id: "missing-dates",
        title: "Many beats still lack a reader-visible “when” line",
        detail:
          "The public reader stacks dates at the top of each row. Missing dates make the chronology harder to scan and weaken the sense of movement — fill display dates wherever you can stand behind them.",
      });
    }
  }

  if (nEvents >= 3 && bareRatio >= 0.45) {
    pushGap({
      id: "bare-beats",
      title: "Several timeline rows read as thin facts on the page",
      detail:
        "Rows without a short dek or context label, or with very little body text, tend to look interchangeable in the reader preview. Add framing on the beats that matter most so contrast shows up in the public layout.",
    });
  }

  if (nEvents >= 5 && maxS > 100 && spread / maxS < 0.22) {
    pushGap({
      id: "even-pacing",
      title: "Timeline rows carry similar weight — the reader view may feel even",
      detail:
        "When every row has a similar amount of framing and body text, the published page can look like a steady list. That is honest to the draft, but often weaker editorially — deepen a few pivotal beats and let supporting rows stay lighter.",
    });
  }

  if (nSections >= 2 && sectionThinRatio >= 0.5) {
    pushGap({
      id: "thin-sections",
      title: "Several narrative sections lack summaries",
      detail:
        "Section summaries are what readers see as signposts between the overview and the timeline. Empty summaries make the arc harder to follow — draft one or two sentences per section when you are ready.",
    });
  }

  if (nSections <= 1 && nEvents >= 4) {
    pushGap({
      id: "few-sections",
      title: "Few narrative sections for a long timeline",
      detail:
        "With many dated beats but only one (or no) narrative section, the reader preview jumps quickly into chronology. Consider more sections if you want clearer pacing between blocks of time.",
    });
  }

  if (!hasClosing && nEvents >= 3) {
    pushGap({
      id: "no-closing",
      title: "Closing synthesis is still empty",
      detail:
        "The reader page ends with a closing block when you add one. A short synthesis after a dense timeline usually helps readers understand why the chronology mattered — and checks often expect it.",
    });
  }

  const items = [...gaps, readerPreviewItem].slice(0, maxItems);
  const needsAttention = gaps.length > 0;

  return { items, needsAttention };
}
