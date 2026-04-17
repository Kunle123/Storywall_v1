/**
 * M5-T04 — bounded retrieval contracts (shared by worker/API; browser-safe, no Node-only imports).
 * Align Prisma enums in apps/api/prisma/schema.prisma when extending.
 */

/** Mirrors Prisma `SourceRecordType`. */
export type BoundedRetrievalSourceType =
  | "article"
  | "report"
  | "document"
  | "video"
  | "audio"
  | "archive"
  | "social_post"
  | "dataset"
  | "other";

/** Mirrors Prisma `ReliabilityTier`. */
export type BoundedRetrievalReliabilityTier = "high" | "medium" | "low" | "unrated";

/** Mirrors Prisma `SourceExtractionMethod`. */
export type BoundedRetrievalExtractionMethod = "manual" | "ai_extracted" | "imported";

/** One attributable candidate row ready for `research_candidate_source` persistence. */
export type BoundedRetrievalCandidate = {
  sourceUrl: string;
  sourceTitle: string;
  publisherName: string;
  sourceType: BoundedRetrievalSourceType;
  publishedAt: string | null;
  excerpt: string | null;
  relevanceNote: string;
  reliabilityTier: BoundedRetrievalReliabilityTier;
  extractionMethod: BoundedRetrievalExtractionMethod;
  positionIndex: number;
};

export type BoundedRetrievalRunResult =
  | {
      outcome: "ok";
      candidates: BoundedRetrievalCandidate[];
      queryUsed: string;
      retrievedAt: string;
      provider: "wikipedia_search_api";
    }
  | {
      outcome: "partial";
      candidates: BoundedRetrievalCandidate[];
      queryUsed: string;
      retrievedAt: string;
      notes: string;
      provider: "wikipedia_search_api";
    }
  | { outcome: "empty"; queryUsed: string; provider: "wikipedia_search_api" }
  | { outcome: "blocked_by_policy"; reason: string }
  | { outcome: "transport_error"; reason: string };
