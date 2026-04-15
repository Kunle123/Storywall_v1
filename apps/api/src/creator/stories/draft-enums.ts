/** String unions for PATCH story draft DTO (mutation §12.1). */

export const DISCOVERY_MODE = [
  "editorial",
  "recent",
  "trending",
  "featured",
] as const;

export const STORY_VISIBILITY = ["public", "unlisted", "private"] as const;

export const EDITORIAL_REVIEW_STATUS = [
  "unreviewed",
  "reviewed",
  "approved",
  "revised",
] as const;
