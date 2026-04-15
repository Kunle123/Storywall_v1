# Storywall Database Migration Plan for the Actual Stack

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **database migration plan for the actual Storywall implementation stack**. Its job is to translate the approved Storywall schema, creator workflow, publishing rules, and public API contracts into a production-safe sequence of database changes.

The important practical constraint is that the current codebase is still operating as a **frontend-first static application with a minimal Express runtime placeholder**, not yet as a mature data-backed editorial platform. The migration plan therefore cannot assume an existing, well-structured relational backend with stable models, migrations, or read-model tables already in place. Instead, it must describe how Storywall should move from its current lightweight state into a database-backed system without breaking public reads, creator workflows, or future moderation capabilities.

| Planning premise | Migration consequence |
|---|---|
| **The product model is already defined** | Database changes should follow the approved Storywall schema rather than inventing new editorial concepts |
| **The current app is not yet database-centric** | The migration plan must include a stack-foundation phase before content-model migrations |
| **Public reads are now contract-defined** | Database rollout must support homepage and timeline read models explicitly |
| **Trust is a first-class feature** | Source, confidence, moderation, and contributor-trust entities must be introduced early |
| **There is no legacy story corpus to preserve** | The migration plan can optimize for clean rollout instead of expensive historical content migration |

## 2. Current-State Assessment of the Actual Stack

The current project state matters because migration risk depends on where the software really is, not on the final product vision alone.

| Layer | Current state | Migration implication |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind 4, Wouter, component-driven UI | Reader and creator surfaces can be built against stable typed API contracts once backend exists |
| **Server runtime** | Minimal Express server acting primarily as a static file host | API routes, authentication guards, database access, and background workflows still need to be added |
| **Database layer** | Not present in the current checked-in application stack | A database capability upgrade is a prerequisite for real migrations |
| **ORM / query layer** | Not present in the current checked-in application stack | Migration tooling and schema ownership must be chosen before table rollout |
| **Public API contracts** | Defined in a separate Storywall specification document | The database should support those read models rather than expose raw tables directly |
| **Editorial workflow rules** | Defined in PRD, creator workflow, and trust-standard documents | Tables and constraints must preserve separation of fact, creator framing, references, and trust states |

The practical meaning of this assessment is simple: the Storywall “migration plan” is not only about altering a mature existing schema. It is also about establishing the **database-backed application layer** that can host the approved model. Because the project currently has no active relational persistence inside the checked-in stack, the first migration stage is really a **platform enablement stage**.

## 3. Migration Goals

The migration program should be judged against five goals.

| Goal | Explanation |
|---|---|
| **Goal 1 — Establish a relational core** | Introduce the database, migration tooling, and application data access layer that Storywall currently lacks |
| **Goal 2 — Preserve product vocabulary** | Implement the exact approved concepts: stories, sections, events, sources, trust snapshots, and contributor trust |
| **Goal 3 — Support safe staged rollout** | Allow the application to evolve from schema introduction to read-model adoption without all teams changing everything at once |
| **Goal 4 — Keep public read stability high** | Ensure homepage and timeline endpoints can be introduced with predictable contracts and minimal breaking change risk |
| **Goal 5 — Make trust auditable** | Guarantee that source sufficiency, moderation, and confidence states are stored explicitly rather than inferred from free text |

## 4. Recommended Target Runtime Architecture

Although the current project is still frontend-first, Storywall’s approved product requirements clearly imply a backend-backed system. The migration plan should therefore target the following runtime shape.

| Layer | Recommended target state |
|---|---|
| **Application runtime** | Node/TypeScript backend added to the existing Express-capable project |
| **Database** | Relational PostgreSQL-compatible database |
| **Migration ownership** | Code-defined schema migrations committed in the repository |
| **Data access** | Typed server-side query layer with explicit read-model assembly |
| **Read models** | Public reader payloads composed in server code, not read directly from normalized tables |
| **Background work** | Async jobs or queued tasks for AI generation, trust recomputation, backfills, and derived-field refresh |

