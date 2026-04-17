/**
 * Canonical domain enums and API contract version markers (M0-T03).
 * Sources: docs/storywall_api_response_contracts_homepage_timeline.md,
 * storywall_creator_side_mutation_api_contracts.md,
 * storywall_publishing_and_trust_standard.md,
 * storywall_reviewer_permissions_moderation_state_contract.md
 */

export const API_CONTRACT_VERSION = "2026-05-01" as const;

// --- M5-T01 — AI runtime configuration + provider abstraction (non-executable transport) ---
export * from "./ai-runtime";

/** Public reader + CMS subject classification */
export type SubjectType =
  | "person"
  | "organization"
  | "event"
  | "topic"
  | "place"
  | "movement"
  | "conflict"
  | "other";

/** Story-level confidence summary (public reads) */
export type ConfidenceSummary =
  | "verified"
  | "mostly_verified"
  | "mixed"
  | "emerging"
  | "disputed";

/** Event-level confidence (public EventCardPublic; trust standard also lists unsupported/chatter) */
export type ConfidenceState =
  | "verified"
  | "mostly_verified"
  | "emerging"
  | "disputed"
  | "retracted";

/** Creator workflow global state (creator mutation contract §7) */
export type CreatorWorkflowState =
  | "drafting_brief"
  | "awaiting_framing_choice"
  | "researching"
  | "assembling_draft"
  | "ready_for_edit"
  | "needs_validation"
  | "blocked"
  | "ready_to_publish"
  | "published";

/** Reviewer moderation overlay (reviewer contract §8.1) */
export type ModerationState =
  | "none"
  | "queued_for_review"
  | "in_review"
  | "changes_requested"
  | "trust_hold"
  | "director_review"
  | "approved_for_publish"
  | "post_publish_watch"
  | "visibility_restricted"
  | "closed";

/** Imagery posture from brief / editor model */
export type ImageryMode =
  | "selective_editorial"
  | "minimal"
  | "sourced_only"
  | "no_imagery";

/** Editorial lifecycle on `stories.story_status` — storywall_editor_cms_input_model.md §10.1; migration plan §7.3 */
export type StoryLifecycleStatus = "draft" | "review" | "published" | "archived";

/** Visibility target — API public reads use public | unlisted; private for pre-publish — editor §10.1, API §4.5 */
export type StoryVisibility = "public" | "unlisted" | "private";

// --- M1-T03 brief / framing (storywall_editor_cms_input_model.md §7–9); mirrors Prisma enums in apps/api ---

/** §7.1 story_type */
export type BriefStoryType =
  | "biography"
  | "issue_history"
  | "influence"
  | "controversy"
  | "movement_history"
  | "relationship_impact"
  | "custom";

/** §7.1 time_scope_mode */
export type TimeScopeMode = "entire_history" | "bounded_range" | "open_recent" | "custom";

export type BriefAudience = "general" | "fan" | "student" | "specialist" | "custom";

/** §7.1 narrative_intent */
export type NarrativeIntent =
  | "documentary"
  | "explanatory"
  | "analytical"
  | "commemorative"
  | "comparative";

/** Same values as ImageryMode; Prisma enum name BriefImageryMode */
export type BriefImageryMode = ImageryMode;

export type WritingStylePreference = "neutral" | "analytical" | "concise" | "documentary";

export type CreationMode = "ai_first" | "hybrid" | "manual_heavy";

export type BriefRecordStatus = "draft" | "submitted" | "normalized";

export type NormalizationStatus = "pending" | "complete" | "needs_creator_attention";

export type FrameDraftStatus = "proposed" | "selected" | "discarded" | "superseded";

export type FrameSelectionSource = "ai_proposed" | "creator_edited" | "creator_written";

// --- M1-T04 draft / revision (storywall_editor_cms_input_model.md §10.1, §17) ---

export type DiscoveryMode = "editorial" | "recent" | "trending" | "featured";

export type DraftGenerationMode = "manual" | "ai_draft" | "ai_assisted" | "manual_after_ai";

export type EditorialReviewStatus = "unreviewed" | "reviewed" | "approved" | "revised";

export type AutosaveStatus = "saved" | "saving" | "conflict" | "error";

export type RevisionType =
  | "autosave"
  | "manual_edit"
  | "ai_regeneration"
  | "review_resolution"
  | "publish_promotion";

