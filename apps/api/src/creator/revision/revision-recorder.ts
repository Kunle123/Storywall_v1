import type {
  ChangedObjectType,
  EventDraft,
  Prisma,
  RevisionType,
  SectionDraft,
  SourceRecord,
  StoryDraft,
} from "@prisma/client";

const SNAPSHOT_V = 1 as const;

export type StoryDraftRecoverySnapshot = {
  v: typeof SNAPSHOT_V;
  kind: "story_draft";
  prior: {
    title: string;
    subtitle: string | null;
    summary: string;
    lens: string;
    conclusion: string | null;
    last_edited_at: string;
  };
};

export type SectionRecoverySnapshot = {
  v: typeof SNAPSHOT_V;
  kind: "section_draft";
  section_id: string;
  prior: {
    label: string;
    summary: string | null;
    updated_at: string;
  };
};

export type EventRecoverySnapshot = {
  v: typeof SNAPSHOT_V;
  kind: "event_draft";
  event_id: string;
  prior: {
    headline: string;
    summary: string;
    dek: string | null;
    creator_note: string | null;
    updated_at: string;
  };
};

export type SourceRecoverySnapshot = {
  v: typeof SNAPSHOT_V;
  kind: "source_record";
  event_id: string;
  source_id: string;
  prior: {
    source_url: string;
    source_title: string;
    publisher_name: string;
    relevance_note: string;
    excerpt: string | null;
    published_at: string | null;
    updated_at: string;
  };
};

export type RecoverySnapshotPayload =
  | StoryDraftRecoverySnapshot
  | SectionRecoverySnapshot
  | EventRecoverySnapshot
  | SourceRecoverySnapshot;

export async function insertRevisionEntry(
  tx: Prisma.TransactionClient,
  input: {
    storyDraftId: string;
    revisionType: RevisionType;
    changedObjectType: ChangedObjectType;
    changedObjectId: string;
    changeSummary: string;
    isMaterialPublicChange: boolean;
    createdBy: string;
    recoverySnapshot?: Prisma.InputJsonValue | null;
  },
): Promise<string> {
  const row = await tx.revisionEntry.create({
    data: {
      storyDraftId: input.storyDraftId,
      revisionType: input.revisionType,
      changedObjectType: input.changedObjectType,
      changedObjectId: input.changedObjectId,
      changeSummary: input.changeSummary,
      isMaterialPublicChange: input.isMaterialPublicChange,
      createdBy: input.createdBy,
      recoverySnapshot: input.recoverySnapshot ?? undefined,
    },
  });
  await tx.storyDraft.update({
    where: { id: input.storyDraftId },
    data: { revisionCount: { increment: 1 } },
  });
  return row.id;
}

export function buildStoryDraftRecoverySnapshot(draft: StoryDraft): StoryDraftRecoverySnapshot {
  return {
    v: SNAPSHOT_V,
    kind: "story_draft",
    prior: {
      title: draft.title,
      subtitle: draft.subtitle,
      summary: draft.summary,
      lens: draft.lens,
      conclusion: draft.conclusion,
      last_edited_at: draft.lastEditedAt.toISOString(),
    },
  };
}

export function buildSectionRecoverySnapshot(section: SectionDraft): SectionRecoverySnapshot {
  return {
    v: SNAPSHOT_V,
    kind: "section_draft",
    section_id: section.id,
    prior: {
      label: section.label,
      summary: section.summary,
      updated_at: section.updatedAt.toISOString(),
    },
  };
}

export function buildEventRecoverySnapshot(ev: EventDraft): EventRecoverySnapshot {
  return {
    v: SNAPSHOT_V,
    kind: "event_draft",
    event_id: ev.id,
    prior: {
      headline: ev.headline,
      summary: ev.summary,
      dek: ev.dek,
      creator_note: ev.creatorNote,
      updated_at: ev.updatedAt.toISOString(),
    },
  };
}

export function buildSourceRecoverySnapshot(
  eventId: string,
  src: SourceRecord,
): SourceRecoverySnapshot {
  return {
    v: SNAPSHOT_V,
    kind: "source_record",
    event_id: eventId,
    source_id: src.id,
    prior: {
      source_url: src.sourceUrl,
      source_title: src.sourceTitle,
      publisher_name: src.publisherName,
      relevance_note: src.relevanceNote,
      excerpt: src.excerpt,
      published_at: src.publishedAt ? src.publishedAt.toISOString() : null,
      updated_at: src.updatedAt.toISOString(),
    },
  };
}

export function summarizeStoryPatchFields(dto: Record<string, unknown>): string {
  const keys = Object.keys(dto).filter((k) => dto[k] !== undefined);
  return keys.length > 0 ? keys.join(", ") : "story draft";
}

export function isMaterialStoryPatch(dto: { title?: string; summary?: string; lens?: string }): boolean {
  return dto.title !== undefined || dto.summary !== undefined || dto.lens !== undefined;
}
