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
  type StoryDraft,
  type CreatorWorkflowState,
  type SubjectType,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { storyDraftToApi } from "../frames/story-draft-to-api";
import {
  buildStoryDraftRecoverySnapshot,
  insertRevisionEntry,
  isMaterialStoryPatch,
  summarizeStoryPatchFields,
} from "../revision/revision-recorder";
import { buildPublishedBodySnapshotV1 } from "../../published-body-snapshot";
import { WorkflowTransitionService } from "../workflow-transition.service";
import type { CreateStoryDto } from "./dto/create-story.dto";
import type { PatchStoryBriefDto } from "./dto/patch-story-brief.dto";
import type { PatchStoryDraftDto } from "./dto/patch-story-draft.dto";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowTransitions: WorkflowTransitionService,
  ) {}

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
          suggestedTimeScope: dto.suggested_time_scope?.trim() ? dto.suggested_time_scope.trim() : null,
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

      await this.workflowTransitions.appendIfChanged(tx, {
        storyId: story.id,
        fromState: null,
        toState: story.workflowState,
        actorType: "creator",
        actorId: creatorId,
        trigger: "create_story",
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

  /** Serialize story draft for API envelope (mutation contract §12.1). */
  draftToResponsePayload(draft: StoryDraft): Record<string, unknown> {
    return storyDraftToApi(draft);
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

  /**
   * PATCH story draft — §12.1, §6. Version token = `story_draft.last_edited_at` ISO string in `If-Match`.
   */
  async patchStoryDraft(params: {
    storyId: string;
    creatorId: string;
    ifMatchRaw: string | undefined;
    dto: PatchStoryDraftDto;
  }): Promise<{
    storyDraft: StoryDraft;
    storyState: CreatorWorkflowState;
    revisionId?: string;
  }> {
    const { storyId, creatorId, ifMatchRaw, dto } = params;

    if (!this.patchDraftDtoHasContent(dto)) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "validation_failed",
          message: "At least one story draft field is required",
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
            "If-Match header is required with the last story_draft last_edited_at (ISO 8601)",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const story = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: {
          storyBrief: {
            include: { storyDraft: true },
          },
        },
      });

      const draft = story?.storyBrief?.storyDraft;
      if (!story || !draft) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or draft not found" },
        });
      }

      const allowedStates: CreatorWorkflowState[] = [
        "ready_for_edit",
        /** M5-T22 — same manuscript edits as Draft tab while checks gate publish. */
        "needs_validation",
        "blocked",
        "ready_to_publish",
        "published",
      ];
      if (!allowedStates.includes(story.workflowState)) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "invalid_state_transition",
            message: "Story draft cannot be edited in the current workflow state",
            details: { story_state: story.workflowState },
          },
        });
      }

      if (draft.lastEditedAt.toISOString() !== versionToken) {
        const latest = await tx.storyDraft.findUnique({
          where: { id: draft.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              story_draft: latest ? storyDraftToApi(latest) : null,
            },
          },
        });
      }

      const draftData: Prisma.StoryDraftUpdateInput = {
        ...this.buildDraftPatchInput(dto),
        lastEditedBy: creatorId,
      };

      const updated = await tx.storyDraft.updateMany({
        where: {
          id: draft.id,
          lastEditedAt: draft.lastEditedAt,
        },
        data: draftData,
      });

      if (updated.count !== 1) {
        const latest = await tx.storyDraft.findUnique({
          where: { id: draft.id },
        });
        throw new ConflictException({
          ok: false,
          error: {
            code: "conflict",
            message: "Version mismatch or concurrent edit conflict",
            details: {
              story_draft: latest ? storyDraftToApi(latest) : null,
            },
          },
        });
      }

      const revisionId = await insertRevisionEntry(tx, {
        storyDraftId: draft.id,
        revisionType: "autosave",
        changedObjectType: "story",
        changedObjectId: draft.id,
        changeSummary: `Autosave: ${summarizeStoryPatchFields(dto as unknown as Record<string, unknown>)}`,
        isMaterialPublicChange: isMaterialStoryPatch(dto),
        createdBy: creatorId,
        recoverySnapshot: buildStoryDraftRecoverySnapshot(draft),
      });

      const storyDraft = await tx.storyDraft.findUniqueOrThrow({
        where: { id: draft.id },
      });

      /** M5-T26 — `stories.visibility` (anonymous read gate) updates only on publish/republish, not on draft PATCH. */

      const st = await tx.story.findUniqueOrThrow({
        where: { id: storyId },
        select: { workflowState: true },
      });

      return { storyDraft, storyState: st.workflowState, revisionId };
    });
  }

  /**
   * M3-T07 + M3-T10 + M3-T11 — first publish: lifecycle + workflow `published`, frozen `published_body_snapshot`.
   * M4-T09 — republish: when `story_status` is already `published` and workflow is `ready_to_publish`, refresh snapshot + `published_at`, keep live.
   */
  async publishStory(params: {
    storyId: string;
    creatorId: string;
    idempotencyKey: string;
    acknowledgeValidationWarnings: boolean;
  }): Promise<{
    publishedAt: Date;
    storyState: CreatorWorkflowState;
    storyStatus: string;
    idempotencyReplayed: boolean;
  }> {
    const { storyId, creatorId, idempotencyKey, acknowledgeValidationWarnings } = params;

    return this.prisma.$transaction(async (tx) => {
      const existingIdem = await tx.creatorStoryPublishIdempotency.findFirst({
        where: { creatorId, storyId, requestKey: idempotencyKey },
      });
      if (existingIdem) {
        return {
          publishedAt: existingIdem.publishedAtResponse,
          storyState: "published",
          storyStatus: "published",
          idempotencyReplayed: true,
        };
      }

      const storyRow = await tx.story.findFirst({
        where: { id: storyId, creatorId },
        include: {
          storyBrief: {
            include: {
              storyDraft: {
                include: {
                  draftTrustMetadata: {
                    include: {
                      latestValidationReport: { select: { id: true, overallResult: true } },
                    },
                  },
                  sectionDrafts: {
                    where: { status: { not: "removed" } },
                    orderBy: { positionIndex: "asc" },
                    select: { label: true, summary: true, positionIndex: true },
                  },
                  eventDrafts: {
                    where: { status: { not: "removed" } },
                    orderBy: { positionIndex: "asc" },
                    select: {
                      headline: true,
                      dek: true,
                      summary: true,
                      displayDate: true,
                      locationName: true,
                      contextLabel: true,
                      positionIndex: true,
                      sources: {
                        where: { isPublic: true, status: { not: "rejected" } },
                        orderBy: { createdAt: "asc" },
                        select: { sourceTitle: true, sourceUrl: true, publisherName: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!storyRow?.storyBrief?.storyDraft) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story or draft not found" },
        });
      }

      const storyIsLive = storyRow.storyStatus === "published";
      const isRepublish = storyIsLive && storyRow.workflowState === "ready_to_publish";

      if (storyIsLive && !isRepublish) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "republish_not_ready",
            message:
              "This story is already live. Readers still see your last published snapshot until you run checks and the workflow reaches ready_to_publish, then publish again to refresh the public snapshot.",
            details: {
              story_state: storyRow.workflowState,
              story_lifecycle_status: storyRow.storyStatus,
            },
          },
        });
      }

      if (!storyIsLive) {
        if (storyRow.workflowState !== "ready_to_publish") {
          throw new BadRequestException({
            ok: false,
            error: {
              code: "publish_not_allowed",
              message: "Publish is only available when the story workflow is ready_to_publish",
              details: { story_state: storyRow.workflowState },
            },
          });
        }
      }

      const report = storyRow.storyBrief.storyDraft.draftTrustMetadata?.latestValidationReport;
      if (!report) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "publish_requires_latest_validation",
            message: "Run checks so a latest validation snapshot exists before publishing",
          },
        });
      }

      if (report.overallResult === "block") {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "publish_blocked_by_validation",
            message: "Latest validation still reports a block; resolve issues before publishing",
          },
        });
      }

      if (report.overallResult === "warn" && !acknowledgeValidationWarnings) {
        throw new BadRequestException({
          ok: false,
          error: {
            code: "warnings_acknowledgement_required",
            message: "Latest validation has warnings; resend with acknowledge_validation_warnings: true",
          },
        });
      }

      const publishedAt = new Date();
      const fromWf = storyRow.workflowState;
      const draftForSnap = storyRow.storyBrief.storyDraft;
      /** Reader snapshot follows the editable draft shell (title, lens, conclusion, etc.), not stale `stories.*` copies. */
      const publishedBodySnapshot = buildPublishedBodySnapshotV1({
        story: {
          title: draftForSnap.title,
          subtitle: draftForSnap.subtitle,
          summary: draftForSnap.summary,
          lens: draftForSnap.lens,
          conclusion: draftForSnap.conclusion,
          timeDisplay: draftForSnap.timeDisplay,
          timeStart: draftForSnap.timeStart,
          timeEnd: draftForSnap.timeEnd,
        },
        sectionDrafts: draftForSnap.sectionDrafts,
        eventDrafts: draftForSnap.eventDrafts,
      });

      if (isRepublish) {
        const updated = await tx.story.updateMany({
          where: {
            id: storyId,
            creatorId,
            storyStatus: "published",
            workflowState: "ready_to_publish",
          },
          data: {
            publishedAt,
            publishedBodySnapshot,
            workflowState: "published",
            visibility: draftForSnap.visibilityTarget,
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            ok: false,
            error: {
              code: "publish_conflict",
              message: "Could not update the published snapshot; story state may have changed. Refresh and try again.",
            },
          });
        }

        await this.workflowTransitions.appendIfChanged(tx, {
          storyId,
          fromState: "ready_to_publish",
          toState: "published",
          actorType: "creator",
          actorId: creatorId,
          trigger: "creator_republish",
        });
      } else {
        const updated = await tx.story.updateMany({
          where: {
            id: storyId,
            creatorId,
            workflowState: "ready_to_publish",
            storyStatus: { not: "published" },
          },
          data: {
            workflowState: "published",
            storyStatus: "published",
            publishedAt,
            publishedBodySnapshot,
            visibility: draftForSnap.visibilityTarget,
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            ok: false,
            error: {
              code: "publish_conflict",
              message: "Could not publish; story state may have changed. Refresh and try again.",
            },
          });
        }

        await this.workflowTransitions.appendIfChanged(tx, {
          storyId,
          fromState: fromWf,
          toState: "published",
          actorType: "creator",
          actorId: creatorId,
          trigger: "creator_publish",
        });
      }

      await tx.creatorStoryPublishIdempotency.create({
        data: {
          creatorId,
          storyId,
          requestKey: idempotencyKey,
          publishedAtResponse: publishedAt,
        },
      });

      return {
        publishedAt,
        storyState: "published",
        storyStatus: "published",
        idempotencyReplayed: false,
      };
    });
  }

  private patchDraftDtoHasContent(dto: PatchStoryDraftDto): boolean {
    const keys = Object.keys(dto) as (keyof PatchStoryDraftDto)[];
    return keys.some((k) => dto[k] !== undefined);
  }

  private buildDraftPatchInput(dto: PatchStoryDraftDto): Prisma.StoryDraftUpdateInput {
    const d: Prisma.StoryDraftUpdateInput = {};
    if (dto.title !== undefined) {
      d.title = dto.title;
    }
    if (dto.subtitle !== undefined) {
      d.subtitle = dto.subtitle;
    }
    if (dto.summary !== undefined) {
      d.summary = dto.summary;
    }
    if (dto.lens !== undefined) {
      d.lens = dto.lens;
    }
    if (dto.conclusion !== undefined) {
      d.conclusion = dto.conclusion;
    }
    if (dto.category_primary !== undefined) {
      d.categoryPrimary = dto.category_primary;
    }
    if (dto.category_secondary !== undefined) {
      d.categorySecondary = dto.category_secondary;
    }
    if (dto.lead_priority !== undefined) {
      d.leadPriority = dto.lead_priority;
    }
    if (dto.discovery_mode !== undefined) {
      d.discoveryMode = dto.discovery_mode as Prisma.StoryDraftUpdateInput["discoveryMode"];
    }
    if (dto.imagery_mode !== undefined) {
      d.imageryMode = dto.imagery_mode as Prisma.StoryDraftUpdateInput["imageryMode"];
    }
    if (dto.time_start !== undefined) {
      d.timeStart =
        dto.time_start === null ? null : new Date(dto.time_start);
    }
    if (dto.time_end !== undefined) {
      d.timeEnd = dto.time_end === null ? null : new Date(dto.time_end);
    }
    if (dto.time_display !== undefined) {
      d.timeDisplay = dto.time_display;
    }
    if (dto.visibility_target !== undefined) {
      d.visibilityTarget =
        dto.visibility_target as Prisma.StoryDraftUpdateInput["visibilityTarget"];
    }
    if (dto.needs_human_review !== undefined) {
      d.needsHumanReview = dto.needs_human_review;
    }
    if (dto.editorial_review_status !== undefined) {
      d.editorialReviewStatus =
        dto.editorial_review_status as Prisma.StoryDraftUpdateInput["editorialReviewStatus"];
    }
    return d;
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
    if (dto.suggested_time_scope !== undefined) {
      const raw = dto.suggested_time_scope;
      d.suggestedTimeScope =
        raw === null || raw === "" || (typeof raw === "string" && !raw.trim()) ? null : raw.trim();
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
