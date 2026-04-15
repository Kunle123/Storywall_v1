import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  type StoryBrief,
  type Story,
  type CreatorWorkflowState,
  type SubjectType,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateStoryDto } from "./dto/create-story.dto";
import type { PatchStoryBriefDto } from "./dto/patch-story-brief.dto";
import { normalizeIfMatchHeader } from "./if-match";

/** Prisma-required brief columns — must not be cleared with JSON `null` on PATCH. */
const BRIEF_FIELDS_NON_NULLABLE: (keyof PatchStoryBriefDto)[] = [
  "subject",
  "story_type",
  "research_brief",
  "desired_angle",
  "time_scope_mode",
  "narrative_intent",
  "imagery_mode",
  "creation_mode",
];

function briefStoryTypeToSubjectType(
  storyType: CreateStoryDto["story_type"] | PatchStoryBriefDto["story_type"],
): SubjectType {
  if (!storyType) {
    return "topic";
  }
  switch (storyType) {
    case "biography":
      return "person";
    case "controversy":
    case "issue_history":
    case "influence":
    case "movement_history":
    case "relationship_impact":
    case "custom":
    default:
      return "topic";
  }
}

/** URL-safe unique slug from subject (contract: public `stories.slug`). */
function slugBaseFromSubject(subject: string): string {
  const s = subject
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return s.length > 0 ? s : "story";
}

