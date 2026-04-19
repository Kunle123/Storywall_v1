/**
 * M2-T05 — materialize `event_draft` + `source_record` from chronology staging (mutation §11.2).
 * M2-T12 — scoped regeneration for one event or one section (workflow spec regeneration rules).
 */
import type {
  ChangedObjectType,
  ChronologyExtractedEvent,
  CreatorWorkflowState,
  Prisma,
} from "@prisma/client";

/** Chronology row as loaded for draft assembly (includes source link edges). */
type ChronologyEventWithLinks = Prisma.ChronologyExtractedEventGetPayload<{
  include: {
    sourceLinks: { orderBy: { orderingIndex: "asc" }; include: { researchCandidateSource: true } };
  };
}>;

function eventDraftDataFromChronology(
  ce: ChronologyExtractedEvent,
  storyDraftId: string,
  assemblyJobId: string,
  sectionDraftId: string | null,
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
    sectionDraftId,
    mediaPrimaryCandidateId: null,
  };
}

type StoryDraftForAssembly = {
  id: string;
  title: string;
  summary: string | null;
  selectedFrame: { titleCandidate: string; summaryCandidate: string } | null;
};

/**
 * Ensures at least one narrative `section_draft` exists and returns the id to attach assembled
 * chronology rows. Copy is grounded in the existing story draft / selected framing (no new factual claims).
 */
