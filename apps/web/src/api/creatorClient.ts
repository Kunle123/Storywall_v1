import type {
  CreateStoryBody,
  CreateStorySuccess,
  PatchBriefSuccess,
  PatchStoryBriefBody,
} from "./types";

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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function authHeaders(token: string | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function registerCreator(body: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ access_token: string; creator: { id: string; email: string; display_name: string | null } }> {
  const res = await fetch(`${apiBase()}/auth/register`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify(body),
  });
  const data = (await parseJson(res)) as {
    data?: { access_token: string; creator: { id: string; email: string; display_name: string | null } };
  };
  if (!res.ok) {
    throw new ApiRequestError(`Register failed (${res.status})`, res.status, data);
  }
  if (!data.data?.access_token) throw new ApiRequestError("Invalid register response", res.status, data);
  return data.data;
}

export async function loginCreator(body: {
  email: string;
  password: string;
}): Promise<{ access_token: string; creator: { id: string; email: string; display_name: string | null } }> {
  const res = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify(body),
  });
  const data = (await parseJson(res)) as {
    data?: { access_token: string; creator: { id: string; email: string; display_name: string | null } };
  };
  if (!res.ok) {
    throw new ApiRequestError(`Login failed (${res.status})`, res.status, data);
  }
  if (!data.data?.access_token) throw new ApiRequestError("Invalid login response", res.status, data);
  return data.data;
}

export async function createStory(token: string, body: CreateStoryBody): Promise<CreateStorySuccess> {
  const res = await fetch(`${apiBase()}/creator/stories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Create story failed (${res.status})`, res.status, data);
  }
  return data as CreateStorySuccess;
}

export async function patchStoryBrief(
  token: string,
  storyId: string,
  ifMatch: string,
  body: PatchStoryBriefBody,
): Promise<PatchBriefSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/brief`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "If-Match": ifMatch,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (res.status === 409) {
    throw new ApiRequestError("Conflict", 409, data);
  }
  if (!res.ok) {
    throw new ApiRequestError(`Save failed (${res.status})`, res.status, data);
  }
  return data as PatchBriefSuccess;
}

export function extractConflictBrief(body: unknown): import("./types").StoryBriefResponse | null {
  const b = body as { error?: { details?: { story_brief?: import("./types").StoryBriefResponse } } };
  return b?.error?.details?.story_brief ?? null;
}
