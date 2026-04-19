import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  parsePublishedBodySnapshotV1,
  pickStoryHeroFromProposals,
  primaryImageFromApprovedCandidate,
  type PublishedPublicPrimaryImageV1,
} from "../published-body-snapshot";

export type PublicStoryPayload = {
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string | null;
  conclusion: string | null;
  time_display: string | null;
  time_start: string | null;
  time_end: string | null;
  published_at: string;
  imagery_mode: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  hero_image_credit: string | null;
  sections: Array<{
    label: string;
    summary: string | null;
    position_index: number;
  }>;
  events: Array<{
    headline: string;
    dek: string | null;
    summary: string;
    display_date: string | null;
    location_name: string | null;
    context_label: string | null;
    position_index: number;
    references: Array<{
      title: string;
      outbound_url: string | null;
      publisher_name: string | null;
    }>;
    primary_image: PublishedPublicPrimaryImageV1 | null;
  }>;
  sources: Array<{
    title: string;
    outbound_url: string | null;
    publisher_name: string | null;
    position_index: number;
  }>;
};

/** M5-T27 — compact row for anonymous discovery list (public visibility only). */
export type PublicDiscoveryStoryCard = {
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  published_at: string;
};

/** M3-T12 — references-only surface (same snapshot rules as full public story read). */
export type PublicStoryReferencesPayload = {
  slug: string;
  title: string;
  subtitle: string | null;
  published_at: string;
  sources: PublicStoryPayload["sources"];
  events: Array<{
    headline: string;
    display_date: string | null;
    position_index: number;
    references: Array<{
      title: string;
      outbound_url: string | null;
      publisher_name: string | null;
    }>;
  }>;
};

