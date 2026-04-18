/**
 * M2-T02: deterministic stub payload for research artifact + candidate sources until
 * real retrieval is wired. Keeps structured, reviewable rows for the research job.
 */
import type { Prisma } from "@prisma/client";

export type ResearchJobWithStoryBrief = {
  id: string;
  storyId: string;
  story: {
    id: string;
    title: string;
    summary: string;
    storyBrief: null | {
      subject: string;
      normalizedSubject: string | null;
      researchBrief: string;
      desiredAngle: string;
    };
  };
};

export function buildM2T02PersistPayload(
  rj: ResearchJobWithStoryBrief,
): {
  evidencePackageSummary: string;
  candidateEventHints: Prisma.InputJsonValue;
  riskFlags: Prisma.InputJsonValue;
  confidencePosture: string;
  candidateSources: Prisma.ResearchCandidateSourceCreateManyInput[];
} {
  const story = rj.story;
  const brief = story.storyBrief;
  const subjectLine =
    brief?.normalizedSubject?.trim() ||
    brief?.subject?.trim().slice(0, 200) ||
    story.title;

  const evidencePackageSummary = [
    `Stub research package for job ${rj.id} (M2-T02).`,
    `Story: ${story.title}`,
    brief
      ? `Research brief excerpt: ${brief.researchBrief.slice(0, 400)}${brief.researchBrief.length > 400 ? "…" : ""}`
      : "No story brief row present.",
  ].join("\n");

  const candidateEventHints: Prisma.InputJsonValue = [
    {
      label: "timeline_anchor",
      detail: `Focus initial chronology on ${subjectLine}`,
    },
    {
      label: "open_questions",
      detail: "Verify primary dates against at least two independent references.",
    },
  ];

  const riskFlags: Prisma.InputJsonValue = [
    {
      code: "stub_data",
      severity: "low",
      detail: "Artifact populated by worker stub until deep research is wired.",
    },
  ];

  const baseUrl = "https://example.invalid/storywall-research";
  const sid = story.id;

  const candidateSources: Prisma.ResearchCandidateSourceCreateManyInput[] = [
    {
      researchJobId: rj.id,
      storyId: sid,
      sourceUrl: `${baseUrl}/candidates/${sid}/0`,
      sourceTitle: `${story.title} — background overview`,
      publisherName: "Storywall Research (stub)",
      sourceType: "article",
      publishedAt: null,
      excerpt: story.summary ? story.summary.slice(0, 500) : null,
      relevanceNote:
        "Seeded candidate for review; replace with real retrieval results in a later milestone.",
      reliabilityTier: "unrated",
      positionIndex: 0,
      extractionMethod: "ai_extracted",
    },
    {
      researchJobId: rj.id,
      storyId: sid,
      sourceUrl: `${baseUrl}/candidates/${sid}/1`,
      sourceTitle: `${subjectLine} — supplementary context`,
      publisherName: "Storywall Research (stub)",
      sourceType: "document",
      publishedAt: null,
      excerpt: brief ? brief.desiredAngle.slice(0, 400) : null,
      relevanceNote: "Candidate aligned to framing / desired angle from the brief.",
      reliabilityTier: "medium",
      positionIndex: 1,
      extractionMethod: "ai_extracted",
    },
    {
      researchJobId: rj.id,
      storyId: sid,
      sourceUrl: `${baseUrl}/candidates/${sid}/2`,
      sourceTitle: `${subjectLine} — chronology anchor note`,
      publisherName: "Storywall Research (stub)",
      sourceType: "article",
      publishedAt: null,
      excerpt: brief ? brief.researchBrief.slice(0, 450) : null,
      relevanceNote: "M5-T23 — extra stub row so synthesis has more than two sourced_claim anchors when live retrieval is off.",
      reliabilityTier: "medium",
      positionIndex: 2,
      extractionMethod: "ai_extracted",
    },
    {
      researchJobId: rj.id,
      storyId: sid,
      sourceUrl: `${baseUrl}/candidates/${sid}/3`,
      sourceTitle: `${subjectLine} — angle contrast`,
      publisherName: "Storywall Research (stub)",
      sourceType: "document",
      publishedAt: null,
      excerpt: brief ? `${brief.desiredAngle.slice(0, 200)} · ${brief.researchBrief.slice(0, 200)}` : null,
      relevanceNote: "Fourth deterministic candidate for breadth; still not live-web-grounded.",
      reliabilityTier: "low",
      positionIndex: 3,
      extractionMethod: "ai_extracted",
    },
  ];

  return {
    evidencePackageSummary,
    candidateEventHints,
    riskFlags,
    confidencePosture: "mixed",
    candidateSources,
  };
}
