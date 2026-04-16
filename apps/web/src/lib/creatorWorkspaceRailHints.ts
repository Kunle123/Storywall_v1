import type { StoryBriefResponse } from "../api/types";
import type { EditorialDimensionTile } from "./creatorWorkspaceOverview";

function tile(tiles: EditorialDimensionTile[], id: string): EditorialDimensionTile | undefined {
  return tiles.find((x) => x.id === id);
}

/** One-line status pulled from the same honest tiles as the masthead overview. */
export function railPrimaryLine(tiles: EditorialDimensionTile[], id: string): string | null {
  const t = tile(tiles, id);
  return t?.primary ?? null;
}

export function heroRailLine(brief: StoryBriefResponse | null): string | null {
  if (!brief) return null;
  const mode = brief.imagery_mode?.replace(/_/g, " ");
  return mode ? `Imagery policy: ${mode}` : null;
}
