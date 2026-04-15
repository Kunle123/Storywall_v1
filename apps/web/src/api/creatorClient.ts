import type {
  AssembleDraftBody,
  AssembleDraftSuccess,
  CreateStoryBody,
  CreateStorySuccess,
  ListFramesSuccess,
  PatchBriefSuccess,
  PatchDraftSuccess,
  PatchStoryBriefBody,
  PatchEventBody,
  PatchSourceBody,
  PatchSectionBody,
  PatchStoryDraftBody,
  CreateEventBody,
  CreateEventSuccess,
  CreateSourceBody,
  CreateSourceSuccess,
  CreateSectionBody,
  CreateSectionSuccess,
  ListEventsSuccess,
  ListSourcesSuccess,
  ListSectionsSuccess,
  PatchSectionSuccess,
  PatchEventSuccess,
  PatchSourceSuccess,
  PollJobSuccess,
  EventDraftResponse,
  SourceRecordResponse,
  SectionDraftResponse,
  RunResearchPassBody,
  RunResearchPassSuccess,
  SelectFrameSuccess,
  StoryDraftResponse,
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

export async function patchStoryDraft(
  token: string,
  storyId: string,
  ifMatch: string,
  body: PatchStoryDraftBody,
): Promise<PatchDraftSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/draft`, {
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
    throw new ApiRequestError(`Draft save failed (${res.status})`, res.status, data);
  }
  return data as PatchDraftSuccess;
}

export function extractConflictBrief(body: unknown): import("./types").StoryBriefResponse | null {
  const b = body as { error?: { details?: { story_brief?: import("./types").StoryBriefResponse } } };
  return b?.error?.details?.story_brief ?? null;
}

export function extractConflictDraft(body: unknown): StoryDraftResponse | null {
  const b = body as { error?: { details?: { story_draft?: StoryDraftResponse } } };
  return b?.error?.details?.story_draft ?? null;
}

export function extractConflictSection(body: unknown): SectionDraftResponse | null {
  const b = body as { error?: { details?: { section_draft?: SectionDraftResponse } } };
  return b?.error?.details?.section_draft ?? null;
}

export function extractConflictEvent(body: unknown): EventDraftResponse | null {
  const b = body as { error?: { details?: { event_draft?: EventDraftResponse } } };
  return b?.error?.details?.event_draft ?? null;
}

export function extractConflictSource(body: unknown): SourceRecordResponse | null {
  const b = body as { error?: { details?: { source_record?: SourceRecordResponse } } };
  return b?.error?.details?.source_record ?? null;
}

export async function listSections(token: string, storyId: string): Promise<ListSectionsSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/sections`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`List sections failed (${res.status})`, res.status, data);
  }
  return data as ListSectionsSuccess;
}

export async function createSection(
  token: string,
  storyId: string,
  body: CreateSectionBody,
): Promise<CreateSectionSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/sections`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Create section failed (${res.status})`, res.status, data);
  }
  return data as CreateSectionSuccess;
}

export async function patchSection(
  token: string,
  storyId: string,
  sectionId: string,
  ifMatch: string,
  body: PatchSectionBody,
): Promise<PatchSectionSuccess> {
  const res = await fetch(
    `${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/sections/${encodeURIComponent(sectionId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "If-Match": ifMatch,
      },
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson(res);
  if (res.status === 409) {
    throw new ApiRequestError("Conflict", 409, data);
  }
  if (!res.ok) {
    throw new ApiRequestError(`Section save failed (${res.status})`, res.status, data);
  }
  return data as PatchSectionSuccess;
}

export async function listEvents(token: string, storyId: string): Promise<ListEventsSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`List events failed (${res.status})`, res.status, data);
  }
  return data as ListEventsSuccess;
}

export async function createEvent(
  token: string,
  storyId: string,
  body: CreateEventBody,
): Promise<CreateEventSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Create event failed (${res.status})`, res.status, data);
  }
  return data as CreateEventSuccess;
}

export async function patchEvent(
  token: string,
  storyId: string,
  eventId: string,
  ifMatch: string,
  body: PatchEventBody,
): Promise<PatchEventSuccess> {
  const res = await fetch(
    `${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "If-Match": ifMatch,
      },
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson(res);
  if (res.status === 409) {
    throw new ApiRequestError("Conflict", 409, data);
  }
  if (!res.ok) {
    throw new ApiRequestError(`Event save failed (${res.status})`, res.status, data);
  }
  return data as PatchEventSuccess;
}

export async function listSourcesForEvent(
  token: string,
  storyId: string,
  eventId: string,
): Promise<ListSourcesSuccess> {
  const res = await fetch(
    `${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}/sources`,
    { headers: authHeaders(token) },
  );
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`List sources failed (${res.status})`, res.status, data);
  }
  return data as ListSourcesSuccess;
}

export async function createSource(
  token: string,
  storyId: string,
  eventId: string,
  body: CreateSourceBody,
): Promise<CreateSourceSuccess> {
  const res = await fetch(
    `${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}/sources`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Create source failed (${res.status})`, res.status, data);
  }
  return data as CreateSourceSuccess;
}

export async function patchSource(
  token: string,
  storyId: string,
  eventId: string,
  sourceId: string,
  ifMatch: string,
  body: PatchSourceBody,
): Promise<PatchSourceSuccess> {
  const res = await fetch(
    `${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/events/${encodeURIComponent(eventId)}/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "If-Match": ifMatch,
      },
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson(res);
  if (res.status === 409) {
    throw new ApiRequestError("Conflict", 409, data);
  }
  if (!res.ok) {
    throw new ApiRequestError(`Source save failed (${res.status})`, res.status, data);
  }
  return data as PatchSourceSuccess;
}

export async function listFrames(token: string, storyId: string): Promise<ListFramesSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/frames`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`List frames failed (${res.status})`, res.status, data);
  }
  return data as ListFramesSuccess;
}

export async function selectFrame(
  token: string,
  storyId: string,
  body: { frame_id: string; selection_mode: "accept" },
  idempotencyKey: string,
): Promise<SelectFrameSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/frames/select`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Select frame failed (${res.status})`, res.status, data);
  }
  return data as SelectFrameSuccess;
}

/** Mutation §6 — poll long-running jobs (research_run or draft_assemble). */
export async function getCreatorJob(token: string, jobId: string): Promise<PollJobSuccess> {
  const res = await fetch(`${apiBase()}/creator/jobs/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Get job failed (${res.status})`, res.status, data);
  }
  return data as PollJobSuccess;
}

/** Mutation §11.1 */
export async function runResearchPass(
  token: string,
  storyId: string,
  body: RunResearchPassBody,
  idempotencyKey: string,
): Promise<RunResearchPassSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/research/run`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Research run failed (${res.status})`, res.status, data);
  }
  return data as RunResearchPassSuccess;
}

/** Mutation §11.2 */
export async function assembleDraft(
  token: string,
  storyId: string,
  body: AssembleDraftBody,
  idempotencyKey: string,
): Promise<AssembleDraftSuccess> {
  const res = await fetch(`${apiBase()}/creator/stories/${encodeURIComponent(storyId)}/draft/assemble`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiRequestError(`Draft assembly failed (${res.status})`, res.status, data);
  }
  return data as AssembleDraftSuccess;
}
