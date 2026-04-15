/**
 * M2-T04 — persist chronology_event_source_link rows (idempotent if links already exist).
 */
import type { Prisma } from "@prisma/client";
import { buildChronologyEventSourceLinkRows } from "@storywall/shared";

export async function ensureChronologyEventSourceLinks(
  tx: Prisma.TransactionClient,
  params: { researchJobId: string; storyId: string },
): Promise<void> {
  const { researchJobId, storyId } = params;

  const assembly = await tx.chronologyAssembly.findUnique({
    where: { researchJobId },
    include: { events: { orderBy: { positionIndex: "asc" } } },
  });
  if (!assembly || assembly.events.length === 0) {
    return;
  }

  const eventIds = assembly.events.map((e) => e.id);
  const existing = await tx.chronologyEventSourceLink.count({
    where: { chronologyExtractedEventId: { in: eventIds } },
  });
  if (existing > 0) {
    return;
  }

  const sources = await tx.researchCandidateSource.findMany({
    where: { researchJobId },
    orderBy: { positionIndex: "asc" },
  });

  const sourceById = new Map(
    sources.map((s) => [
      s.id,
      {
        id: s.id,
        reliabilityTier: s.reliabilityTier,
        relevanceNote: s.relevanceNote,
      },
    ]),
  );

  const allRows: Prisma.ChronologyEventSourceLinkCreateManyInput[] = [];

  for (const ev of assembly.events) {
    const raw = ev.supportingCandidateSourceIds;
    const ids: string[] = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];

    const rows = buildChronologyEventSourceLinkRows({
      chronologyExtractedEventId: ev.id,
      storyId,
      researchJobId,
      candidateSourceIds: ids,
      sourceById,
    });
    for (const r of rows) {
      allRows.push({
        chronologyExtractedEventId: r.chronologyExtractedEventId,
        researchCandidateSourceId: r.researchCandidateSourceId,
        storyId: r.storyId,
        researchJobId: r.researchJobId,
        relationKind: r.relationKind,
        countsTowardSufficiency: r.countsTowardSufficiency,
        orderingIndex: r.orderingIndex,
        rationaleNote: r.rationaleNote,
      });
    }
  }

  if (allRows.length > 0) {
    await tx.chronologyEventSourceLink.createMany({ data: allRows });
  }
}
