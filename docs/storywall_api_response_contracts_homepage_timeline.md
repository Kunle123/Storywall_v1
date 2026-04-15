# Storywall API Response Contracts for Homepage and Timeline Endpoints

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **reader-facing API response contracts** required to support Storywall v1 homepage discovery surfaces and timeline-reading surfaces. It is intended to give frontend, backend, product, and QA teams one shared read-model contract for the public product.

The contracts in this document are deliberately **read-optimized**. They are not raw database mirrors. They exist to make the homepage and the story timeline fast, predictable, and stable on mobile while preserving Storywall’s key product rules: every published story must remain timeline-rooted, trust must be visible, creator attribution must be clear, and imagery must remain selective rather than overused.

| Contract principle | Implementation consequence |
|---|---|
| **Public reads are composed objects** | Responses should ship fully prepared display fields rather than requiring heavy client inference |
| **Timeline is the primary organizing surface** | Story responses must center chronology, sections, and event ordering |
| **Trust must be legible** | Story cards and timeline events must carry compact trust summaries |
| **Imagery is selective** | Contracts must support image eligibility without assuming all events have images |
| **Mobile-first performance matters** | Contracts should support pagination, lightweight list views, and explicit expansions |

## 2. Contract Scope

This document covers four public read endpoints and one shared error envelope. Together they support the homepage, discovery rails, story detail route, and event-source expansion patterns.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/homepage` | Returns the homepage payload including hero story and discovery rails |
| `GET /api/v1/stories/:slug` | Returns the public timeline story payload |
| `GET /api/v1/stories/:slug/events` | Returns paginated events for long timelines or lazy loading |
| `GET /api/v1/stories/:slug/references` | Returns a story-level flattened references view |
| `GET /api/v1/events/:eventId/sources` | Returns event-level supporting references when expanded |

These are **public reader endpoints** only. They are not creator-editing endpoints, moderation endpoints, or AI orchestration endpoints.

## 3. Common Response Envelope

All successful public read endpoints should use a consistent top-level response envelope so clients can handle caching, hydration, and display logic predictably.

### 3.1 Success envelope

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | Boolean | Yes | Always `true` for successful responses |
| `request_id` | String | Yes | Traceable server request identifier |
| `generated_at` | ISO 8601 DateTime | Yes | Response generation timestamp |
| `api_version` | String | Yes | Response contract version, e.g. `2026-04-14` |
| `data` | Object | Yes | Endpoint-specific payload |
| `meta` | Object | No | Pagination, experiment, caching, or expansion metadata |

### 3.2 Error envelope

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | Boolean | Yes | Always `false` for failures |
| `request_id` | String | Yes | Traceable server request identifier |
| `error.code` | String | Yes | Stable machine-readable error code |
| `error.message` | String | Yes | Human-readable summary |
| `error.details` | Object | No | Optional structured context |

### 3.3 Standard error codes

| Code | Meaning |
|---|---|
| `story_not_found` | The requested public story does not exist |
| `story_not_public` | Story exists but is not publicly readable |
| `invalid_cursor` | Cursor token is invalid or expired |
| `invalid_expand` | Unsupported expansion parameter |
| `validation_failed` | Query parameter validation failed |
| `rate_limited` | Request rejected due to rate policy |
| `internal_error` | Unexpected server failure |

## 4. Shared Public Object Shapes

The endpoint contracts below reuse a small set of public objects. Keeping these object shapes stable is more important than keeping the exact endpoint count stable.

### 4.1 `CreatorPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Public creator identifier |
| `handle` | String | Yes | Public creator handle |
| `display_name` | String | Yes | Reader-facing creator name |
| `avatar_url` | String or `null` | No | Public avatar |
| `bio_short` | String or `null` | No | Compact creator descriptor |
| `is_verified_creator` | Boolean | Yes | Whether Storywall marks the creator as verified |

### 4.2 `TrustBadge`

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | String | Yes | Short reader-facing label |
| `tone` | Enum | Yes | `positive`, `neutral`, `caution`, `warning` |
| `icon` | Enum | Yes | `shield`, `alert`, `info`, `split_view` |
| `explanation` | String | Yes | Plain-language trust summary |