This target architecture is recommended because Storywall needs **ordered timelines, relational corroboration, auditable trust states, filtered public visibility, and derived read models**. Those requirements fit a relational model much better than a purely document-style store.

## 5. Migration Strategy Summary

The safest strategy is a **seven-phase migration program**. It separates platform setup, schema introduction, trust rollout, read-model support, creator-workflow support, validation, and cutover.

| Phase | Name | Primary outcome |
|---|---|---|
| **Phase 0** | Platform enablement | Database-backed backend capability exists |
| **Phase 1** | Core editorial schema introduction | Story, section, and event structures exist |
| **Phase 2** | Trust and corroboration schema introduction | Event sources and trust-state tables exist |
| **Phase 3** | Derived-field and read-model support | Homepage and timeline read performance becomes practical |
| **Phase 4** | Creator workflow support | Drafting, moderation, and publish-state transitions become database-backed |
| **Phase 5** | Backfill, integrity validation, and dry-run reads | The system proves it can serve valid content safely |
| **Phase 6** | API cutover and operational hardening | Public endpoints and editorial tooling move onto the new schema |

## 6. Phase 0 — Platform Enablement

This phase exists because the current checked-in stack does not yet contain a true database implementation.

| Work item | Description | Exit condition |
|---|---|---|
| **Enable backend capability** | Upgrade the project from frontend-only shape to a stack that can host protected API routes, database access, and server-side workflows | Backend runtime exists in the application architecture |
| **Provision relational database** | Create the production-like PostgreSQL environment for local, staging, and production use | Separate environments exist and can be reached securely |
| **Choose migration toolchain** | Select and configure a TypeScript-friendly schema and migration layer | Migration commands exist and are repeatable |
| **Establish environment contracts** | Define connection-string handling, SSL requirements, and secret management | Environments can connect predictably |
| **Create migration baseline** | Commit the first empty or base migration so all later changes are versioned from one known point | Baseline migration is applied in every environment |

This phase should **not** attempt to introduce Storywall editorial tables immediately. Its objective is to make database change management real and auditable.

## 7. Phase 1 — Core Editorial Schema Introduction

Once database infrastructure exists, the next step is to introduce the normalized editorial core.

### 7.1 Tables introduced in Phase 1

| Table | Purpose | Notes |
|---|---|---|
| `stories` | Primary editorial unit and public story header | Adds framing, summary, conclusion, share metadata, counts, and publication state |
| `story_sections` | Optional grouped timeline structure | Enables jump navigation and grouped chronology |
| `events` | Core narrative timeline unit | Stores factual summary, creator note, event type, ordering, confidence, and media fields |
| `story_topic_tags` or equivalent join table | Discovery classification | Supports category and topic rails |

### 7.2 Phase 1 design rules

| Rule | Why it matters |
|---|---|
| **Fact and interpretation must remain separate columns** | Public contracts already depend on `summary` and `creator_note` being different concepts |
| **Ordering must be explicit** | `position_index` is necessary because timelines are editorial, not merely chronological |
| **Publication state must be explicit** | Public reads cannot infer visibility from null checks or ad hoc conventions |
| **Image fields must remain optional** | Storywall’s imagery policy is selective rather than universal |

### 7.3 Recommended constraints for Phase 1

| Entity | Constraint |
|---|---|
| `stories.slug` | Unique among public stories |
| `events.story_id` | Required foreign key to `stories.id` |
| `events.position_index` | Required, non-null |
| `story_sections.story_id` | Required foreign key |
| `events.section_id` | Nullable foreign key |
| `stories.story_status` | Enum-constrained |
| `stories.visibility` | Enum-constrained |
| `events.event_type` | Enum-constrained |
| `events.confidence_state` | Enum-constrained |

### 7.4 Recommended indices for Phase 1

| Table | Index |
|---|---|
| `stories` | `(story_status, visibility, published_at)` |
| `stories` | `(lead_priority, published_at)` |
| `stories` | `(category_primary, published_at)` |
| `events` | `(story_id, position_index)` |
| `events` | `(story_id, year_anchor, position_index)` |
| `story_sections` | `(story_id, position_index)` |

