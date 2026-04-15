import type { CreatorWorkflowState } from "@storywall/shared";
import type { StoryBriefResponse } from "../api/types";

const PREFIX = "storywall_brief_v1_";

export interface CachedBriefWorkspace {
  story_brief: StoryBriefResponse;
  story_state: CreatorWorkflowState;
  cached_at: string;
}

export function cacheBriefWorkspace(storyId: string, data: CachedBriefWorkspace): void {
  try {
    localStorage.setItem(PREFIX + storyId, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function loadBriefCache(storyId: string): CachedBriefWorkspace | null {
  try {
    const raw = localStorage.getItem(PREFIX + storyId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedBriefWorkspace;
  } catch {
    return null;
  }
}

/** Remove all cached brief workspaces (call on logout so a new session does not reuse stale drafts). */
export function clearAllBriefCaches(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
