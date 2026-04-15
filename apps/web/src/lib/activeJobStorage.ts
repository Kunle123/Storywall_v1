const prefix = "storywall:lastJob:";

export function rememberActiveJob(storyId: string, jobId: string): void {
  try {
    sessionStorage.setItem(`${prefix}${storyId}`, jobId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readActiveJob(storyId: string): string | null {
  try {
    return sessionStorage.getItem(`${prefix}${storyId}`);
  } catch {
    return null;
  }
}

export function clearActiveJob(storyId: string): void {
  try {
    sessionStorage.removeItem(`${prefix}${storyId}`);
  } catch {
    /* ignore */
  }
}
