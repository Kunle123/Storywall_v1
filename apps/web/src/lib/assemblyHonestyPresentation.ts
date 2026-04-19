/**
 * Split assembly-appended honesty blocks for presentation.
 * Delimiters match worker `draft-assembly-arc-plan` (`formatThinHonestyBlock`, `buildFirstPassConclusion`).
 */

const SECTION_RESEARCH_DEPTH_DELIM = "\n\n---\nResearch depth note";

const CONCLUSION_EDITORIAL_READINESS_DELIM = "\n\n---\nEditorial readiness:";

export function splitSectionSummaryForPresentation(text: string | null | undefined): {
  body: string;
  researchDepthNote: string | null;
} {
  const t = text ?? "";
  const i = t.indexOf(SECTION_RESEARCH_DEPTH_DELIM);
  if (i === -1) return { body: t, researchDepthNote: null };
  return {
    body: t.slice(0, i).trimEnd(),
    researchDepthNote: t.slice(i + 2).trim(),
  };
}

export function splitConclusionForPresentation(text: string | null | undefined): {
  body: string;
  editorialReadiness: string | null;
} {
  const t = text ?? "";
  const i = t.indexOf(CONCLUSION_EDITORIAL_READINESS_DELIM);
  if (i === -1) return { body: t, editorialReadiness: null };
  return {
    body: t.slice(0, i).trimEnd(),
    editorialReadiness: t.slice(i + 2).trim(),
  };
}