const publicStoryInclude = {
  storyBrief: {
    include: {
      storyDraft: {
        include: {
          sectionDrafts: {
            where: { status: { not: "removed" } as const },
            orderBy: { positionIndex: "asc" as const },
            select: {
              label: true,
              summary: true,
              positionIndex: true,
            },
          },
          eventDrafts: {
            where: { status: { not: "removed" } as const },
            orderBy: { positionIndex: "asc" as const },
            select: {
              headline: true,
              dek: true,
              summary: true,
              displayDate: true,
              locationName: true,
              contextLabel: true,
              positionIndex: true,
              mediaKind: true,
              mediaPrimaryCandidate: {
                select: {
                  assetUrl: true,
                  assetAlt: true,
                  assetCredit: true,
                  approvalStatus: true,
                },
              },
            },
          },
          imageProposals: {
            where: { targetType: "story_cover", approvalStatus: "approved" },
            orderBy: [{ isPublicSelected: "desc" }, { updatedAt: "desc" }],
            select: {
              targetType: true,
              approvalStatus: true,
              assetUrl: true,
              assetAlt: true,
              assetCredit: true,
              isPublicSelected: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StoryInclude;

type StoryForPublicRead = Prisma.StoryGetPayload<{ include: typeof publicStoryInclude }>;

/**
 * M3-T08 + M3-T09 + M3-T10 + M3-T11 + M3-T12 — read-only published story surface (no auth).
 * Prefers `published_body_snapshot` when present so post-publish draft edits do not change the public page.
 */
@Injectable()
export class PublicStoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound(): never {
    throw new NotFoundException({
      ok: false,
      error: {
        code: "not_found",
        message: "Story not found or unavailable.",
      },
    });
  }

  private async loadPublishedStoryForPublicRead(slug: string): Promise<StoryForPublicRead> {
    const story = await this.prisma.story.findFirst({
      where: {
        slug,
        storyStatus: "published",
        workflowState: "published",
        visibility: { in: ["public", "unlisted"] },
      },
      include: publicStoryInclude,
    });
    if (!story?.publishedAt) {
      this.notFound();
    }
    return story;
  }

  /**
   * M5-T27 — anonymous discovery feed: only `visibility: public` published stories.
   * Unlisted remains readable by slug (`GET …/stories/:slug`) but is intentionally omitted here.
   */
  async listPublicDiscoverableStories(params?: { limit?: number }): Promise<{
    discovery_contract: string;
    limit_applied: number;
    stories: PublicDiscoveryStoryCard[];
  }> {
    const take = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const rows = await this.prisma.story.findMany({
      where: {
        storyStatus: "published",
        workflowState: "published",
        visibility: "public",
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take,
      select: {
        slug: true,
        title: true,
        subtitle: true,
        summary: true,
        publishedAt: true,
      },
    });
    return {
      discovery_contract:
        "Listed stories are those with live visibility public only. Unlisted stories are omitted from this list but remain readable at GET /api/v1/stories/:slug. Private stories are omitted and not anonymously readable by slug.",
      limit_applied: take,
      stories: rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        summary: r.summary,
        published_at: r.publishedAt!.toISOString(),
      })),
    };
  }

  async getPublishedBySlug(slug: string): Promise<PublicStoryPayload> {
    const story = await this.loadPublishedStoryForPublicRead(slug);
    const publishedAtIso = story.publishedAt!.toISOString();
    const fromSnapshot = parsePublishedBodySnapshotV1(story.publishedBodySnapshot);
    if (fromSnapshot) {
      return {
        slug: story.slug,
        published_at: publishedAtIso,
        ...fromSnapshot,
      };
    }

    const draft = story.storyBrief?.storyDraft;
    const imageryMode = draft?.imageryMode ?? null;
    const heroPick = draft ? pickStoryHeroFromProposals(draft.imageryMode, draft.imageProposals ?? []) : null;
    const sections =
      draft?.sectionDrafts.map((s) => ({
        label: s.label,
        summary: s.summary,
        position_index: s.positionIndex,
      })) ?? [];
    const events =
      draft?.eventDrafts.map((e) => ({
        headline: e.headline,
        dek: e.dek,
        summary: e.summary,
        display_date: e.displayDate,
        location_name: e.locationName,
        context_label: e.contextLabel,
        position_index: e.positionIndex,
        references: [],
        primary_image: draft
          ? primaryImageFromApprovedCandidate(draft.imageryMode, e.mediaKind, e.mediaPrimaryCandidate)
          : null,
      })) ?? [];

    return {
      slug: story.slug,
      title: story.title,
      subtitle: story.subtitle,
      summary: story.summary,
      lens: story.lens,
      conclusion: story.conclusion,
      time_display: story.timeDisplay,
      time_start: story.timeStart?.toISOString() ?? null,
      time_end: story.timeEnd?.toISOString() ?? null,
      published_at: publishedAtIso,
      imagery_mode: imageryMode,
      hero_image_url: heroPick?.url ?? null,
      hero_image_alt: heroPick?.alt ?? null,
      hero_image_credit: heroPick?.credit ?? null,
      sections,
      events,
      sources: [],
    };
  }

  async getPublishedReferencesBySlug(slug: string): Promise<PublicStoryReferencesPayload> {
    const story = await this.loadPublishedStoryForPublicRead(slug);
    const publishedAtIso = story.publishedAt!.toISOString();
    const fromSnapshot = parsePublishedBodySnapshotV1(story.publishedBodySnapshot);
    if (fromSnapshot) {
      return {
        slug: story.slug,
        title: fromSnapshot.title,
        subtitle: fromSnapshot.subtitle,
        published_at: publishedAtIso,
        sources: fromSnapshot.sources,
        events: fromSnapshot.events.map((e) => ({
          headline: e.headline,
          display_date: e.display_date,
          position_index: e.position_index,
          references: e.references,
        })),
      };
    }

    const draft = story.storyBrief?.storyDraft;
    const events =
      draft?.eventDrafts.map((e) => ({
        headline: e.headline,
        display_date: e.displayDate,
        position_index: e.positionIndex,
        references: [],
      })) ?? [];

    return {
      slug: story.slug,
      title: story.title,
      subtitle: story.subtitle,
      published_at: publishedAtIso,
      sources: [],
      events,
    };
  }
}
