/**
 * M2-T05 — materialize `event_draft` + `source_record` from chronology staging (mutation §11.2).
 */
import type { ChronologyExtractedEvent, Prisma } from "@prisma/client";

function eventDraftDataFromChronology(
  ce: ChronologyExtractedEvent,
  storyDraftId: string,
  assemblyJobId: string,
): Prisma.EventDraftUncheckedCreateInput {
  return {
    storyDraftId,
    headline: ce.headline,
    summary: ce.summary,
    creatorNote: ce.creatorNote,
    eventType: ce.eventType,
    contextLabel: ce.contextLabel,
    significanceLevel: ce.significanceLevel,
    eventDateStart: ce.eventDateStart,
    eventDateEnd: ce.eventDateEnd,
    eventDatePrecision: ce.eventDatePrecision,
    displayDate: ce.displayDate,
    yearAnchor: ce.yearAnchor,
    positionIndex: ce.positionIndex,
    intervalNote: ce.intervalNote,
    locationName: ce.locationName,
    mediaKind: ce.mediaKind,
    sourceCount: 0,
    sourceDensity: ce.sourceDensity,
    confidenceState: ce.confidenceState,
    claimRiskLevel: ce.claimRiskLevel,
    moderationStatus: "pending",
    isShareable: false,
    isPinned: false,
    isFeaturedInSummary: false,
    generationMode: "ai_draft",
    generationRunId: assemblyJobId,
    editorialReviewStatus: "unreviewed",
    status: "draft",
    slug: null,
    dek: null,
    sectionDraftId: null,
    mediaPrimaryCandidateId: null,
  };
}

export async function runDraftAssemblyJob(
  tx: Prisma.TransactionClient,
  draftAssemblyJobId: string,
): Promise<void> {
  const job = await tx.draftAssemblyJob.findUnique({
    where: { id: draftAssemblyJobId },
    include: {
      story: {
        include: {
          storyBrief: { include: { storyDraft: true } },
        },
      },
    },
  });
  if (!job) {
    return;
  }
  if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
    return;
  }

  const draftJob = job;

  const wfDuring = draftJob.story.workflowState;
  const restoreState = draftJob.preAssemblyWorkflowState;
  const successState = "ready_for_edit" as const;

  if (draftJob.status === "pending") {
    await tx.draftAssemblyJob.update({
      where: { id: draftAssemblyJobId },
      data: { status: "running", startedAt: new Date() },
    });
  }

  const storyDraft = draftJob.story.storyBrief?.storyDraft;
  const sourceRid = draftJob.sourceResearchJobId;

  async function failJob(message: string): Promise<void> {
    await tx.draftAssemblyJob.update({
      where: { id: draftAssemblyJobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await tx.story.update({
      where: { id: draftJob.storyId },
      data: { workflowState: restoreState },
    });
    const afterFail = await tx.story.findUniqueOrThrow({
      where: { id: draftJob.storyId },
      select: { workflowState: true },
    });
    if (wfDuring !== afterFail.workflowState) {
      await tx.storyWorkflowTransition.create({
        data: {
          storyId: draftJob.storyId,
          fromWorkflowState: wfDuring,
          toWorkflowState: afterFail.workflowState,
          actorType: "system",
          actorId: null,
          trigger: "draft_assembly_failed",
        },
      });
    }
  }

  if (!storyDraft || !sourceRid) {
    await failJob("Missing story draft or source research job reference");
    return;
  }

  const research = await tx.researchJob.findUnique({
    where: { id: sourceRid },
    include: {
      chronologyAssembly: {
        include: {
          events: {
            orderBy: { positionIndex: "asc" },
            include: {
              sourceLinks: {
                orderBy: { orderingIndex: "asc" },
                include: { researchCandidateSource: true },
              },
            },
          },
        },
      },
    },
  });

  const events = research?.chronologyAssembly?.events;
  if (!events || events.length === 0) {
    await failJob("Chronology data is missing or empty for the source research job");
    return;
  }

  await tx.eventDraft.deleteMany({ where: { storyDraftId: storyDraft.id } });

  for (const ce of events) {
    const ed = await tx.eventDraft.create({
      data: eventDraftDataFromChronology(ce, storyDraft.id, draftJob.id),
    });

    let srcCount = 0;
    for (const link of ce.sourceLinks) {
      const cand = link.researchCandidateSource;
      await tx.sourceRecord.create({
        data: {
          eventDraftId: ed.id,
          sourceUrl: cand.sourceUrl,
          sourceTitle: cand.sourceTitle,
          publisherName: cand.publisherName,
          sourceType: cand.sourceType,
          publishedAt: cand.publishedAt,
          excerpt: cand.excerpt,
          relevanceNote: `[${link.relationKind}] ${cand.relevanceNote}`,
          reliabilityTier: cand.reliabilityTier,
          verificationStatus: "unreviewed",
          isPrimary: link.orderingIndex === 0,
          isPublic: true,
          duplicateSignal: false,
          extractionMethod: "ai_extracted",
          addedBy: draftJob.creatorId,
          status: "draft",
        },
      });
      srcCount += 1;
    }

    await tx.eventDraft.update({
      where: { id: ed.id },
      data: { sourceCount: srcCount },
    });
  }

  await tx.storyDraft.update({
    where: { id: storyDraft.id },
    data: {
      generationRunId: draftJob.id,
      lastEditedBy: draftJob.creatorId,
    },
  });

  await tx.draftAssemblyJob.update({
    where: { id: draftAssemblyJobId },
    data: { status: "succeeded", finishedAt: new Date() },
  });

  await tx.story.update({
    where: { id: draftJob.storyId },
    data: { workflowState: successState },
  });

  const after = await tx.story.findUniqueOrThrow({
    where: { id: draftJob.storyId },
    select: { workflowState: true },
  });

  if (wfDuring !== after.workflowState) {
    await tx.storyWorkflowTransition.create({
      data: {
        storyId: draftJob.storyId,
        fromWorkflowState: wfDuring,
        toWorkflowState: after.workflowState,
        actorType: "system",
        actorId: null,
        trigger: "draft_assembly_complete",
      },
    });
  }
}