### 4.3 `ImageAssetPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | String | Yes | Public CDN URL |
| `alt` | String | Yes | Accessibility text |
| `credit` | String or `null` | No | Attribution text |
| `kind` | Enum | Yes | `cover`, `share`, `turning_point`, `section`, `none` |
| `editorial_treatment` | Enum | Yes | `generated_editorial`, `licensed`, `archival`, `none` |

### 4.4 `StoryCardPublic`

This object is used in homepage hero and discovery rails.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Story identifier |
| `slug` | String | Yes | Public route slug |
| `title` | String | Yes | Story title |
| `subtitle` | String or `null` | No | Optional secondary line |
| `summary` | String | Yes | Discovery summary |
| `lens` | String or `null` | No | Compact framing line |
| `subject_type` | Enum | Yes | Story subject classification |
| `category_primary` | String | Yes | Editorial category |
| `time_display` | String or `null` | No | Reader-facing time range |
| `cover_image` | `ImageAssetPublic` or `null` | No | Homepage image payload |
| `creator` | `CreatorPublic` | Yes | Owning creator |
| `trust_badge` | `TrustBadge` | Yes | Compact public trust summary |
| `event_count_total` | Integer | Yes | Public event count |
| `source_count_total` | Integer | Yes | Public reference count |
| `turning_point_count` | Integer | Yes | Count of turning points |
| `published_at` | ISO 8601 DateTime | Yes | Publication time |
| `share_url` | String | Yes | Canonical public URL |
| `share_title` | String | Yes | Share-optimized title |
| `share_description` | String | Yes | Share-optimized summary |

### 4.5 `StorySummaryPublic`

This is the compact top block used inside a story detail response.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Story identifier |
| `slug` | String | Yes | Public route slug |
| `title` | String | Yes | Story title |
| `subtitle` | String or `null` | No | Secondary title line |
| `summary` | String | Yes | Public story summary |
| `lens` | String or `null` | No | Creator framing line |
| `conclusion` | String or `null` | No | Final synthesis text |
| `subject_type` | Enum | Yes | Story subject classification |
| `category_primary` | String | Yes | Primary category |
| `category_secondary` | String or `null` | No | Secondary category |
| `time_start` | ISO 8601 DateTime or `null` | No | Earliest meaningful represented time |
| `time_end` | ISO 8601 DateTime or `null` | No | Latest meaningful represented time |
| `time_display` | String or `null` | No | Public time range label |
| `cover_image` | `ImageAssetPublic` or `null` | No | Story hero image payload |
| `creator` | `CreatorPublic` | Yes | Story owner |
| `story_status` | Enum | Yes | Always `published` for public reads |
| `visibility` | Enum | Yes | `public` or `unlisted` |
| `published_at` | ISO 8601 DateTime | Yes | Publish time |
| `updated_at` | ISO 8601 DateTime | Yes | Most recent public update |
| `source_count_total` | Integer | Yes | Public reference count |
| `event_count_total` | Integer | Yes | Public event count |
| `turning_point_count` | Integer | Yes | Total turning points |
| `confidence_summary` | Enum | Yes | Story-level trust summary |
| `trust_badge` | `TrustBadge` | Yes | Compact trust explanation |

### 4.6 `TimelineSectionPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Section identifier |
| `label` | String | Yes | Reader-facing section label |
| `summary` | String or `null` | No | Section framing text |
| `position_index` | Integer | Yes | Section order |
| `time_start` | ISO 8601 DateTime or `null` | No | Section lower time bound |
| `time_end` | ISO 8601 DateTime or `null` | No | Section upper time bound |
| `event_ids` | Array of UUID | Yes | Ordered event membership |

### 4.7 `EventCardPublic`

