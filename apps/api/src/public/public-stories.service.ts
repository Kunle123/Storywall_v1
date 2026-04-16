import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { parsePublishedBodySnapshotV1 } from "../published-body-snapshot";

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
  }>;
};

/**
 * M3-T08 + M3-T09 — read-only published story surface (no auth).
 * Prefers `published_body_snapshot` when present so post-publish draft edits do not change the public page.
 */
@Injectable()
export class PublicStoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedBySlug(slug: string): Promise<PublicStoryPayload> {
    const story = await this.prisma.story.findFirst({
      where: {
        slug,
        storyStatus: "published",
        workflowState: "published",
        visibility: { in: ["public", "unlisted"] },
      },
      include: {
        storyBrief: {
          include: {
            storyDraft: {
              include: {
                sectionDrafts: {
                  where: { status: { not: "removed" } },
                  orderBy: { positionIndex: "asc" },
                  select: {
                    label: true,
                    summary: true,
                    positionIndex: true,
                  },
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
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!story || !story.publishedAt) {
      throw new NotFoundException({
        ok: false,
        error: {
          code: "not_found",
          message: "Story not found or unavailable.",
        },
      });
    }

    const publishedAtIso = story.publishedAt.toISOString();
    const fromSnapshot = parsePublishedBodySnapshotV1(story.publishedBodySnapshot);
    if (fromSnapshot) {
      return {
        slug: story.slug,
        published_at: publishedAtIso,
        ...fromSnapshot,
      };
    }

    /** Pre–M3-T09 publishes: no frozen snapshot — fall back to live draft (legacy). */
    const draft = story.storyBrief?.storyDraft;
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
      sections,
      events,
    };
  }
}
