import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  insertRevisionEntry,
  type EventRecoverySnapshot,
  type RecoverySnapshotPayload,
  type SectionRecoverySnapshot,
  type SourceRecoverySnapshot,
  type StoryDraftRecoverySnapshot,
} from "./revision-recorder";
import { revisionEntryToApi } from "./revision-to-api";

function normalizeIfMatch(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

@Injectable()
export class RevisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRevisions(params: { storyId: string; creatorId: string }) {
    const { storyId, creatorId } = params;
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      include: {
        storyBrief: { include: { storyDraft: true } },
      },
    });
    if (!story?.storyBrief?.storyDraft) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Story or draft not found" },
      });
    }

    const rows = await this.prisma.revisionEntry.findMany({
      where: { storyDraftId: story.storyBrief.storyDraft.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      storyDraftId: story.storyBrief.storyDraft.id,
      storyState: story.workflowState,
      revisions: rows.map((r) => revisionEntryToApi(r)),
    };
  }

  async restoreRevision(params: {
    storyId: string;
    creatorId: string;
    revisionId: string;
    ifMatchRaw: string | undefined;
  }) {
    const { storyId, creatorId, revisionId, ifMatchRaw } = params;
    const versionToken = normalizeIfMatch(ifMatchRaw);
    if (!versionToken) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "If-Match header is required with the current object version (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: {
          storyBrief: { include: { storyDraft: true } },
        },
      });
      if (!story?.storyBrief?.storyDraft) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or draft not found" },
        });
      }

      const storyDraftId = story.storyBrief.storyDraft.id;

      const rev = await tx.revisionEntry.findFirst({
        where: { id: revisionId, storyDraftId },
      });
      if (!rev) {
        throw new NotFoundException({
          ok: false,
          error: { code: "revision_not_found", message: "Revision not found for this story" },
        });
      }

      const raw = rev.recoverySnapshot;
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "revision_not_restorable",
            message: "This revision has no recovery snapshot",
          },
        });
      }

      const snapshot = raw as RecoverySnapshotPayload;

      if (snapshot.v !== 1) {
        throw new BadRequestException({
          ok: false,
          error: { code: "revision_snapshot_unsupported", message: "Unsupported snapshot version" },
        });
      }

      await this.applyRecoverySnapshot(tx, {
        storyId,
        creatorId,
        storyDraftId,
        snapshot,
        versionToken,
      });

      const newRevId = await insertRevisionEntry(tx, {
        storyDraftId,
        revisionType: "manual_edit",
        changedObjectType:
          snapshot.kind === "story_draft"
            ? "story"
            : snapshot.kind === "section_draft"
              ? "section"
              : snapshot.kind === "event_draft"
                ? "event"
                : "source",
        changedObjectId:
          snapshot.kind === "story_draft"
            ? storyDraftId
            : snapshot.kind === "section_draft"
              ? snapshot.section_id
              : snapshot.kind === "event_draft"
                ? snapshot.event_id
                : snapshot.source_id,
        changeSummary: "Restored from revision history",
        isMaterialPublicChange: true,
        createdBy: creatorId,
        recoverySnapshot: null,
      });

      const newRev = await tx.revisionEntry.findUniqueOrThrow({ where: { id: newRevId } });
      const st = await tx.story.findUniqueOrThrow({
        where: { id: storyId },
        select: { workflowState: true },
      });

      return {
        restored_from_revision_id: rev.id,
        revision: revisionEntryToApi(newRev),
        story_state: st.workflowState,
      };
    });
  }

  private async applyRecoverySnapshot(
    tx: Prisma.TransactionClient,
    params: {
      storyId: string;
      creatorId: string;
      storyDraftId: string;
      snapshot: RecoverySnapshotPayload;
      versionToken: string;
    },
  ): Promise<void> {
    const { creatorId, storyDraftId, snapshot, versionToken } = params;

    if (snapshot.kind === "story_draft") {
      const s = snapshot as StoryDraftRecoverySnapshot;
      const draft = await tx.storyDraft.findUnique({ where: { id: storyDraftId } });
      if (!draft) {
        throw new NotFoundException({ ok: false, error: { code: "not_found", message: "Draft missing" } });
      }
      if (draft.lastEditedAt.toISOString() !== versionToken) {
        throw new ConflictException({
          ok: false,
          error: { code: "conflict", message: "Version mismatch — object changed since revision was saved" },
        });
      }
      const p = s.prior;
      await tx.storyDraft.update({
        where: { id: storyDraftId },
        data: {
          title: p.title,
          subtitle: p.subtitle,
          summary: p.summary,
          lens: p.lens,
          conclusion: p.conclusion,
          lastEditedBy: creatorId,
        },
      });
      return;
    }

    if (snapshot.kind === "section_draft") {
      const s = snapshot as SectionRecoverySnapshot;
      const sec = await tx.sectionDraft.findFirst({
        where: { id: s.section_id, storyDraftId },
      });
      if (!sec) {
        throw new NotFoundException({ ok: false, error: { code: "not_found", message: "Section missing" } });
      }
      if (sec.updatedAt.toISOString() !== versionToken) {
        throw new ConflictException({
          ok: false,
          error: { code: "conflict", message: "Version mismatch — object changed since revision was saved" },
        });
      }
      await tx.sectionDraft.update({
        where: { id: sec.id },
        data: {
          label: s.prior.label,
          summary: s.prior.summary,
        },
      });
      return;
    }

    if (snapshot.kind === "event_draft") {
      const s = snapshot as EventRecoverySnapshot;
      const ev = await tx.eventDraft.findFirst({
        where: { id: s.event_id, storyDraftId },
      });
      if (!ev) {
        throw new NotFoundException({ ok: false, error: { code: "not_found", message: "Event missing" } });
      }
      if (ev.updatedAt.toISOString() !== versionToken) {
        throw new ConflictException({
          ok: false,
          error: { code: "conflict", message: "Version mismatch — object changed since revision was saved" },
        });
      }
      await tx.eventDraft.update({
        where: { id: ev.id },
        data: {
          headline: s.prior.headline,
          summary: s.prior.summary,
          dek: s.prior.dek,
          creatorNote: s.prior.creator_note,
        },
      });
      return;
    }

    if (snapshot.kind === "source_record") {
      const s = snapshot as SourceRecoverySnapshot;
      const row = await tx.sourceRecord.findFirst({
        where: { id: s.source_id, eventDraftId: s.event_id },
      });
      if (!row) {
        throw new NotFoundException({ ok: false, error: { code: "not_found", message: "Source missing" } });
      }
      if (row.updatedAt.toISOString() !== versionToken) {
        throw new ConflictException({
          ok: false,
          error: { code: "conflict", message: "Version mismatch — object changed since revision was saved" },
        });
      }
      const p = s.prior;
      await tx.sourceRecord.update({
        where: { id: row.id },
        data: {
          sourceUrl: p.source_url,
          sourceTitle: p.source_title,
          publisherName: p.publisher_name,
          relevanceNote: p.relevance_note,
          excerpt: p.excerpt,
          publishedAt: p.published_at ? new Date(p.published_at) : null,
        },
      });
      return;
    }

    throw new BadRequestException({
      ok: false,
      error: { code: "revision_snapshot_unsupported", message: "Unknown snapshot kind" },
    });
  }
}
