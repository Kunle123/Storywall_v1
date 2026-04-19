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
import { primaryImageFromApprovedCandidate } from "../../published-body-snapshot";
import { eventDraftToApi } from "./event-draft-to-api";

const ALLOWED_EVENT_EDIT_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "needs_validation",
  "blocked",
  "ready_to_publish",
  "published",
];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * M5-T15 — read-only list context: creator-owned story may exist before a `StoryDraft`
   * row is created (draft shell is created with framing generation). LIST must not 404
   * in those phases; return an empty event list instead. Mutations still use
   * {@link getStoryDraftContext} with stricter rules.
   */
  private async resolveStoryForEventList(params: {
    storyId: string;
    creatorId: string;
  }): Promise<{
    storyState: CreatorWorkflowState;
    storyDraftId: string | null;
  }> {
    const { storyId, creatorId } = params;
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      include: {
        storyBrief: { include: { storyDraft: true } },
      },
    });
    if (!story) {
      throw new NotFoundException({
        ok: false,
        error: { code: "story_not_found", message: "Story not found" },
      });
    }
    const draft = story.storyBrief?.storyDraft ?? null;
    return {
      storyState: story.workflowState,
      storyDraftId: draft?.id ?? null,
    };
  }

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
  }): Promise<{
    events: Array<
      Prisma.EventDraftGetPayload<{
        include: {
          mediaPrimaryCandidate: {
            select: {
              assetUrl: true;
              assetAlt: true;
              assetCredit: true;
              approvalStatus: true;
            };
          };
        };
      }>
    >;
    storyState: CreatorWorkflowState;
    draftImageryMode: string;
    listMeta?: { event_list_scope: "no_story_draft" };
  }> {
    const { storyState, storyDraftId } = await this.resolveStoryForEventList(params);
    if (!storyDraftId) {
      return {
        events: [],
        storyState,
        draftImageryMode: "no_imagery",
        listMeta: { event_list_scope: "no_story_draft" },
      };
    }
    const draftRow = await this.prisma.storyDraft.findUnique({
      where: { id: storyDraftId },
      select: { imageryMode: true },
    });
    const draftImageryMode = draftRow?.imageryMode ?? "selective_editorial";
    const events = await this.prisma.eventDraft.findMany({
      where: { storyDraftId, status: { not: "removed" } },
      orderBy: { positionIndex: "asc" },
      include: {
        mediaPrimaryCandidate: {
          select: {
            assetUrl: true,
            assetAlt: true,
            assetCredit: true,
            approvalStatus: true,
          },
        },
      },
    });
    return { events, storyState, draftImageryMode };
  }

  async createEvent(params: {
    storyId: string;
    creatorId: string;
    dto: CreateEventDto;
  }): Promise<{
    event: Prisma.EventDraftGetPayload<{
      include: {
        mediaPrimaryCandidate: {
          select: { assetUrl: true; assetAlt: true; assetCredit: true; approvalStatus: true };
        };
      };
    }>;
    storyState: CreatorWorkflowState;
    draftImageryMode: string;
  }> {
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

      const imageryRow = await tx.storyDraft.findUniqueOrThrow({
        where: { id: ctx.storyDraftId },
        select: { imageryMode: true },
      });
      const fresh = await tx.eventDraft.findUniqueOrThrow({
        where: { id: event.id },
        include: {
          mediaPrimaryCandidate: {
            select: {
              assetUrl: true,
              assetAlt: true,
              assetCredit: true,
              approvalStatus: true,
            },
          },
        },
      });
      return { event: fresh, storyState: ctx.workflowState, draftImageryMode: imageryRow.imageryMode };
    });
  }

  async patchEvent(params: {
    storyId: string;
    creatorId: string;
    eventId: string;
    ifMatchRaw: string | undefined;
    dto: PatchEventDto;
  }): Promise<{
    event: Prisma.EventDraftGetPayload<{
      include: {
        mediaPrimaryCandidate: {
          select: { assetUrl: true; assetAlt: true; assetCredit: true; approvalStatus: true };
        };
      };
    }>;
    storyState: CreatorWorkflowState;
    draftImageryMode: string;
  }> {
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
      const touchesNarrative =
        dto.headline !== undefined || dto.summary !== undefined || dto.dek !== undefined;
      if (
        touchesNarrative &&
        (event.generationMode === "ai_draft" || event.generationMode === "ai_assisted")
      ) {
        data.generationMode = "manual_after_ai";
      }
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
          dto.headline !== undefined ||
          dto.summary !== undefined ||
          dto.creator_note !== undefined ||
          dto.display_date !== undefined,
        createdBy: creatorId,
        recoverySnapshot: buildEventRecoverySnapshot(event),
      });

      const fresh = await tx.eventDraft.findUniqueOrThrow({
        where: { id: event.id },
        include: {
          mediaPrimaryCandidate: {
            select: {
              assetUrl: true,
              assetAlt: true,
              assetCredit: true,
              approvalStatus: true,
            },
          },
        },
      });
      const imageryRow = await tx.storyDraft.findUniqueOrThrow({
        where: { id: ctx.storyDraftId },
        select: { imageryMode: true },
      });
      return { event: fresh, storyState: ctx.workflowState, draftImageryMode: imageryRow.imageryMode };
    });
  }

  eventToResponsePayload(
    event: Prisma.EventDraftGetPayload<{
      include: {
        mediaPrimaryCandidate: {
          select: {
            assetUrl: true;
            assetAlt: true;
            assetCredit: true;
            approvalStatus: true;
          };
        };
      };
    }>,
    draftImageryMode: string,
  ): Record<string, unknown> {
    const primary_image = primaryImageFromApprovedCandidate(
      draftImageryMode,
      event.mediaKind,
      event.mediaPrimaryCandidate,
    );
    return {
      ...eventDraftToApi(event),
      primary_image,
    };
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
    if (dto.display_date !== undefined) {
      const t = dto.display_date.trim();
      d.displayDate = t.length === 0 ? null : t;
    }
    return d;
  }
}