This is the canonical timeline event object.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Event identifier |
| `slug` | String or `null` | No | Public anchor slug |
| `story_id` | UUID | Yes | Parent story identifier |
| `section_id` | UUID or `null` | No | Parent section identifier |
| `headline` | String | Yes | Event title |
| `dek` | String or `null` | No | Optional explanatory subtitle |
| `summary` | String | Yes | Factual event summary |
| `creator_note` | String or `null` | No | Separate interpretive note |
| `event_type` | Enum | Yes | `standard`, `turning_point`, `context_note`, `synthesis`, `chatter`, `corroboration_cluster` |
| `context_label` | String or `null` | No | Short cue such as `Origin` or `Shift` |
| `significance_level` | Enum | Yes | `minor`, `standard`, `major`, `critical` |
| `event_date_start` | ISO 8601 DateTime or `null` | No | Lower time bound |
| `event_date_end` | ISO 8601 DateTime or `null` | No | Upper time bound |
| `event_date_precision` | Enum | Yes | `year`, `month`, `day`, `time`, `approximate`, `unknown` |
| `display_date` | String or `null` | No | Human-readable date label |
| `year_anchor` | Integer or `null` | No | Timeline rail year |
| `position_index` | Integer | Yes | Story order |
| `interval_note` | String or `null` | No | Optional spacing label, e.g. `3 years later` |
| `media_primary` | `ImageAssetPublic` or `null` | No | Optional media payload |
| `media_kind` | Enum | Yes | `image`, `video`, `document`, `map`, `none` |
| `location_name` | String or `null` | No | Human-readable location |
| `source_count` | Integer | Yes | Number of public attached references |
| `source_density` | Enum | Yes | `none`, `low`, `medium`, `high` |
| `confidence_state` | Enum | Yes | `verified`, `mostly_verified`, `emerging`, `disputed`, `retracted` |
| `moderation_status` | Enum | Yes | Publicly exposed as `approved` only for published reads |
| `is_shareable` | Boolean | Yes | Whether the card can be independently shared |
| `is_pinned` | Boolean | Yes | Whether this event should remain highlighted |
| `is_featured_in_summary` | Boolean | Yes | Whether it contributes to recap blocks |
| `trust_badge` | `TrustBadge` | Yes | Compact event-level trust state |
| `reference_preview` | Array of `ReferenceItemPublic` | No | Optional first references for inline display |

### 4.8 `ReferenceItemPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Source identifier |
| `event_id` | UUID | Yes | Parent event identifier |
| `source_url` | String | Yes | Canonical public URL |
| `source_title` | String | Yes | Public title |
| `publisher_name` | String | Yes | Publisher name |
| `source_type` | Enum | Yes | `article`, `report`, `document`, `video`, `audio`, `archive`, `social_post`, `dataset`, `other` |
| `published_at` | ISO 8601 DateTime or `null` | No | Source publication time |
| `excerpt` | String or `null` | No | Optional excerpt |
| `relevance_note` | String or `null` | No | Why the source matters |
| `reliability_tier` | Enum | Yes | `high`, `medium`, `low`, `unrated` |
| `verification_status` | Enum | Yes | `verified`, `partially_verified`, `unreviewed`, `contested`, `rejected` |
| `is_primary` | Boolean | Yes | Marks a primary source |

## 5. Enum Registry

To avoid client drift, public enums should be centralized and versioned.

| Enum | Allowed values |
|---|---|
| `subject_type` | `person`, `organization`, `event`, `topic`, `place`, `movement`, `conflict`, `other` |
| `confidence_summary` | `verified`, `mostly_verified`, `mixed`, `emerging`, `disputed` |
| `event_type` | `standard`, `turning_point`, `context_note`, `synthesis`, `chatter`, `corroboration_cluster` |
| `significance_level` | `minor`, `standard`, `major`, `critical` |
| `event_date_precision` | `year`, `month`, `day`, `time`, `approximate`, `unknown` |
| `source_density` | `none`, `low`, `medium`, `high` |
| `confidence_state` | `verified`, `mostly_verified`, `emerging`, `disputed`, `retracted` |
| `source_type` | `article`, `report`, `document`, `video`, `audio`, `archive`, `social_post`, `dataset`, `other` |
| `reliability_tier` | `high`, `medium`, `low`, `unrated` |
| `verification_status` | `verified`, `partially_verified`, `unreviewed`, `contested`, `rejected` |
| `trust_badge.tone` | `positive`, `neutral`, `caution`, `warning` |
| `trust_badge.icon` | `shield`, `alert`, `info`, `split_view` |
| `image_asset.kind` | `cover`, `share`, `turning_point`, `section`, `none` |
| `image_asset.editorial_treatment` | `generated_editorial`, `licensed`, `archival`, `none` |