export type ChangedObjectType =
  | "story"
  | "section"
  | "event"
  | "source"
  | "image"
  | "validation"
  | "publish";

// --- M3-T01 validation + draft trust metadata (editor §15) — mirrors Prisma enums in apps/api ---

export type ValidationRunType =
  | "structure"
  | "trust"
  | "style"
  | "publish_readiness"
  | "full";

export type ValidationRunSource = "system" | "creator_requested" | "reviewer_requested";

export type ValidationOverallResult = "pass" | "warn" | "block";

export type ValidationIssueObjectType = "story" | "section" | "event" | "source" | "image";

export type ValidationIssueType =
  | "overclaim"
  | "unsupported"
  | "duplicate"
  | "timeline_gap"
  | "tone_drift"
  | "missing_source"
  | "disputed_view_missing"
  | "imagery_risk"
  | "missing_synthesis"
  | "other";

export type ValidationIssueSeverity = "low" | "medium" | "high";

export type ValidationPublishEffect = "none" | "warn" | "block";

export type ValidationResolutionStatus = "open" | "accepted" | "dismissed" | "resolved";

// --- M1-T05 section / event / source / image proposal (editor §11–14) ---

export type SectionDraftStatus = "draft" | "approved" | "removed";

/** Editor §11 `source` — section provenance */
export type SectionOrigin = "ai_generated" | "creator_added" | "creator_edited";

export type EventDraftKind =
  | "standard"
  | "turning_point"
  | "context_note"
  | "synthesis"
  | "chatter"
  | "corroboration_cluster";

export type SignificanceLevel = "minor" | "standard" | "major" | "critical";

export type EventDatePrecision =
  | "year"
  | "month"
  | "day"
  | "time"
  | "approximate"
  | "unknown";

export type EventMediaKind = "image" | "video" | "document" | "map" | "none";

export type EventSourceDensity = "none" | "low" | "medium" | "high";

/** Same labels as `ConfidenceState` / editor §12.1 */
export type EventConfidenceState = ConfidenceState;

export type ClaimRiskLevel = "low" | "medium" | "high";

/** Per-event moderation — editor §12.1 (distinct from reviewer ModerationState) */
export type EventModerationStatus = "pending" | "approved" | "flagged" | "rejected";

export type EventDraftRowStatus = "draft" | "ready" | "removed" | "published";

export type SourceRecordType =
  | "article"
  | "report"
  | "document"
  | "video"
  | "audio"
  | "archive"
  | "social_post"
  | "dataset"
  | "other";

export type ReliabilityTier = "high" | "medium" | "low" | "unrated";

export type SourceVerificationStatus =
  | "verified"
  | "partially_verified"
  | "unreviewed"
  | "contested"
  | "rejected";

export type SourceExtractionMethod = "manual" | "ai_extracted" | "imported";

export type SourceRecordStatus = "draft" | "approved" | "rejected";

export type ImageProposalTargetType = "story_cover" | "story_share" | "event" | "section";

export type ImageProposalAssetSource =
  | "ai_generated"
  | "licensed"
  | "archival"
  | "manual_upload";

export type ImageStyleMode = "editorial" | "archival" | "illustrative" | "minimal";

export type ImageApprovalStatus = "proposed" | "approved" | "rejected" | "superseded";

// --- M2-T03 chronology extraction (deterministic pipeline from research package) ---
export {
  buildChronologyEventsFromResearchPackage,
  CHRONOLOGY_EXTRACTION_VERSION,
} from "./chronology-extraction";
export type {
  ChronologyExtractionRow,
  ResearchArtifactExtractionInput,
  ResearchCandidateSourceExtractionInput,
} from "./chronology-extraction";

// --- M2-T04 chronology ↔ candidate source corroboration links ---
export {
  buildChronologyEventSourceLinkRows,
} from "./chronology-source-links";
export type {
  ChronologySourceRelationKind,
  ResearchCandidateSourceLinkInput,
} from "./chronology-source-links";

// --- M2-T05 draft assembly idempotency payload ---
export {
  normalizeAssembleDraftPayloadFromStored,
  stableAssembleDraftPayload,
} from "./assemble-draft-payload";
export type { AssembleDraftPayloadInput } from "./assemble-draft-payload";
