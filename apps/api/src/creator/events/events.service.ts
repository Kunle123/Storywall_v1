import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type CreatorWorkflowState, type EventDraft } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIfMatchHeader } from "../stories/if-match";
import type { CreateEventDto } from "./dto/create-event.dto";
import type { PatchEventDto } from "./dto/patch-event.dto";
import {
  buildEventRecoverySnapshot,
  insertRevisionEntry,
} from "../revision/revision-recorder";
import { eventDraftToApi } from "./event-draft-to-api";

const ALLOWED_EVENT_EDIT_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "blocked",
  "ready_to_publish",
  "published",
];

@Injectable()
export class EventsService {
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
    if (!ALLOWED_EVENT_EDIT_STATES.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Events cannot be edited in the current workflow state",
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

  async listEvents(params: {
    storyId: string;
    creatorId: string;
  }): Promise<{ events: EventDraft[]; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContext(params);
    const events = await this.prisma.eventDraft.findMany({
      where: { storyDraftId: ctx.storyDraftId, status: { not: "removed" } },
      orderBy: { positionIndex: "asc" },
    });
    return { events, storyState: ctx.workflowState };
  }

  async createEvent(params: {
    storyId: string;
    creatorId: string;
    dto: CreateEventDto;
  }): Promise<{ event: EventDraft; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContext(params);
    const { dto } = params;

    let sectionDraftId: string | null = null;
    if (dto.section_id) {
      const sec = await this.prisma.sectionDraft.findFirst({
        where: { id: dto.section_id, storyDraftId: ctx.storyDraftId },
      });
      if (!sec) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "validation_failed",
            message: "section_id must refer to a section on this story draft",
          },
        });
      }
      sectionDraftId = sec.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.eventDraft.aggregate({
        where: { storyDraftId: ctx.storyDraftId },
        _max: { positionIndex: true },
      });
      const nextIndex = (agg._max.positionIndex ?? -1) + 1;

      const event = await tx.eventDraft.create({
        data: {
          storyDraftId: ctx.storyDraftId,
          sectionDraftId,
          headline: dto.headline,
          summary: dto.summary,
          slug: null,
          dek: null,
          creatorNote: null,
          eventType: "standard",
          contextLabel: null,
          significanceLevel: "standard",
          eventDateStart: null,
          eventDateEnd: null,
          eventDatePrecision: "unknown",
          displayDate: null,
          yearAnchor: null,
          intervalNote: null,
          locationName: null,
          positionIndex: nextIndex,
          mediaKind: "none",
          sourceCount: 0,
          sourceDensity: "none",
          confidenceState: "mostly_verified",
          claimRiskLevel: "low",
          moderationStatus: "pending",
          isShareable: false,
          isPinned: false,
          isFeaturedInSummary: false,
          generationMode: "manual",
          generationRunId: null,
          editorialReviewStatus: "unreviewed",
          status: "draft",
        },
      });

      return { event, storyState: ctx.workflowState };
    });
  }

  async patchEvent(params: {
    storyId: string;
    creatorId: string;
    eventId: string;
    ifMatchRaw: string | undefined;
    dto: PatchEventDto;
  }): Promise<{ event: EventDraft; storyState: CreatorWorkflowState }> {
    const { storyId, creatorId, eventId, ifMatchRaw, dto } = params;

    if (!this.patchEventDtoHasContent(dto)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "At least one event field is required",
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
            "If-Match header is required with the last event updated_at (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.getStoryDraftContext({ storyId, creatorId });

      const event = await tx.eventDraft.findFirst({
        where: {
          id: eventId,
          storyDraftId: ctx.storyDraftId,
        },
      });

      if (!event) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Event not found" },
        });
      }

      if (event.updatedAt.toISOString() !== versionToken) {
        const latest = await tx.eventDraft.findUnique({
          where: { id: event.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              event_draft: latest ? eventDraftToApi(latest) : null,
            },
          },
        });
      }

      const data = this.buildEventPatchInput(dto);
      const updated = await tx.eventDraft.updateMany({
        where: {
          id: event.id,
          updatedAt: event.updatedAt,
        },
        data,
      });

      if (updated.count !== 1) {
        const latest = await tx.eventDraft.findUnique({
          where: { id: event.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              event_draft: latest ? eventDraftToApi(latest) : null,
            },
          },
        });
      }

      await insertRevisionEntry(tx, {
        storyDraftId: ctx.storyDraftId,
        revisionType: "autosave",
        changedObjectType: "event",
        changedObjectId: event.id,
        changeSummary: `Autosave: event (${Object.keys(dto).filter((k) => dto[k as keyof typeof dto] !== undefined).join(", ")})`,
        isMaterialPublicChange:
          dto.headline !== undefined || dto.summary !== undefined || dto.creator_note !== undefined,
        createdBy: creatorId,
        recoverySnapshot: buildEventRecoverySnapshot(event),
      });

      const fresh = await tx.eventDraft.findUniqueOrThrow({
        where: { id: event.id },
      });
      return { event: fresh, storyState: ctx.workflowState };
    });
  }

  eventToResponsePayload(event: EventDraft): Record<string, unknown> {
    return eventDraftToApi(event);
  }

  private patchEventDtoHasContent(dto: PatchEventDto): boolean {
    const keys = Object.keys(dto) as (keyof PatchEventDto)[];
    return keys.some((k) => dto[k] !== undefined);
  }

  private buildEventPatchInput(dto: PatchEventDto): Prisma.EventDraftUpdateInput {
    const d: Prisma.EventDraftUpdateInput = {};
    if (dto.headline !== undefined) {
      d.headline = dto.headline as string;
    }
    if (dto.summary !== undefined) {
      d.summary = dto.summary as string;
    }
    if (dto.dek !== undefined) {
      d.dek = dto.dek;
    }
    if (dto.creator_note !== undefined) {
      d.creatorNote = dto.creator_note;
    }
    return d;
  }
}