## 6. `GET /api/v1/homepage`

### 6.1 Endpoint purpose

This endpoint returns the entire homepage data model in one call. It should be sufficient to render the lead hero module, supporting discovery rails, and any compact trust or category metadata required on the landing surface.

### 6.2 Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `viewer` | Enum | No | `public` | `public` or `signed_in`; supports small personalization later |
| `limit_per_rail` | Integer | No | `6` | Maximum items returned per discovery rail |
| `include` | CSV String | No | `hero,rails` | Optional expansions: `hero`, `rails`, `topics`, `editor_note` |

### 6.3 Response shape

| Field | Type | Required | Description |
|---|---|---|---|
| `data.hero_story` | `StoryCardPublic` or `null` | Yes | Featured story for the homepage lead |
| `data.rails` | Array of `HomepageRailPublic` | Yes | Ordered discovery rails |
| `data.topics` | Array of `TopicChipPublic` | No | Optional topic chips for filtering or navigation |
| `data.editor_note` | String or `null` | No | Optional editorial framing text |

### 6.4 Supporting objects

#### `HomepageRailPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | String | Yes | Stable rail identifier |
| `label` | String | Yes | Reader-facing rail title |
| `description` | String or `null` | No | Optional explanatory line |
| `rail_type` | Enum | Yes | `featured`, `recent`, `trending`, `category`, `creator_spotlight` |
| `items` | Array of `StoryCardPublic` | Yes | Ordered story cards |
| `see_all_url` | String or `null` | No | Optional route for deeper browse |

#### `TopicChipPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `slug` | String | Yes | Topic identifier |
| `label` | String | Yes | Topic display label |
| `story_count` | Integer | Yes | Number of public stories |

### 6.5 Example response

```json
{
  "ok": true,
  "request_id": "req_01HSW8QW2ZJ7P5A4N8YJ0C91M1",
  "generated_at": "2026-04-14T16:05:00Z",
  "api_version": "2026-04-14",
  "data": {
    "hero_story": {
      "id": "0ca79056-6902-438a-a44b-0af3dfe2a5fe",
      "slug": "whitney-houston-public-voice",
      "title": "Whitney Houston and the making of a singular public voice",
      "subtitle": "A timeline-led biography with visible trust cues and selective imagery.",
      "summary": "A sourced Storywall tracing how family inheritance, industry amplification, film-era expansion, and lasting influence shaped Whitney Houston’s public story.",
      "lens": "Context first. Myth second.",
      "subject_type": "person",
      "category_primary": "biography",
      "time_display": "1963–2012 and after",
      "cover_image": {
        "url": "https://cdn.storywall.example/whitney-hero.webp",
        "alt": "Editorial portrait treatment evoking stage light and archival calm.",
        "credit": "Storywall editorial image",
        "kind": "cover",
        "editorial_treatment": "generated_editorial"
      },
      "creator": {
        "id": "f7371118-34b8-4adb-9802-eb2f8fed0d65",
        "handle": "storywallstudio",
        "display_name": "Storywall Studio",
        "avatar_url": null,
        "bio_short": "Timeline-led context stories",
        "is_verified_creator": true
      },
      "trust_badge": {
        "label": "Grounded timeline",
        "tone": "positive",
        "icon": "shield",
        "explanation": "Built from milestone references with interpretation separated from event summaries."
      },
      "event_count_total": 18,
      "source_count_total": 32,
      "turning_point_count": 3,
      "published_at": "2026-04-10T09:30:00Z",
      "share_url": "https://storywall.example/stories/whitney-houston-public-voice",
      "share_title": "Whitney Houston and the making of a singular public voice",
      "share_description": "A sourced Storywall on the chronology, scale, and legacy of Whitney Houston’s career."
    },
    "rails": [
      {
        "id": "featured_now",
        "label": "Featured now",
        "description": "Editorially selected Storywalls with strong trust posture.",
        "rail_type": "featured",
        "items": [],
        "see_all_url": "/discover/featured"
      },
      {
        "id": "recent_biographies",
        "label": "Recent biographies",
        "description": null,
        "rail_type": "category",
        "items": [],
        "see_all_url": "/discover/biography"
      }
    ],
    "topics": [
      {
        "slug": "music",
        "label": "Music",
        "story_count": 28
      }
    ],
    "editor_note": null
  },
  "meta": {
    "limit_per_rail": 6,
    "cache_ttl_seconds": 120
  }
}
```