function storyBriefToApi(b: StoryBrief): Record<string, unknown> {
  return {
    id: b.id,
    story_id: b.storyId,
    creator_id: b.creatorId,
    subject: b.subject,
    subject_type_input: b.subjectTypeInput,
    story_type: b.storyType,
    research_brief: b.researchBrief,
    desired_angle: b.desiredAngle,
    time_scope_mode: b.timeScopeMode,
    time_scope_start: b.timeScopeStart
      ? b.timeScopeStart.toISOString().slice(0, 10)
      : null,
    time_scope_end: b.timeScopeEnd
      ? b.timeScopeEnd.toISOString().slice(0, 10)
      : null,
    audience: b.audience,
    narrative_intent: b.narrativeIntent,
    imagery_mode: b.imageryMode,
    source_inputs:
      b.sourceInputs === null ? null : (b.sourceInputs as unknown),
    writing_style_preference: b.writingStylePreference,
    creation_mode: b.creationMode,
    status: b.status,
    normalized_subject: b.normalizedSubject,
    subject_type_normalized: b.subjectTypeNormalized,
    suggested_time_scope: b.suggestedTimeScope,
    story_angle_candidates: b.storyAngleCandidates,
    prompt_risks: b.promptRisks,
    recommended_creation_mode: b.recommendedCreationMode,
    normalization_status: b.normalizationStatus,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async createStoryWorkspace(
    creatorId: string,
    dto: CreateStoryDto,
  ): Promise<{
    story: Story;
    storyBrief: StoryBrief;
    storyState: CreatorWorkflowState;
  }> {
    const base = slugBaseFromSubject(dto.subject);
    const sourceInputsJson: Prisma.InputJsonValue =
      dto.source_inputs !== undefined && dto.source_inputs.length > 0
        ? (dto.source_inputs as Prisma.InputJsonValue)
        : [];

    return this.prisma.$transaction(async (tx) => {
      const slug = await this.allocateUniqueSlug(tx, base);

      const story = await tx.story.create({
        data: {
          slug,
          creatorId,
          title: dto.subject.slice(0, 500),
          summary: "",
          subjectType: dto.subject_type_input ?? briefStoryTypeToSubjectType(dto.story_type),
          categoryPrimary: "general",
          workflowState: "drafting_brief",
        },
      });

      const storyBrief = await tx.storyBrief.create({
        data: {
          storyId: story.id,
          creatorId,
          subject: dto.subject,
          subjectTypeInput: dto.subject_type_input ?? null,
          storyType: dto.story_type,
          researchBrief: dto.research_brief,
          desiredAngle: dto.desired_angle,
          timeScopeMode: dto.time_scope_mode,
          timeScopeStart: dto.time_scope_start
            ? new Date(dto.time_scope_start)
            : null,
          timeScopeEnd: dto.time_scope_end ? new Date(dto.time_scope_end) : null,
          audience: dto.audience ?? null,
          narrativeIntent: dto.narrative_intent,
          imageryMode: dto.imagery_mode,
          sourceInputs: sourceInputsJson,
          writingStylePreference: dto.writing_style_preference ?? null,
          creationMode: dto.creation_mode,
        },
      });

      return {
        story,
        storyBrief,
        storyState: story.workflowState,
      };
    });
  }

  /** Serialize brief for API envelope (mutation contract §9.1). */
  briefToResponsePayload(brief: StoryBrief): Record<string, unknown> {
    return storyBriefToApi(brief);
  }

  /**
   * PATCH brief — §9.2, §6. Version token = `story_brief.updated_at` ISO string in `If-Match`.
   */
  async patchStoryBrief(params: {
    storyId: string;
    creatorId: string;
    ifMatchRaw: string | undefined;
    dto: PatchStoryBriefDto;
  }): Promise<{
    storyBrief: StoryBrief;
    storyState: CreatorWorkflowState;
  }> {
    const { storyId, creatorId, ifMatchRaw, dto } = params;

    if (!this.patchDtoHasContent(dto)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "At least one brief field is required",
        },
      });
    }

    this.rejectNullOnRequiredBriefFields(dto);

    const versionToken = normalizeIfMatchHeader(ifMatchRaw);
    if (!versionToken) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "If-Match header is required with the last story_brief updated_at (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: { storyBrief: true },
      });

      if (!story?.storyBrief) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or brief not found" },
        });
      }

      const allowedStates: CreatorWorkflowState[] = [
        "drafting_brief",
        "awaiting_framing_choice",
        "ready_for_edit",
      ];
      if (!allowedStates.includes(story.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Brief cannot be edited in the current workflow state",
            details: { story_state: story.workflowState },
          },
        });
      }

      const brief = story.storyBrief;
      if (brief.updatedAt.toISOString() !== versionToken) {
        const latest = await tx.storyBrief.findUnique({
          where: { id: brief.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              story_brief: latest ? storyBriefToApi(latest) : null,
            },
          },
        });
      }

      const briefData = this.buildBriefPatchInput(dto);
      const storyData = this.buildStorySyncFromBriefPatch(dto, brief);

      const updated = await tx.storyBrief.updateMany({
        where: {
          id: brief.id,
          updatedAt: brief.updatedAt,
        },
        data: briefData,
      });

      if (updated.count !== 1) {
        const latest = await tx.storyBrief.findUnique({
          where: { id: brief.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              story_brief: latest ? storyBriefToApi(latest) : null,
            },
          },
        });
      }

      if (Object.keys(storyData).length > 0) {
        await tx.story.update({
          where: { id: storyId },
          data: storyData,
        });
      }

      const storyBrief = await tx.storyBrief.findUniqueOrThrow({
        where: { id: brief.id },
      });
      const st = await tx.story.findUniqueOrThrow({
        where: { id: storyId },
        select: { workflowState: true },
      });

      return { storyBrief, storyState: st.workflowState };
    });
  }

  private patchDtoHasContent(dto: PatchStoryBriefDto): boolean {
    const keys = Object.keys(dto) as (keyof PatchStoryBriefDto)[];
    return keys.some((k) => dto[k] !== undefined);
  }

  private rejectNullOnRequiredBriefFields(dto: PatchStoryBriefDto): void {
    for (const key of BRIEF_FIELDS_NON_NULLABLE) {
      if (dto[key] === null) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "validation_failed",
            message: `Field "${String(key)}" cannot be set to null`,
          },
        });
      }
    }
  }

  private buildBriefPatchInput(
    dto: PatchStoryBriefDto,
  ): Prisma.StoryBriefUpdateInput {
    const d: Prisma.StoryBriefUpdateInput = {};
    if (dto.subject !== undefined) {
      d.subject = dto.subject as string;
    }
    if (dto.subject_type_input !== undefined) {
      d.subjectTypeInput = dto.subject_type_input;
    }
    if (dto.story_type !== undefined) {
      d.storyType = dto.story_type as Prisma.StoryBriefUpdateInput["storyType"];
    }
    if (dto.research_brief !== undefined) {
      d.researchBrief = dto.research_brief as string;
    }
    if (dto.desired_angle !== undefined) {
      d.desiredAngle = dto.desired_angle as string;
    }
    if (dto.time_scope_mode !== undefined) {
      d.timeScopeMode = dto.time_scope_mode as Prisma.StoryBriefUpdateInput["timeScopeMode"];
    }
    if (dto.time_scope_start !== undefined) {
      d.timeScopeStart =
        dto.time_scope_start === null ? null : new Date(dto.time_scope_start);
    }
    if (dto.time_scope_end !== undefined) {
      d.timeScopeEnd =
        dto.time_scope_end === null ? null : new Date(dto.time_scope_end);
    }
    if (dto.audience !== undefined) {
      d.audience = dto.audience;
    }
    if (dto.narrative_intent !== undefined) {
      d.narrativeIntent =
        dto.narrative_intent as Prisma.StoryBriefUpdateInput["narrativeIntent"];
    }
    if (dto.imagery_mode !== undefined) {
      d.imageryMode = dto.imagery_mode as Prisma.StoryBriefUpdateInput["imageryMode"];
    }
    if (dto.source_inputs !== undefined) {
      d.sourceInputs =
        dto.source_inputs === null
          ? Prisma.DbNull
          : (dto.source_inputs as Prisma.InputJsonValue);
    }
    if (dto.writing_style_preference !== undefined) {
      d.writingStylePreference = dto.writing_style_preference;
    }
    if (dto.creation_mode !== undefined) {
      d.creationMode = dto.creation_mode as Prisma.StoryBriefUpdateInput["creationMode"];
    }
    return d;
  }

  private buildStorySyncFromBriefPatch(
    dto: PatchStoryBriefDto,
    brief: StoryBrief,
  ): Prisma.StoryUpdateInput {
    const d: Prisma.StoryUpdateInput = {};
    if (dto.subject !== undefined && dto.subject !== null) {
      d.title = dto.subject.slice(0, 500);
    }
    if (dto.subject_type_input === null) {
      const st = dto.story_type ?? brief.storyType;
      d.subjectType = briefStoryTypeToSubjectType(st);
    } else if (dto.subject_type_input !== undefined) {
      d.subjectType = dto.subject_type_input;
    } else if (dto.story_type !== undefined && dto.story_type !== null) {
      d.subjectType = briefStoryTypeToSubjectType(dto.story_type);
    }
    return d;
  }

  private async allocateUniqueSlug(
    tx: Prisma.TransactionClient,
    base: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const suffix = attempt === 0 ? "" : `-${randomBytes(4).toString("hex")}`;
      const candidate = `${base}${suffix}`.slice(0, 128);
      const exists = await tx.story.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }
    return `${base}-${randomBytes(8).toString("hex")}`.slice(0, 128);
  }
}