## 8. Phase 2 — Trust and Corroboration Schema Introduction

This phase adds the structures that allow Storywall to make trust visible and auditable.

### 8.1 Tables introduced in Phase 2

| Table | Purpose | Notes |
|---|---|---|
| `event_sources` | Event-level corroborating references | This is the core evidence table for public trust display |
| `event_trust_snapshots` | Auditable trust-state changes over time | Recommended for moderation history and recomputation traceability |
| `contributor_trust_profiles` | Contributor trust banding | Needed if Storywall expands beyond a single tightly controlled creator role |

### 8.2 Phase 2 design rules

| Rule | Why it matters |
|---|---|
| **Sources belong to events, not only to stories** | Storywall’s trust design is event-grounded, not a flat story bibliography |
| **Verification and reliability are distinct** | A source can be low quality but reviewed, or reputable but still not sufficient alone |
| **Public visibility must be explicit** | Not every stored source should be shown to readers |
| **Trust history should be replayable** | Trust changes must be inspectable rather than overwritten invisibly |

### 8.3 Recommended constraints for Phase 2

| Entity | Constraint |
|---|---|
| `event_sources.event_id` | Required foreign key to `events.id` |
| `event_sources.source_url` | Required |
| `event_sources.source_title` | Required |
| `event_sources.publisher_name` | Required |
| `event_sources.source_type` | Enum-constrained |
| `event_sources.reliability_tier` | Enum-constrained |
| `event_sources.verification_status` | Enum-constrained |
| `event_trust_snapshots.event_id` | Required foreign key |
| `contributor_trust_profiles.user_id` | Unique |

### 8.4 Recommended indices for Phase 2

| Table | Index |
|---|---|
| `event_sources` | `(event_id, is_public, created_at)` |
| `event_sources` | `(event_id, verification_status)` |
| `event_trust_snapshots` | `(event_id, created_at desc)` |
| `contributor_trust_profiles` | `(trust_level, updated_at)` |

## 9. Phase 3 — Derived Fields and Read-Model Support

By this stage the normalized schema exists, but the application still needs fast reader surfaces. That is why derived fields and read-model support must be treated as a dedicated migration phase rather than as an afterthought.

### 9.1 Fields and structures introduced in Phase 3

| Type | Structure | Purpose |
|---|---|---|
| **Derived columns** | `stories.source_count_total`, `stories.event_count_total`, `stories.turning_point_count`, `stories.confidence_summary` | Accelerate homepage cards and trust summaries |
| **Derived columns** | `events.source_count`, `events.source_density` | Accelerate event-level trust rendering |
| **Optional materialized views or cached tables** | `story_public_cards`, `story_timeline_headers`, `story_reference_rollups` | Improve public read performance and simplify API assembly |
| **Refresh jobs** | Derived-field recomputation jobs | Keep counts and trust summaries current after edits or moderation |

### 9.2 Why Phase 3 should be separate

| Reason | Explanation |
|---|---|
| **Read models change more often than base storage** | This separation keeps editorial tables stable while allowing performance tuning |
| **Public contracts need compact objects** | Homepage and timeline APIs should not perform heavy joins on every request |
| **Trust summaries are aggregated concepts** | The public app needs concise posture signals, not raw per-source logic only |

### 9.3 Implementation guidance

| Item | Recommendation |
|---|---|
| **Count fields** | Populate via background jobs or transaction-safe recomputation hooks |
| **Confidence summary** | Compute from event-level states with explicit precedence rules |
| **Read models** | Keep as internal server structures or materialized database objects, but version them like API-supporting assets |
| **Public filters** | Derived counts must respect `published`, `approved`, `is_public`, and non-deleted constraints |

## 10. Phase 4 — Creator Workflow Support

The approved Storywall creator workflow cannot operate on raw story and event tables alone. This phase introduces the database support needed for draft assembly, review, moderation, and publication transitions.