## 7. `GET /api/v1/stories/:slug`

### 7.1 Endpoint purpose

This endpoint returns the full public story detail payload required to render the Storywall timeline page. It should support both complete-load rendering for normal stories and partial rendering for very long stories.

### 7.2 Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `include` | CSV String | No | `sections,events,references_preview,trust` | Supported expansions: `sections`, `events`, `references_preview`, `trust`, `related` |
| `event_limit` | Integer | No | `50` | Maximum number of events included inline |
| `event_cursor` | String | No | `null` | Cursor for partial event loading |
| `reference_preview_limit` | Integer | No | `2` | Number of inline references per event |

### 7.3 Response shape

| Field | Type | Required | Description |
|---|---|---|---|
| `data.story` | `StorySummaryPublic` | Yes | Public story header and summary object |
| `data.sections` | Array of `TimelineSectionPublic` | No | Ordered sections if requested |
| `data.events` | Array of `EventCardPublic` | No | Ordered event payloads if requested |
| `data.timeline` | `TimelineMetaPublic` | Yes | Overall timeline navigation metadata |
| `data.trust_panel` | `StoryTrustPanelPublic` | No | Reader-facing trust breakdown |
| `data.related_stories` | Array of `StoryCardPublic` | No | Optional related stories rail |

### 7.4 Supporting objects

#### `TimelineMetaPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `event_count_total` | Integer | Yes | Public event total |
| `event_count_loaded` | Integer | Yes | Event count shipped in this response |
| `has_more_events` | Boolean | Yes | Whether more events exist beyond the current payload |
| `next_event_cursor` | String or `null` | No | Cursor for `stories/:slug/events` |
| `year_anchors` | Array of `YearAnchorPublic` | Yes | Timeline navigation anchors |

#### `YearAnchorPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `year` | Integer | Yes | Timeline year anchor |
| `first_event_id` | UUID | Yes | First event id for that year |
| `count` | Integer | Yes | Number of events attached to that year |

#### `StoryTrustPanelPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `confidence_summary` | Enum | Yes | Story-level confidence state |
| `source_count_total` | Integer | Yes | Total public reference count |
| `primary_source_count` | Integer | Yes | Count of public primary sources |
| `disputed_event_count` | Integer | Yes | Count of disputed events |
| `emerging_event_count` | Integer | Yes | Count of emerging events |
| `chatter_event_count` | Integer | Yes | Count of chatter events |
| `trust_note` | String | Yes | Compact explanation of trust posture |
| `reference_policy_note` | String | Yes | Reader-facing note about how references are shown |
| `creator_revision_note` | String or `null` | No | Optional subtle note when material creator revision exists |

### 7.5 Example response

