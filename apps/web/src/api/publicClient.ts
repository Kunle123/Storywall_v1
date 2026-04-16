import { ApiRequestError } from "./creatorClient";
import type { GetPublicStoryReferencesSuccess, GetPublicStorySuccess } from "./publicTypes";

function apiBase(): string {
  const u = import.meta.env.VITE_API_URL;
  if (u) return `${String(u).replace(/\/$/, "")}/api/v1`;
  return "/api/v1";
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

/** M3-T08 + M3-T10 + M3-T11 — GET …/stories/:slug (no auth). */
export async function getPublicStory(slug: string): Promise<GetPublicStorySuccess> {
  const res = await fetch(`${apiBase()}/stories/${encodeURIComponent(slug)}`);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Public story failed (${res.status})`, res.status, data);
  }
  return data as GetPublicStorySuccess;
}

/** M3-T12 — GET …/stories/:slug/references (no auth). */
export async function getPublicStoryReferences(slug: string): Promise<GetPublicStoryReferencesSuccess> {
  const res = await fetch(`${apiBase()}/stories/${encodeURIComponent(slug)}/references`);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Public references failed (${res.status})`, res.status, data);
  }
  return data as GetPublicStoryReferencesSuccess;
}