async function resolveSpineSectionIdForFullAssembly(
  tx: Prisma.TransactionClient,
  storyDraft: StoryDraftForAssembly,
): Promise<string | null> {
  const existing = await tx.sectionDraft.findFirst({
    where: { storyDraftId: storyDraft.id },
    orderBy: { positionIndex: "asc" },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const labelBase =
    storyDraft.title.trim() ||
    storyDraft.selectedFrame?.titleCandidate?.trim() ||
    "Narrative spine";
  const label = labelBase.slice(0, 200);

  const framingSummary = storyDraft.selectedFrame?.summaryCandidate?.trim() ?? "";
  const draftSummary = storyDraft.summary?.trim() ?? "";
  const baseBody =
    draftSummary.length > 0
      ? draftSummary.slice(0, 4000)
      : framingSummary.length > 0
        ? framingSummary.slice(0, 4000)
        : null;

  const guidance =
    "This section groups the timeline rows materialized from your latest successful research pass. Edit freely; evidence stays on each event.";
  const summary =
    baseBody && baseBody.length > 0 ? `${baseBody}\n\n${guidance}`.slice(0, 8000) : guidance;

  const created = await tx.sectionDraft.create({
    data: {
      storyDraftId: storyDraft.id,
      label,
      summary,
      positionIndex: 0,
      sectionOrigin: "ai_generated",
      status: "draft",
    },
  });
  return created.id;
}

function chronologyToEventUpdateData(
  ce: ChronologyEventWithLinks,
  assemblyJobId: string,
  preserveCreatorNotes: boolean,
  existingCreatorNote: string | null,
): Prisma.EventDraftUpdateInput {
  const base: Prisma.EventDraftUpdateInput = {
    headline: ce.headline,
    summary: ce.summary,
    eventType: ce.eventType,
    contextLabel: ce.contextLabel,
    significanceLevel: ce.significanceLevel,
    eventDateStart: ce.eventDateStart,
    eventDateEnd: ce.eventDateEnd,
    eventDatePrecision: ce.eventDatePrecision,
    displayDate: ce.displayDate,
    yearAnchor: ce.yearAnchor,
    intervalNote: ce.intervalNote,
    locationName: ce.locationName,
    mediaKind: ce.mediaKind,
    sourceDensity: ce.sourceDensity,
    confidenceState: ce.confidenceState,
    claimRiskLevel: ce.claimRiskLevel,
    generationMode: "ai_draft",
    generationRunId: assemblyJobId,
    editorialReviewStatus: "unreviewed",
  };
  if (preserveCreatorNotes) {
    base.creatorNote = existingCreatorNote;
  } else {
    base.creatorNote = ce.creatorNote;
  }
  return base;
}

type AssemblePayload = {
  mode: string;
  preserve_creator_notes: boolean;
  preserve_manual_event_positions: boolean;
  preserve_approved_images: boolean;
  scoped_event_id: string | null;
  scoped_section_id: string | null;
};

async function recordAssemblyRevision(
  tx: Prisma.TransactionClient,
  p: {
    storyDraftId: string;
    changedObjectType: ChangedObjectType;
    changedObjectId: string;
    changeSummary: string;
    createdBy: string;
    recoverySnapshot?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.revisionEntry.create({
    data: {
      storyDraftId: p.storyDraftId,
      revisionType: "ai_regeneration",
      changedObjectType: p.changedObjectType,
      changedObjectId: p.changedObjectId,
      changeSummary: p.changeSummary,
      isMaterialPublicChange: true,
      createdBy: p.createdBy,
      recoverySnapshot: p.recoverySnapshot ?? undefined,
    },
  });
  await tx.storyDraft.update({
    where: { id: p.storyDraftId },
    data: { revisionCount: { increment: 1 } },
  });
}

function parseAssemblePayload(raw: Prisma.JsonValue): AssemblePayload | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  return {
    mode: String(o.mode ?? ""),
    preserve_creator_notes: Boolean(o.preserve_creator_notes),
    preserve_manual_event_positions: Boolean(o.preserve_manual_event_positions),
    preserve_approved_images: Boolean(o.preserve_approved_images),
    scoped_event_id: typeof o.scoped_event_id === "string" ? o.scoped_event_id : null,
    scoped_section_id: typeof o.scoped_section_id === "string" ? o.scoped_section_id : null,
  };
}

async function recreateSourcesForChronologyEvent(
  tx: Prisma.TransactionClient,
  eventDraftId: string,
  ce: ChronologyEventWithLinks,
  creatorId: string,
): Promise<number> {
  await tx.sourceRecord.deleteMany({ where: { eventDraftId } });
  let srcCount = 0;
  for (const link of ce.sourceLinks) {
    const cand = link.researchCandidateSource;
    await tx.sourceRecord.create({
      data: {
        eventDraftId,
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
        addedBy: creatorId,
        status: "draft",
      },
    });
    srcCount += 1;
  }
  return srcCount;
}

async function finalizeAssemblySuccess(
  tx: Prisma.TransactionClient,
  params: {
    draftAssemblyJobId: string;
    storyId: string;
    storyDraftId: string;
    creatorId: string;
    wfDuring: CreatorWorkflowState;
  },
): Promise<void> {
  const { draftAssemblyJobId, storyId, storyDraftId, creatorId, wfDuring } = params;
  const successState = "ready_for_edit" as const;

  await tx.storyDraft.update({
    where: { id: storyDraftId },
    data: {
      generationRunId: draftAssemblyJobId,
      lastEditedBy: creatorId,
    },
  });

  await tx.draftAssemblyJob.update({
    where: { id: draftAssemblyJobId },
    data: { status: "succeeded", finishedAt: new Date() },
  });

  await tx.story.update({
    where: { id: storyId },
    data: { workflowState: successState },
  });

  const after = await tx.story.findUniqueOrThrow({
    where: { id: storyId },
    select: { workflowState: true },
  });

  if (wfDuring !== after.workflowState) {
    await tx.storyWorkflowTransition.create({
      data: {
        storyId,
        fromWorkflowState: wfDuring,
        toWorkflowState: after.workflowState,
        actorType: "system",
        actorId: null,
        trigger: "draft_assembly_complete",
      },
    });
  }
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
          storyBrief: {
            include: {
              storyDraft: {
                include: {
                  selectedFrame: true,
                },
              },
            },
          },
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

  if (!storyDraft) {
    await failJob("Missing story draft");
    return;
  }

  const payload = parseAssemblePayload(draftJob.requestPayload);
  if (!payload) {
    await failJob("Invalid draft assembly request payload");
    return;
  }

  if (payload.mode === "scoped_section_regeneration") {
    if (!payload.scoped_section_id) {
      await failJob("scoped_section_regeneration requires scoped_section_id in payload");
      return;
    }
    const frame = storyDraft.selectedFrame;
    const rawCandidates = frame?.sectionCandidates;
    const candidates = Array.isArray(rawCandidates) ? rawCandidates : null;
    const section = await tx.sectionDraft.findFirst({
      where: { id: payload.scoped_section_id, storyDraftId: storyDraft.id },
    });
    if (!section) {
      await failJob("Section not found for scoped regeneration");
      return;
    }
    const cand = candidates?.[section.positionIndex];
    if (!cand || typeof cand !== "object" || cand === null) {
      await failJob(
        "No framing section candidate for this section index; cannot regenerate from the selected frame",
      );
      return;
    }
    const c = cand as Record<string, unknown>;
    const label = typeof c.label === "string" && c.label.trim().length > 0 ? c.label : section.label;
    const summary =
      typeof c.summary === "string" ? c.summary : c.summary === null ? null : section.summary;

    const sectionRecoverySnapshot: Prisma.InputJsonValue = {
      v: 1,
      kind: "section_draft",
      section_id: section.id,
      prior: {
        label: section.label,
        summary: section.summary,
        updated_at: section.updatedAt.toISOString(),
      },
    };

    await tx.sectionDraft.update({
      where: { id: section.id },
      data: {
        label,
        summary,
        sectionOrigin: "ai_generated",
      },
    });

    await recordAssemblyRevision(tx, {
      storyDraftId: storyDraft.id,
      changedObjectType: "section",
      changedObjectId: section.id,
      changeSummary: "Scoped section regeneration from framing candidate",
      createdBy: draftJob.creatorId,
      recoverySnapshot: sectionRecoverySnapshot,
    });

    await finalizeAssemblySuccess(tx, {
      draftAssemblyJobId,
      storyId: draftJob.storyId,
      storyDraftId: storyDraft.id,
      creatorId: draftJob.creatorId,
      wfDuring,
    });
    return;
  }

  if (!sourceRid) {
    await failJob("Missing source research job reference");
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

  const chronologyEvents = research?.chronologyAssembly?.events;
  if (!chronologyEvents || chronologyEvents.length === 0) {
    await failJob("Chronology data is missing or empty for the source research job");
    return;
  }

  if (payload.mode === "scoped_event_regeneration") {
    if (!payload.scoped_event_id) {
      await failJob("scoped_event_regeneration requires scoped_event_id in payload");
      return;
    }

    const eventDraft = await tx.eventDraft.findFirst({
      where: { id: payload.scoped_event_id, storyDraftId: storyDraft.id },
    });
    if (!eventDraft) {
      await failJob("Event not found for scoped regeneration");
      return;
    }

    const ce = chronologyEvents.find((e) => e.positionIndex === eventDraft.positionIndex) as
      | ChronologyEventWithLinks
      | undefined;
    if (!ce) {
      await failJob(
        "No chronology event matches this draft event position; scoped regeneration only applies to research-derived positions",
      );
      return;
    }

    const updateData = chronologyToEventUpdateData(
      ce,
      draftJob.id,
      payload.preserve_creator_notes,
      eventDraft.creatorNote,
    );

    const eventRecoverySnapshot: Prisma.InputJsonValue = {
      v: 1,
      kind: "event_draft",
      event_id: eventDraft.id,
      prior: {
        headline: eventDraft.headline,
        summary: eventDraft.summary,
        dek: eventDraft.dek,
        creator_note: eventDraft.creatorNote,
        updated_at: eventDraft.updatedAt.toISOString(),
      },
    };

    await tx.eventDraft.update({
      where: { id: eventDraft.id },
      data: updateData,
    });

    const srcCount = await recreateSourcesForChronologyEvent(tx, eventDraft.id, ce, draftJob.creatorId);

    await tx.eventDraft.update({
      where: { id: eventDraft.id },
      data: { sourceCount: srcCount },
    });

    await recordAssemblyRevision(tx, {
      storyDraftId: storyDraft.id,
      changedObjectType: "event",
      changedObjectId: eventDraft.id,
      changeSummary: "Scoped event regeneration from research chronology",
      createdBy: draftJob.creatorId,
      recoverySnapshot: eventRecoverySnapshot,
    });

    await finalizeAssemblySuccess(tx, {
      draftAssemblyJobId,
      storyId: draftJob.storyId,
      storyDraftId: storyDraft.id,
      creatorId: draftJob.creatorId,
      wfDuring,
    });
    return;
  }

  if (payload.mode !== "full_regeneration") {
    await failJob(`Unsupported draft assembly mode: ${payload.mode}`);
    return;
  }

  await tx.eventDraft.deleteMany({ where: { storyDraftId: storyDraft.id } });

  const spineSectionId = await resolveSpineSectionIdForFullAssembly(tx, {
    id: storyDraft.id,
    title: storyDraft.title,
    summary: storyDraft.summary,
    selectedFrame: storyDraft.selectedFrame
      ? {
          titleCandidate: storyDraft.selectedFrame.titleCandidate,
          summaryCandidate: storyDraft.selectedFrame.summaryCandidate,
        }
      : null,
  });

  for (const ce of chronologyEvents as ChronologyEventWithLinks[]) {
    const ed = await tx.eventDraft.create({
      data: eventDraftDataFromChronology(ce, storyDraft.id, draftJob.id, spineSectionId),
    });

    const srcCount = await recreateSourcesForChronologyEvent(tx, ed.id, ce, draftJob.creatorId);

    await tx.eventDraft.update({
      where: { id: ed.id },
      data: { sourceCount: srcCount },
    });
  }

  await recordAssemblyRevision(tx, {
    storyDraftId: storyDraft.id,
    changedObjectType: "story",
    changedObjectId: storyDraft.id,
    changeSummary: "Full draft assembly from chronology",
    createdBy: draftJob.creatorId,
    recoverySnapshot: null,
  });

  await finalizeAssemblySuccess(tx, {
    draftAssemblyJobId,
    storyId: draftJob.storyId,
    storyDraftId: storyDraft.id,
    creatorId: draftJob.creatorId,
    wfDuring,
  });
}