```json
{
  "ok": true,
  "request_id": "req_01HSW8SSQ1J9M1V4E6VY72EWWX",
  "generated_at": "2026-04-14T16:07:00Z",
  "api_version": "2026-04-14",
  "data": {
    "story": {
      "id": "0ca79056-6902-438a-a44b-0af3dfe2a5fe",
      "slug": "whitney-houston-public-voice",
      "title": "Whitney Houston and the making of a singular public voice",
      "subtitle": "A timeline-led biography with visible trust cues and selective imagery.",
      "summary": "A sourced Storywall tracing how family inheritance, industry amplification, film-era expansion, and lasting influence shaped Whitney Houston’s public story.",
      "lens": "This Storywall frames Houston not only as a superstar vocalist, but as a figure whose career moved across formation, crossover, cinematic expansion, and durable cultural influence.",
      "conclusion": "The timeline ends with legacy rather than loss alone, arguing for Houston as a continuing standard rather than a closed chapter.",
      "subject_type": "person",
      "category_primary": "biography",
      "category_secondary": "music",
      "time_start": "1963-08-09T00:00:00Z",
      "time_end": "2012-02-11T00:00:00Z",
      "time_display": "1963–2012 and after",
      "cover_image": {
        "url": "https://cdn.storywall.example/whitney-hero.webp",
        "alt": "Editorial portrait treatment evoking stage light and archival calm.",
        "credit": "Storywall editorial image",
        "kind": "cover",
        "editorial_treatment": "generated_editorial"
      },
      "creator": {
        "id": "f7371118-34b8-4adb-9802-eb2f8fed0d65",
        "handle": "storywallstudio",
        "display_name": "Storywall Studio",
        "avatar_url": null,
        "bio_short": "Timeline-led context stories",
        "is_verified_creator": true
      },
      "story_status": "published",
      "visibility": "public",
      "published_at": "2026-04-10T09:30:00Z",
      "updated_at": "2026-04-12T12:10:00Z",
      "source_count_total": 32,
      "event_count_total": 18,
      "turning_point_count": 3,
      "confidence_summary": "mostly_verified",
      "trust_badge": {
        "label": "Mostly verified",
        "tone": "positive",
        "icon": "shield",
        "explanation": "Core chronology is well supported; interpretation appears separately as creator framing."
      }
    },
    "sections": [
      {
        "id": "8655f159-6f79-4dc0-aa56-e98f4143bce6",
        "label": "Origins",
        "summary": "Formation before stardom.",
        "position_index": 1,
        "time_start": "1963-01-01T00:00:00Z",
        "time_end": "1982-12-31T00:00:00Z",
        "event_ids": [
          "69d74a0d-f51b-4827-9fe6-a5c112e0c2e8"
        ]
      }
    ],
    "events": [
      {
        "id": "69d74a0d-f51b-4827-9fe6-a5c112e0c2e8",
        "slug": "musical-inheritance-forms",
        "story_id": "0ca79056-6902-438a-a44b-0af3dfe2a5fe",
        "section_id": "8655f159-6f79-4dc0-aa56-e98f4143bce6",
        "headline": "A musical inheritance forms long before global fame arrives",
        "dek": null,
        "summary": "Whitney Houston grew up within a family and church context deeply connected to gospel and popular music, establishing a foundation that predated commercial breakthrough.",
        "creator_note": "This event matters because it frames later success as cultivated rather than sudden.",
        "event_type": "context_note",
        "context_label": "Origins",
        "significance_level": "standard",
        "event_date_start": "1963-08-09T00:00:00Z",
        "event_date_end": "1982-12-31T00:00:00Z",
        "event_date_precision": "year",
        "display_date": "1963–1982",
        "year_anchor": 1963,
        "position_index": 1,
        "interval_note": null,
        "media_primary": null,
        "media_kind": "none",
        "location_name": "Newark, New Jersey",
        "source_count": 3,
        "source_density": "medium",
        "confidence_state": "mostly_verified",
        "moderation_status": "approved",
        "is_shareable": true,
        "is_pinned": false,
        "is_featured_in_summary": true,
        "trust_badge": {
          "label": "Biographical anchor",
          "tone": "positive",
          "icon": "shield",
          "explanation": "Supported by biography and milestone references."
        },
        "reference_preview": [
          {
            "id": "4d4111c6-ab4f-49a8-ba8f-7f0fe0b4bcb7",
            "event_id": "69d74a0d-f51b-4827-9fe6-a5c112e0c2e8",
            "source_url": "https://example.org/source-1",
            "source_title": "Whitney Houston biography",
            "publisher_name": "Example Archive",
            "source_type": "archive",
            "published_at": null,
            "excerpt": null,
            "relevance_note": "Documents early life and family context.",
            "reliability_tier": "high",
            "verification_status": "verified",
            "is_primary": true
          }
        ]
      }
    ],
    "timeline": {
      "event_count_total": 18,
      "event_count_loaded": 18,
      "has_more_events": false,
      "next_event_cursor": null,
      "year_anchors": [
        {
          "year": 1963,
          "first_event_id": "69d74a0d-f51b-4827-9fe6-a5c112e0c2e8",
          "count": 1
        }
      ]
    },
    "trust_panel": {
      "confidence_summary": "mostly_verified",
      "source_count_total": 32,
      "primary_source_count": 6,
      "disputed_event_count": 0,
      "emerging_event_count": 0,
      "chatter_event_count": 0,
      "trust_note": "Core chronology is well supported and creator interpretation is presented separately from event summaries.",
      "reference_policy_note": "References are attached to events and surfaced in compact form inline, with deeper expansion available per event.",
      "creator_revision_note": "Creator revised the final framing after the initial draft."
    },
    "related_stories": []
  },
  "meta": {
    "event_limit": 50,
    "reference_preview_limit": 2,
    "cache_ttl_seconds": 300
  }
}
```

