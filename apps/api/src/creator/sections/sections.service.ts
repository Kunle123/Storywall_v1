import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type CreatorWorkflowState, type SectionDraft } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIfMatchHeader } from "../stories/if-match";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { PatchSectionDto } from "./dto/patch-section.dto";
import {
  buildSectionRecoverySnapshot,
  insertRevisionEntry,
} from "../revision/revision-recorder";
import { sectionDraftToApi } from "./section-draft-to-api";

const ALLOWED_SECTION_EDIT_STATES: CreatorWorkflowState[] = [
  "ready_for_edit",
  "blocked",
  "ready_to_publish",
  "published",
];

/** M5-T21 — listSections is read-only; allow while draft assembly runs so the Draft tab can load. */
const ALLOWED_SECTION_LIST_STATES: CreatorWorkflowState[] = [...ALLOWED_SECTION_EDIT_STATES, "assembling_draft"];

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStoryDraftContextForList(params: {
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
    if (!ALLOWED_SECTION_LIST_STATES.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Sections list is not available in the current workflow state",
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
    if (!ALLOWED_SECTION_EDIT_STATES.includes(story.workflowState)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "invalid_state_transition",
          message: "Sections cannot be edited in the current workflow state",
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

  async listSections(params: {
    storyId: string;
    creatorId: string;
  }): Promise<{ sections: SectionDraft[]; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContextForList(params);
    const sections = await this.prisma.sectionDraft.findMany({
      where: { storyDraftId: ctx.storyDraftId },
      orderBy: { positionIndex: "asc" },
    });
    return { sections, storyState: ctx.workflowState };
  }

  async createSection(params: {
    storyId: string;
    creatorId: string;
    dto: CreateSectionDto;
  }): Promise<{ section: SectionDraft; storyState: CreatorWorkflowState }> {
    const ctx = await this.getStoryDraftContext(params);
    const { dto } = params;

    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.sectionDraft.aggregate({
        where: { storyDraftId: ctx.storyDraftId },
        _max: { positionIndex: true },
      });
      const nextIndex = (agg._max.positionIndex ?? -1) + 1;

      const section = await tx.sectionDraft.create({
        data: {
          storyDraftId: ctx.storyDraftId,
          label: dto.label,
          summary: dto.summary ?? null,
          positionIndex: nextIndex,
          sectionOrigin: "creator_added",
          status: "draft",
        },
      });

      return { section, storyState: ctx.workflowState };
    });
  }

  async patchSection(params: {
    storyId: string;
    creatorId: string;
    sectionId: string;
    ifMatchRaw: string | undefined;
    dto: PatchSectionDto;
  }): Promise<{ section: SectionDraft; storyState: CreatorWorkflowState }> {
    const { storyId, creatorId, sectionId, ifMatchRaw, dto } = params;

    if (!this.patchSectionDtoHasContent(dto)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "At least one section field is required",
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
            "If-Match header is required with the last section updated_at (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.getStoryDraftContext({ storyId, creatorId });

      const section = await tx.sectionDraft.findFirst({
        where: {
          id: sectionId,
          storyDraftId: ctx.storyDraftId,
        },
      });

      if (!section) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Section not found" },
        });
      }

      if (section.updatedAt.toISOString() !== versionToken) {
        const latest = await tx.sectionDraft.findUnique({
          where: { id: section.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              section_draft: latest ? sectionDraftToApi(latest) : null,
            },
          },
        });
      }

      const data = this.buildSectionPatchInput(dto);
      const updated = await tx.sectionDraft.updateMany({
        where: {
          id: section.id,
          updatedAt: section.updatedAt,
        },
        data,
      });

      if (updated.count !== 1) {
        const latest = await tx.sectionDraft.findUnique({
          where: { id: section.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              section_draft: latest ? sectionDraftToApi(latest) : null,
            },
          },
        });
      }

      await insertRevisionEntry(tx, {
        storyDraftId: ctx.storyDraftId,
        revisionType: "autosave",
        changedObjectType: "section",
        changedObjectId: section.id,
        changeSummary: `Autosave: section (${Object.keys(dto).filter((k) => dto[k as keyof typeof dto] !== undefined).join(", ")})`,
        isMaterialPublicChange: dto.label !== undefined || dto.summary !== undefined,
        createdBy: creatorId,
        recoverySnapshot: buildSectionRecoverySnapshot(section),
      });

      const fresh = await tx.sectionDraft.findUniqueOrThrow({
        where: { id: section.id },
      });
      return { section: fresh, storyState: ctx.workflowState };
    });
  }

  sectionToResponsePayload(section: SectionDraft): Record<string, unknown> {
    return sectionDraftToApi(section);
  }

  private patchSectionDtoHasContent(dto: PatchSectionDto): boolean {
    const keys = Object.keys(dto) as (keyof PatchSectionDto)[];
    return keys.some((k) => dto[k] !== undefined);
  }

  private buildSectionPatchInput(dto: PatchSectionDto): Prisma.SectionDraftUpdateInput {
    const d: Prisma.SectionDraftUpdateInput = {};
    if (dto.label !== undefined) {
      d.label = dto.label as string;
    }
    if (dto.summary !== undefined) {
      d.summary = dto.summary;
    }
    return d;
  }
}
