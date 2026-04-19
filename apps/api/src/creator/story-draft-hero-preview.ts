import type { StoryDraft } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { pickStoryHeroFromProposals, type PublishedPublicPrimaryImageV1 } from "../published-body-snapshot";

/** Approved `story_cover` rows for anonymous-style hero preview on creator draft payloads. */
export async function loadStoryCoverHeroPreviewForDraft(
  prisma: PrismaService,
  draft: StoryDraft,
): Promise<PublishedPublicPrimaryImageV1 | null> {
  const proposals = await prisma.imageProposal.findMany({
    where: { storyDraftId: draft.id, targetType: "story_cover", approvalStatus: "approved" },
    orderBy: [{ isPublicSelected: "desc" }, { updatedAt: "desc" }],
    select: {
      targetType: true,
      approvalStatus: true,
      assetUrl: true,
      assetAlt: true,
      assetCredit: true,
      isPublicSelected: true,
    },
  });
  return pickStoryHeroFromProposals(draft.imageryMode, proposals);
}
