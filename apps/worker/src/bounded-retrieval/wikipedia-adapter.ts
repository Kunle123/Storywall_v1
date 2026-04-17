import type {
  BoundedRetrievalCandidate,
  BoundedRetrievalPolicy,
  BoundedRetrievalRunResult,
  LiveBoundedRetrievalPolicy,
} from "@storywall/shared";
import type { ResearchJobWithStoryBrief } from "../m2-t02-stub.js";

const WIKI_API_HOST = "en.wikipedia.org";
const WIKI_API_ORIGIN = `https://${WIKI_API_HOST}`;

function stripWikiHtmlSnippet(snippet: string): string {
  return snippet.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** Wikipedia article URL for a canonical `title` from the search API. */
export function wikipediaArticleUrlForTitle(title: string): string {
  const seg = encodeURIComponent(title).replace(/%20/g, "_");
  const u = new URL(`${WIKI_API_ORIGIN}/wiki/${seg}`);
  if (u.hostname !== WIKI_API_HOST) {
    throw new Error("internal_url_host_mismatch");
  }
  if (u.protocol !== "https:") {
    throw new Error("internal_url_protocol");
  }
  return u.href;
}

function buildSearchUrl(query: string, limit: number): URL {
  const u = new URL(`${WIKI_API_ORIGIN}/w/api.php`);
  u.searchParams.set("action", "query");
  u.searchParams.set("list", "search");
  u.searchParams.set("format", "json");
  u.searchParams.set("srsearch", query);
  u.searchParams.set("srlimit", String(limit));
  return u;
}

async function readResponseTextWithByteLimit(res: Response, maxBytes: number): Promise<string> {
  const cl = res.headers.get("content-length");
  if (cl) {
    const n = Number.parseInt(cl, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error(`response Content-Length ${n} exceeds cap ${maxBytes}`);
    }
  }
  const text = await res.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new Error(`response body exceeds cap ${maxBytes} bytes`);
  }
  return text;
}

function subjectLineFromJob(rj: ResearchJobWithStoryBrief): string {
  const brief = rj.story.storyBrief;
  return (
    brief?.normalizedSubject?.trim() ||
    brief?.subject?.trim().slice(0, 200) ||
    rj.story.title
  ).trim();
}

/**
 * Bounded Wikipedia `action=query&list=search` retrieval (M5-T04).
 * Only ever fetches `https://en.wikipedia.org/w/api.php` — host must appear in policy allowlist.
 */
export async function runBoundedWikipediaRetrieval(args: {
  rj: ResearchJobWithStoryBrief;
  policy: LiveBoundedRetrievalPolicy;
  fetchFn?: typeof fetch;
}): Promise<BoundedRetrievalRunResult> {
  const fetchFn = args.fetchFn ?? fetch;
  const { policy, rj } = args;

  if (!policy.allowedApiHosts.includes(WIKI_API_HOST)) {
    return {
      outcome: "blocked_by_policy",
      reason: `Host ${WIKI_API_HOST} must be included in STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS for the Wikipedia adapter.`,
    };
  }

  const rawQuery = subjectLineFromJob(rj);
  const queryUsed = rawQuery.slice(0, policy.maxQueryChars).trim();
  if (queryUsed.length === 0) {
    return { outcome: "blocked_by_policy", reason: "Research query derived from the story brief is empty after trimming." };
  }

  const searchUrl = buildSearchUrl(queryUsed, policy.maxCandidates);
  if (searchUrl.hostname !== WIKI_API_HOST) {
    return { outcome: "transport_error", reason: "Internal error: constructed Wikipedia API URL failed host validation." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
  const retrievedAt = new Date().toISOString();

  try {
    const res = await fetchFn(searchUrl.href, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": policy.userAgent,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        outcome: "transport_error",
        reason: `Wikipedia API HTTP ${res.status} ${res.statusText}`.slice(0, 500),
      };
    }

    const text = await readResponseTextWithByteLimit(res, policy.maxResponseBytes);
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { outcome: "transport_error", reason: "Wikipedia API returned non-JSON body." };
    }

    const root = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
    const query = root?.query;
    const qObj = query && typeof query === "object" && !Array.isArray(query) ? (query as Record<string, unknown>) : null;
    const search = qObj?.search;
    if (!Array.isArray(search)) {
      return { outcome: "transport_error", reason: "Wikipedia API JSON missing query.search array." };
    }

    const out: BoundedRetrievalCandidate[] = [];

    for (let i = 0; i < search.length && i < policy.maxCandidates; i++) {
      const row = search[i];
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) continue;
      const snippetRaw = typeof o.snippet === "string" ? o.snippet : "";
      let sourceUrl: string;
      try {
        sourceUrl = wikipediaArticleUrlForTitle(title);
      } catch {
        continue;
      }
      const u = new URL(sourceUrl);
      if (u.hostname !== WIKI_API_HOST || u.protocol !== "https:") {
        continue;
      }

      const excerpt = snippetRaw ? stripWikiHtmlSnippet(snippetRaw).slice(0, 1200) : null;
      out.push({
        sourceUrl,
        sourceTitle: title,
        publisherName: "Wikimedia Foundation (Wikipedia)",
        sourceType: "article",
        publishedAt: null,
        excerpt,
        relevanceNote:
          "Retrieved via bounded Wikipedia search API (M5-T04). Article content is not fetched in this milestone; verify claims independently.",
        reliabilityTier: "medium",
        extractionMethod: "imported",
        positionIndex: out.length,
      });
    }

    if (out.length === 0) {
      return { outcome: "empty", queryUsed, provider: "wikipedia_search_api" };
    }

    const hitsReturned = search.length;
    if (hitsReturned < policy.maxCandidates || out.length < policy.maxCandidates) {
      return {
        outcome: "partial",
        candidates: out,
        queryUsed,
        retrievedAt,
        notes:
          hitsReturned < policy.maxCandidates
            ? `Wikipedia returned ${hitsReturned} search row(s); ceiling was ${policy.maxCandidates}.`
            : `Fewer normalized candidates than ceiling after URL/title safety checks (${out.length} of ${policy.maxCandidates}).`,
        provider: "wikipedia_search_api",
      };
    }

    return {
      outcome: "ok",
      candidates: out,
      queryUsed,
      retrievedAt,
      provider: "wikipedia_search_api",
    };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "AbortError") {
      return {
        outcome: "transport_error",
        reason: `Wikipedia API request timed out after ${policy.timeoutMs}ms.`,
      };
    }
    return { outcome: "transport_error", reason: `Wikipedia API fetch failed: ${msg}`.slice(0, 800) };
  } finally {
    clearTimeout(timer);
  }
}

export function liveRetrievalFailureMessage(
  policy: BoundedRetrievalPolicy,
  result: BoundedRetrievalRunResult | undefined,
): string | null {
  if (policy.mode !== "live") {
    return null;
  }
  if (!result) {
    return "Retrieval did not return a result.";
  }
  if (result.outcome === "blocked_by_policy") {
    return result.reason;
  }
  if (result.outcome === "transport_error") {
    return result.reason;
  }
  if (result.outcome === "empty") {
    return "Retrieval returned no Wikipedia search hits for the bounded query.";
  }
  if (result.outcome === "ok" || result.outcome === "partial") {
    if (result.candidates.length === 0) {
      return "Retrieval produced zero attributable candidates after normalization.";
    }
    return null;
  }
  return "Retrieval failed for an unknown reason.";
}