### 10.1 Workflow-support data additions

| Capability | Database requirement |
|---|---|
| **Structured brief intake** | Tables or JSON-backed records for creator briefs, framing choices, and generation parameters |
| **AI draft assembly** | Draft-state persistence for generated story bodies, candidate events, and proposed sources |
| **Imagery proposal** | Association table or child records for proposed visuals and selection state |
| **Human editing** | Revisionable draft records with separation between AI output and edited output |
| **Validation gating** | Persisted validation reports for source sufficiency, trust blockers, and missing-field detection |
| **Publication handoff** | Explicit status transitions from draft to review to published |

### 10.2 Recommended modeling stance

The migration plan should **not** overload public `stories` and `events` rows with every temporary authoring artifact. A cleaner approach is to create draft-supporting structures such as `story_drafts`, `event_drafts`, `story_validations`, or equivalent workflow-scoped records. The public editorial schema should represent what becomes publishable, while draft tables or draft-state columns represent the work-in-progress lifecycle.

| Modeling choice | Recommendation |
|---|---|
| **Draft content persistence** | Separate draft-oriented records from public-read records where practical |
| **Validation output** | Store structured validation results, not only text logs |
| **Revision history** | Preserve enough history for subtle edit indicators and auditability |
| **Promotion to publish** | Use deterministic publish jobs or transactions rather than manual field copying in UI code |

## 11. Phase 5 — Backfill, Integrity Validation, and Dry Runs

Because Storywall does not have a legacy story corpus that must be preserved, the backfill burden is lighter than in a typical migration. Even so, the new system still needs a validation phase before public cutover.

### 11.1 Backfill scope

| Backfill item | Required? | Notes |
|---|---|---|
| Existing public stories | Minimal or none | Product definition states that old stories will not be migrated |
| Demo and seed stories | Yes | Needed for homepage, QA, and trust validation |
| Derived counters | Yes | Must be computed from inserted story, event, and source records |
| Trust summaries | Yes | Must be generated from event and source posture |
| Search / discovery rails | Yes | Seed data should cover category and story-card behaviors |

### 11.2 Validation checklist

| Validation area | What must be proven |
|---|---|
| **Referential integrity** | Every public event references an existing story and every public source references an existing event |
| **Ordering integrity** | Event order is deterministic for every story |
| **Trust integrity** | Public counts and trust badges match source visibility and moderation rules |
| **API integrity** | Homepage and timeline responses can be produced without fallback hacks or hard-coded assumptions |
| **Workflow integrity** | Draft, review, and publish transitions do not corrupt public read models |

### 11.3 Dry-run environments

| Environment | Purpose |
|---|---|
| **Local** | Developer iteration, schema debugging, fixture generation |
| **Staging** | Production-like migration execution and API verification |
| **Production shadow test** | Read-only or feature-flagged verification before public cutover |

## 12. Phase 6 — API Cutover and Operational Hardening

This phase is the moment when the new database-backed system becomes the system of record.

### 12.1 Cutover sequence

| Step | Action | Safety principle |
|---|---|---|
| **1** | Deploy backend routes behind feature flags | Keep public traffic off incomplete paths |
| **2** | Run schema migrations in staging, then production | Never combine untested migration logic with live public cutover |
| **3** | Load seed or pilot editorial content | Verify endpoint behavior against realistic stories |
| **4** | Enable internal reader endpoints for QA | Confirm payload shape before public exposure |
| **5** | Enable creator workflow for pilot users | Validate draft-to-publish transitions under real usage |
| **6** | Turn on homepage and timeline public endpoints | Make database-backed reads the canonical source |
| **7** | Monitor query latency, error rates, and trust mismatches | Catch derived-field or join regressions quickly |

### 12.2 Post-cutover operational checks

| Check | Standard |
|---|---|
| **Migration status** | All migrations applied cleanly in the intended order |
| **Schema drift** | No out-of-band manual database changes |
| **Read-model freshness** | Derived fields and caches refresh correctly after editorial edits |
| **Moderation safety** | Rejected or non-public sources never leak into public endpoints |
| **Performance posture** | Homepage and story-detail queries stay within acceptable latency budgets |