## 8. `GET /api/v1/stories/:slug/events`

### 8.1 Endpoint purpose

This endpoint exists for long timelines, infinite scroll, or partial hydration. It should return events in canonical public order and preserve compatibility with the event objects used in the full story payload.

### 8.2 Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `cursor` | String | No | `null` | Opaque pagination cursor |
| `limit` | Integer | No | `25` | Number of events to return |
| `include` | CSV String | No | `references_preview` | Optional expansions: `references_preview`, `trust` |
| `reference_preview_limit` | Integer | No | `2` | Inline reference count |

### 8.3 Response shape

| Field | Type | Required | Description |
|---|---|---|---|
| `data.story_id` | UUID | Yes | Parent story identifier |
| `data.story_slug` | String | Yes | Parent story slug |
| `data.items` | Array of `EventCardPublic` | Yes | Ordered event payloads |
| `meta.limit` | Integer | Yes | Page size |
| `meta.next_cursor` | String or `null` | No | Cursor for the next page |
| `meta.has_more` | Boolean | Yes | Whether more results remain |

### 8.4 Ordering rule

The endpoint must return events ordered by `position_index`, then `event_date_start`, then `created_at`. Clients should never need to re-sort timeline events.

## 9. `GET /api/v1/stories/:slug/references`

### 9.1 Endpoint purpose

This endpoint provides a flattened references rail for readers who want a story-level evidence view without opening each event individually.

### 9.2 Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `cursor` | String | No | `null` | Opaque pagination cursor |
| `limit` | Integer | No | `50` | Number of sources to return |
| `source_type` | Enum | No | `all` | Optional filter by public source type |
| `verification_status` | Enum | No | `all` | Optional filter by verification posture |

### 9.3 Response shape

| Field | Type | Required | Description |
|---|---|---|---|
| `data.story_id` | UUID | Yes | Parent story identifier |
| `data.story_slug` | String | Yes | Parent story slug |
| `data.items` | Array of `ReferenceGroupPublic` | Yes | References grouped by event |
| `meta.total_public_sources` | Integer | Yes | Total visible sources |
| `meta.next_cursor` | String or `null` | No | Cursor for the next page |
| `meta.has_more` | Boolean | Yes | Whether more results remain |

#### `ReferenceGroupPublic`

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | UUID | Yes | Event identifier |
| `event_headline` | String | Yes | Reader-facing parent event headline |
| `event_display_date` | String or `null` | No | Human-readable parent event date |
| `items` | Array of `ReferenceItemPublic` | Yes | Public sources for that event |

## 10. `GET /api/v1/events/:eventId/sources`

### 10.1 Endpoint purpose

This endpoint powers “show references” interactions on an individual event card. It should match the event-level trust posture shown inline and avoid exposing hidden or non-public sources.

### 10.2 Query parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | Integer | No | `20` | Number of public sources returned |
| `cursor` | String | No | `null` | Opaque pagination cursor |

### 10.3 Response shape

