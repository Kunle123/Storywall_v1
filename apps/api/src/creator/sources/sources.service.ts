import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type CreatorWorkflowState, type SourceRecord } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIfMatchHeader } from "../stories/if-match";
import type { CreateSourceDto } from "./dto/create-source.dto";
import type { PatchSourceDto } from "./dto/patch-source.dto";
import {
  buildSourceRecoverySnapshot,
  insertRevisionEntry,
} from "../revision/revision-recorder";
import { sourceRecordToApi } from "./source-record-to-api";

const ALLOWED_SOURCE_EDIT_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "blocked",
  "ready_to_publish",
  "published",
];

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStoryDraftContext(params: {
    storyId: string;
    creatorId: string;
  }): Promise<{
    storyId: string;
    workflowState: CreatorWorkflowState;
    storyDraftId: string;
  }> {
    const { storyId, creatorId } = params;
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      include: {
        storyBrief: { include: { storyDraft: true } },
      },
    });
    const draft = story?.storyBrief?.storyDraft;
    if (!story || !draft) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Story or draft not found" },
      });
    }
    if (!ALLOWED_SOURCE_EDIT_STATES.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Sources cannot be edited in the current workflow state",
          details: { story_state: story.workflowState },
        },
      });
    }
    return {
      storyId: story.id,
      workflowState: story.workflowState,
      storyDraftId: draft.id,
    };
  }

  private async assertEventInDraft(params: { storyDraftId: string; eventId: string }) {
    const ev = await this.prisma.eventDraft.findFirst({
      where: { id: params.eventId, storyDraftId: params.storyDraftId },
    });
    if (!ev) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Event not found" },
      });
    }
    return ev;
  }

  async listSourcesForEvent(params: {
    storyId: string;
    creatorId: string;
    eventId: string;
  }): Promise<{ sources: SourceRecord[]; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContext(params);
    await this.assertEventInDraft({ storyDraftId: ctx.storyDraftId, eventId: params.eventId });
    const sources = await this.prisma.sourceRecord.findMany({
      where: {
        eventDraftId: params.eventId,
        status: { not: "rejected" },
      },
      orderBy: { createdAt: "asc" },
    });
    return { sources, storyState: ctx.workflowState };
  }

  async createSource(params: {
    storyId: string;
    creatorId: string;
    eventId: string;
    dto: CreateSourceDto;
  }): Promise<{ source: SourceRecord; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContext(params);
    await this.assertEventInDraft({ storyDraftId: ctx.storyDraftId, eventId: params.eventId });
    const { dto, creatorId, eventId } = params;

    return this.prisma.$transaction(async (tx) => {
      const source = await tx.sourceRecord.create({
        data: {
          eventDraftId: eventId,
          sourceUrl: dto.source_url,
          sourceTitle: dto.source_title,
          publisherName: dto.publisher_name,
          sourceType: dto.source_type ?? "article",
          publishedAt: dto.published_at ? new Date(dto.published_at) : null,
          excerpt: dto.excerpt ?? null,
          relevanceNote: dto.relevance_note,
          reliabilityTier: dto.reliability_tier ?? "medium",
          verificationStatus: dto.verification_status ?? "unreviewed",
          isPrimary: dto.is_primary ?? false,
          isPublic: dto.is_public ?? true,
          duplicateSignal: false,
          extractionMethod: dto.source_extraction_method ?? "manual",
          addedBy: creatorId,
          status: "draft",
        },
      });

      await tx.eventDraft.update({
        where: { id: eventId },
        data: {
          sourceCount: { increment: 1 },
        },
      });

      return { source, storyState: ctx.workflowState };
    });
  }

  async patchSource(params: {
    storyId: string;
    creatorId: string;
    eventId: string;
    sourceId: string;
    ifMatchRaw: string | undefined;
    dto: PatchSourceDto;
  }): Promise<{ source: SourceRecord; storyState: CreatorWorkflowState }> {
    const { storyId, creatorId, eventId, sourceId, ifMatchRaw, dto } = params;

    if (!this.patchDtoHasContent(dto)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "At least one source field is required",
        },
      });
    }

    const versionToken = normalizeIfMatchHeader(ifMatchRaw);
    if (!versionToken) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message:
            "If-Match header is required with the last source updated_at (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.getStoryDraftContext({ storyId, creatorId });
      await this.assertEventInDraft({ storyDraftId: ctx.storyDraftId, eventId });

      const row = await tx.sourceRecord.findFirst({
        where: {
          id: sourceId,
          eventDraftId: eventId,
        },
      });

      if (!row) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Source not found" },
        });
      }

      if (row.updatedAt.toISOString() !== versionToken) {
        const latest = await tx.sourceRecord.findUnique({ where: { id: row.id } });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              source_record: latest ? sourceRecordToApi(latest) : null,
            },
          },
        });
      }

      const data = this.buildPatchInput(dto);
      const updated = await tx.sourceRecord.updateMany({
        where: {
          id: row.id,
          updatedAt: row.updatedAt,
        },
        data,
      });

      if (updated.count !== 1) {
        const latest = await tx.sourceRecord.findUnique({ where: { id: row.id } });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              source_record: latest ? sourceRecordToApi(latest) : null,
            },
          },
        });
      }

      await insertRevisionEntry(tx, {
        storyDraftId: ctx.storyDraftId,
        revisionType: "autosave",
        changedObjectType: "source",
        changedObjectId: row.id,
        changeSummary: `Autosave: source (${Object.keys(dto).filter((k) => dto[k as keyof typeof dto] !== undefined).join(", ")})`,
        isMaterialPublicChange: dto.relevance_note !== undefined || dto.source_title !== undefined,
        createdBy: creatorId,
        recoverySnapshot: buildSourceRecoverySnapshot(eventId, row),
      });

      const fresh = await tx.sourceRecord.findUniqueOrThrow({ where: { id: row.id } });
      return { source: fresh, storyState: ctx.workflowState };
    });
  }

  sourceToResponsePayload(s: SourceRecord): Record<string, unknown> {
    return sourceRecordToApi(s);
  }

  private patchDtoHasContent(dto: PatchSourceDto): boolean {
    const keys = Object.keys(dto) as (keyof PatchSourceDto)[];
    return keys.some((k) => dto[k] !== undefined);
  }

  private buildPatchInput(dto: PatchSourceDto): Prisma.SourceRecordUpdateInput {
    const d: Prisma.SourceRecordUpdateInput = {};
    if (dto.source_url !== undefined) d.sourceUrl = dto.source_url;
    if (dto.source_title !== undefined) d.sourceTitle = dto.source_title;
    if (dto.publisher_name !== undefined) d.publisherName = dto.publisher_name;
    if (dto.relevance_note !== undefined) d.relevanceNote = dto.relevance_note;
    if (dto.published_at !== undefined) {
      d.publishedAt = dto.published_at === null ? null : new Date(dto.published_at);
    }
    if (dto.excerpt !== undefined) d.excerpt = dto.excerpt;
    if (dto.reliability_tier !== undefined) d.reliabilityTier = dto.reliability_tier;
    if (dto.verification_status !== undefined) d.verificationStatus = dto.verification_status;
    if (dto.is_primary !== undefined) d.isPrimary = dto.is_primary;
    if (dto.is_public !== undefined) d.isPublic = dto.is_public;
    return d;
  }
}