## 13. Rollback and Recovery Posture

A migration plan is incomplete if it assumes everything succeeds on the first try. Storywall’s rollout should adopt a conservative rollback posture.

| Failure mode | Recovery strategy |
|---|---|
| **Migration script fails before commit** | Fail fast and leave schema unchanged |
| **Migration partially applies** | Use transactional migrations wherever supported; otherwise break migration into idempotent safe units |
| **Derived fields incorrect** | Rebuild derived counts and summaries from base tables rather than editing rows manually |
| **Public API regression after cutover** | Feature-flag rollback to previous endpoint path while preserving inserted base data |
| **Trust leakage or visibility bug** | Disable public reads from affected endpoints immediately and rebuild read models after fix |

The key principle is that **base normalized data and public read models should be recoverable independently**. That separation makes rollback far safer.

## 14. Compatibility Periods and Dual-Read / Dual-Write Guidance

Because the current stack does not yet have an old mature database implementation, Storywall probably does **not** need a long dual-write period between two competing databases. It may, however, need a short compatibility period between **draft implementation paths** and **new canonical tables**.

| Compatibility scenario | Recommendation |
|---|---|
| **Static demo data still powering UI** | Replace with API-backed fixtures behind feature flags before full cutover |
| **New editor writes but public reads still mocked** | Allow temporarily during QA, but keep it short |
| **Old temporary JSON fixtures vs. new DB records** | Treat database records as source of truth as soon as pilot content is stable |
| **Derived read models lagging base writes** | Use refresh jobs and explicit stale-state detection before public publish |

## 15. Recommended Migration Order at the DDL Level

The exact SQL or ORM migration files may differ by tooling, but the **ordering discipline** should remain consistent.

| Order | Migration unit |
|---|---|
| **1** | Baseline migration and extension setup |
| **2** | Core enums and shared lookup structures |
| **3** | `stories` table creation or alteration |
| **4** | `story_sections` table creation |
| **5** | `events` table creation or alteration |
| **6** | Story-tag or category join structures |
| **7** | `event_sources` table creation |
| **8** | `event_trust_snapshots` table creation |
| **9** | `contributor_trust_profiles` table creation |
| **10** | Derived columns, indexes, and optional materialized views |
| **11** | Refresh jobs, stored procedures, or worker hooks |
| **12** | Seed and verification migrations for pilot content |

This order minimizes broken foreign-key chains and allows data verification at each structural level.

## 16. Acceptance Criteria for the Migration Plan

The migration plan should be considered implementation-ready only if the following conditions are met.

| ID | Acceptance criterion |
|---|---|
| **DB-1** | The project has a committed migration toolchain and reproducible environment setup |
| **DB-2** | Core Storywall entities can be created with explicit constraints, enums, and foreign keys |
| **DB-3** | Trust and corroboration data can be stored and surfaced without flattening sources into story text |
| **DB-4** | Derived counts and confidence summaries can be recomputed from normalized data |
| **DB-5** | The homepage and timeline API contracts can be assembled from the migrated schema without undocumented fields |
| **DB-6** | Draft, review, and publish workflows can persist state without corrupting public rows |
| **DB-7** | Non-public, rejected, or hidden sources cannot leak into reader-facing responses |
| **DB-8** | The rollout sequence includes clear validation, cutover, and rollback paths |

## 17. Final Recommendation

The most important decision is to treat the Storywall migration as a **platform establishment plus schema rollout**, not merely as a small set of SQL alterations. The current codebase still needs a real backend-and-database layer before the approved Storywall model can become operational.

That makes the next best step after this document the **editor/CMS input model**, because once the database plan is set, Storywall needs a matching mutation model for briefs, drafts, edits, validations, imagery proposals, and publish actions. After that, the team should convert this migration plan into concrete migration files and environment setup tasks inside the upgraded full-stack project.
