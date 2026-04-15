import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Enforces creator ownership of a story workspace (`stories.id`).
 * Future mutations load `storyId` and call this before writes.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnsStory(storyId: string, creatorId: string): Promise<void> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, creatorId },
      select: { id: true },
    });
    if (!story) {
      const exists = await this.prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException({
          ok: false,
          error: { code: "story_not_found", message: "Story not found" },
        });
      }
      throw new ForbiddenException({
        ok: false,
        error: {
          code: "forbidden",
          message: "Actor cannot mutate the target record",
        },
      });
    }
  }
}