| Field | Type | Required | Description |
|---|---|---|---|
| `data.event_id` | UUID | Yes | Parent event identifier |
| `data.event_headline` | String | Yes | Parent event title |
| `data.confidence_state` | Enum | Yes | Event confidence state |
| `data.items` | Array of `ReferenceItemPublic` | Yes | Public supporting references |
| `meta.next_cursor` | String or `null` | No | Cursor for next page |
| `meta.has_more` | Boolean | Yes | Whether more references remain |

## 11. Expansion and Trimming Rules

Public responses should remain predictable and intentionally limited. The frontend must know when data is complete and when it is a preview.

| Rule | Standard |
|---|---|
| **Inline event references** | Preview only, capped by `reference_preview_limit` |
| **Full event references** | Retrieved via `events/:eventId/sources` |
| **Long timelines** | Use `stories/:slug/events` with cursor pagination |
| **Homepage cards** | Never include full event arrays |
| **Related stories** | Must reuse `StoryCardPublic` shape |
| **Non-public sources** | Must never appear in reader endpoints |
| **Rejected or hidden events** | Must never appear in public story payloads |

## 12. Trust and Presentation Rules in the Contract

The API contract must actively reinforce Storywall’s publishing standards rather than merely transport content.

| Product rule | API implication |
|---|---|
| **Fact and commentary remain separate** | `summary` and `creator_note` must remain distinct fields |
| **Timeline is mandatory** | Story detail payload must always include `timeline` metadata even when events are paginated |
| **Trust is visible** | Both story and event objects carry `trust_badge` payloads |
| **Selective imagery** | `media_primary` may be `null`; clients must not assume images per event |
| **Low-confidence chatter is de-emphasized** | `event_type` and `confidence_state` are explicit and available to styling logic |
| **Creator attribution is required** | Story cards and detail payloads always include `creator` |

## 13. Caching and Freshness Guidance

These contracts are public-read heavy and should be optimized for fast repeat access.

| Endpoint | Suggested cache posture |
|---|---|
| `/homepage` | Short cache, e.g. 1–2 minutes |
| `/stories/:slug` | Moderate cache with purge on publish/update |
| `/stories/:slug/events` | Moderate cache keyed by cursor and publish revision |
| `/stories/:slug/references` | Moderate cache keyed by story revision |
| `/events/:eventId/sources` | Moderate cache keyed by event revision |

## 14. Backward-Compatibility Rules

These response contracts should be versioned conservatively. Frontend and mobile clients will be easier to maintain if the backend follows a few strict compatibility rules.

| Rule | Standard |
|---|---|
| **Additive changes preferred** | New optional fields are allowed without endpoint version bump |
| **Enum changes are breaking** | New public enum values require explicit contract review |
| **Required field removal is breaking** | Must trigger versioned endpoint change |
| **Object renaming is breaking** | Must trigger versioned endpoint change |
| **Preview truncation must be explicit** | Use metadata or dedicated preview semantics rather than silent dropping |

## 15. Acceptance Criteria

The API response contracts should be considered implementation-ready only if all of the following are true.

| ID | Acceptance criterion |
|---|---|
| **API-1** | Homepage can render completely from `/api/v1/homepage` without additional story fetches |
| **API-2** | Story detail can render hero, timeline, trust rail, creator attribution, and synthesis from `/api/v1/stories/:slug` |
| **API-3** | Event objects preserve factual summary, creator note, trust state, and reference preview as separate concepts |
| **API-4** | Long stories can paginate events without changing event object shape |
| **API-5** | Reader endpoints never expose hidden, rejected, or non-public sources |
| **API-6** | Event imagery is optional and selective; clients are never forced to assume image presence |
| **API-7** | Trust cues are available on both homepage cards and timeline events |
| **API-8** | References can be viewed both inline and through dedicated expansion endpoints |

## 16. Final Recommendation

The most important implementation choice is to treat these contracts as **public read models**, not as thin wrappers over raw tables. That is what will keep the Storywall homepage fast, the timeline coherent, and the trust layer understandable.

Once these contracts are adopted, the next specification should define the **database migration plan for the actual stack**, followed by the **editor/CMS input model**, so that storage, mutation flows, and reader payloads all align.
