# Storywall Ticket-Ready Implementation Backlog

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document converts the completed Storywall specification pack into a **ticket-ready implementation backlog** with epics, milestones, dependency ordering, and execution-ready work items. Its job is to move the team from planning into build execution without reopening product-definition questions that have already been settled in the current document set.[1] [2] [3] [4] [5] [6] [7] [8] [9]

The backlog is intentionally organized around the agreed implementation reality: Storywall is currently sitting on a static frontend scaffold, while the approved v1 product requires a full-stack system with persistent editorial records, creator-side mutations, moderation and reviewer controls, validation logic, and public read models.[6] [10] The backlog therefore prioritizes system foundation and end-to-end vertical slices over isolated UI work.[4] [10]

| Backlog objective | Practical meaning |
|---|---|
| **Ticket-ready** | Each work item is scoped so it can become an engineering ticket with a named outcome |
| **Milestone-driven** | Tickets are grouped into delivery slices that prove product truths in order |
| **Dependency-aware** | Work that unlocks other work is scheduled first |
| **Vertical-slice oriented** | The team should prove create-to-publish behavior before broad feature expansion |
| **Spec-anchored** | Tickets derive from the approved Storywall documents rather than from fresh concept drift |

## 2. Planning Assumptions

This backlog assumes a two-week sprint rhythm and follows the previously defined sprint logic, but it reframes the work as milestone-based execution so product, engineering, and design can start immediately.[4] The first major implementation decision is architectural: the current project should be upgraded from static-only to the full-stack capability set before core Storywall features are built, because the approved product model depends on server-side orchestration and persistent storage.[6] [10]

| Assumption | Working standard |
|---|---|
| **Current project state** | Static frontend scaffold with placeholder backend only |
| **Required target state** | Full-stack Storywall implementation with auth, database, jobs, and internal moderation surfaces |
| **Primary v1 user** | Content creators |
| **Core product loop** | Brief → frame → research → full draft → edit → validate → review when needed → publish |
| **Launch strategy** | Internal alpha, creator pilot, go/no-go replacement gate |
| **Migration policy** | No legacy story migration |

## 3. Milestone Structure

The cleanest execution path is to group the work into five milestones. These correspond to the existing implementation roadmap and sprint matrix, but they are expressed here as delivery checkpoints that engineering can own and track.[4] [10]

| Milestone | Goal | Exit condition |
|---|---|---|
| **M0 — Program Lock and Stack Upgrade** | Freeze the baseline and establish the full-stack implementation base | Team can build against one agreed architecture and one agreed vocabulary |
| **M1 — Data and Core Authoring Foundation** | Persist Storywall’s core records and enable the earliest creator flow | A creator can start a story and save structured editorial state |
| **M2 — AI Draft Assembly and Editorial Workspace** | Produce and edit a full Storywall draft | A creator can go from approved brief to editable complete draft |
| **M3 — Trust, Review, and Publication** | Enforce publication rules and reviewer governance | A validated story can be reviewed and published safely |
| **M4 — Reader Discovery, Pilot, and Launch Readiness** | Connect public surfaces and prove the system with real use | Pilot users can create and publish without staff reconstructing the flow |

## 4. Dependency Ordering Summary

The backlog should be executed in the following dependency order. This ordering is the most important operational constraint in the entire document.

| Order | Dependency block | Why it goes first |
|---|---|---|
| **1** | Baseline lock, architecture choice, stack upgrade | Prevents downstream churn and fake-progress UI work |
| **2** | Data model, migrations, shared types, auth context | Everything else depends on durable records and actor identity |
| **3** | Creator brief intake and framing persistence | Story generation cannot start without structured setup |
| **4** | AI orchestration for research and draft assembly | The product premise depends on full-draft quality |
| **5** | Editorial workspace and autosave mutations | Human ownership depends on reliable editing surfaces |
| **6** | Validation, trust model, imagery rules, reviewer overlays | Storywall cannot publish responsibly without them |
| **7** | Publish flow, public read models, homepage merchandising | These depend on stable story outputs and trust-bearing metadata |
| **8** | Pilot hardening, analytics, launch gate | These matter only after the loop actually works |

## 5. Epic Map

The backlog is built around nine execution epics. These expand the earlier implementation-epic proposal into work-ready program lanes.[4] [10]

| Epic ID | Epic | Primary outcome | Source documents |
|---|---|---|---|
| **E1** | Program lock and architecture foundation | One implementation baseline and one technical shape | PRD, build matrix, transition roadmap [1] [4] [10] |
| **E2** | Full-stack upgrade and platform plumbing | App can support backend routes, auth, and database access | Migration plan, transition roadmap [6] [10] |
| **E3** | Core data model and migrations | Story, draft, source, trust, and moderation records persist safely | Schema changes, migration plan, CMS model [6] [7] |
| **E4** | Creator intake and framing workflow | Creator can start a Storywall from structured intent | Creator workflow, CMS model, mutation contracts [2] [7] [8] |
| **E5** | AI research and draft assembly | System can generate a complete sourced draft | Creator workflow, prompt architecture, mutation contracts [2] [8] |
| **E6** | Editorial workspace and revision system | Creator can edit, autosave, and refine safely | CMS model, mutation contracts [7] [8] |
| **E7** | Validation, trust, and moderation | Publishability is enforceable and reviewer authority is operational | Trust standard, reviewer contract [3] [9] |
| **E8** | Publication and public read surfaces | Published stories render correctly in homepage and timeline surfaces | Read contracts, PRD [1] [5] |
| **E9** | Pilot hardening and launch readiness | Product can survive real creator behavior and support rollout | Build matrix, trust standard, reviewer contract [3] [4] [9] |

## 6. Milestone-by-Milestone Ticket Backlog

### Milestone M0 — Program Lock and Stack Upgrade

This milestone exists to eliminate ambiguity and establish the real implementation shape. It should be completed before substantial feature work begins.[4] [10]

| Ticket ID | Epic | Title | Outcome | Depends on |
|---|---|---|---|---|
| **M0-T01** | E1 | Freeze Storywall v1 specification baseline | Approved documents are marked as the implementation source of truth | None |
| **M0-T02** | E1 | Create architecture decision record for Storywall v1 | Team has one written architecture choice for frontend, backend, data, jobs, and storage | M0-T01 |
| **M0-T03** | E1 | Define canonical domain vocabulary and shared enums | Story type, trust state, workflow state, moderation state, and imagery enums are locked | M0-T01 |
| **M0-T04** | E2 | Upgrade project from static-only to full-stack capability set | Workspace can support backend routes, database integration, and authenticated flows | M0-T02 |
| **M0-T05** | E2 | Establish environment and secret strategy | Local, preview, and production environments are defined coherently | M0-T04 |
| **M0-T06** | E2 | Add shared type package or shared contract module | Frontend and backend can consume the same core types | M0-T03, M0-T04 |
| **M0-T07** | E2 | Define background-job execution model | Long-running generation and validation jobs have a clear runtime pattern | M0-T02, M0-T04 |
| **M0-T08** | E1 | Create implementation board with milestone swimlanes | Team can manage work against milestones rather than document names | M0-T01 |

### Milestone M1 — Data and Core Authoring Foundation

This milestone establishes the Storywall data model and the first creator-owned records. It should end when a creator can create a story draft shell and persist structured setup data.[2] [6] [7]

| Ticket ID | Epic | Title | Outcome | Depends on |
|---|---|---|---|---|
| **M1-T01** | E3 | Implement initial database migration framework | Database schema changes can be introduced safely and repeatably | M0-T04 |
| **M1-T02** | E3 | Create core story tables and identifiers | Story records, slugs, statuses, and ownership fields persist | M1-T01 |
| **M1-T03** | E3 | Create brief, framing option, and framing selection tables | Structured setup objects persist independently from final stories | M1-T01 |
| **M1-T04** | E3 | Create draft-version and revision tables | Story drafts support autosave and provenance-safe versioning | M1-T01 |
| **M1-T05** | E3 | Create initial source, event, and image-proposal tables | Story backbone objects exist for later workflow stages | M1-T01 |
| **M1-T06** | E2 | Implement creator authentication and ownership guards | Actor identity is available for creator-facing writes | M0-T04, M0-T05 |
| **M1-T07** | E4 | Implement create-story endpoint for brief shell creation | Creator can open a new Storywall workspace | M1-T02, M1-T03, M1-T06 |
| **M1-T08** | E4 | Implement brief autosave mutation contract | Brief inputs save optimistically with versioning | M1-T03, M1-T04, M1-T06 |
| **M1-T09** | E4 | Build creator brief intake UI | Creator can define subject, angle, scope, story type, and imagery posture | M1-T07, M1-T08 |
| **M1-T10** | E4 | Add canned starter descriptions and vague-brief handling | Setup flow helps creators avoid underspecified prompts | M1-T09 |
| **M1-T11** | E4 | Implement framing-generation command and result persistence | System can generate framing proposals from the brief | M1-T03, M1-T08, M0-T07 |
| **M1-T12** | E4 | Build framing selection screen and approval action | Creator can approve a frame and move the story forward | M1-T11 |
| **M1-T13** | E4 | Persist workflow-state transitions for setup flow | Story moves cleanly from drafting brief to awaiting framing to approved frame | M1-T07, M1-T12 |

### Milestone M2 — AI Draft Assembly and Editorial Workspace

This milestone proves the main product truth: the system can produce a complete draft and the creator can edit it without losing structure.[2] [7] [8]

| Ticket ID | Epic | Title | Outcome | Depends on |
|---|---|---|---|---|
| **M2-T01** | E5 | Implement research job orchestration service | System can run the structured research stage asynchronously | M0-T07, M1-T12 |
| **M2-T02** | E5 | Persist research artifacts and candidate sources | Research outputs are durable and reviewable | M1-T05, M2-T01 |
| **M2-T03** | E5 | Implement event extraction and chronology assembly pipeline | System can derive timeline-ready event objects | M2-T02 |
| **M2-T04** | E5 | Persist corroboration and event-source relationships | Events and sources can be linked with evidentiary meaning | M1-T05, M2-T03 |
| **M2-T05** | E5 | Implement full-draft assembly command | System can produce a complete story draft rather than isolated objects | M2-T03, M2-T04, M1-T04 |
| **M2-T06** | E5 | Build generation-status and draft-ready UI states | Creator can monitor long-running generation and enter the draft when ready | M2-T01, M2-T05 |
| **M2-T07** | E6 | Implement story-level autosave mutations | Story title, summary, framing, and synthesis fields save safely | M1-T04, M1-T06 |
| **M2-T08** | E6 | Implement section and event autosave mutations | Creators can edit structured content without freeform blob collapse | M1-T04, M1-T05, M1-T06 |
| **M2-T09** | E6 | Implement source add, edit, and attach mutations | Creators can manage evidence paths directly | M1-T05, M1-T06 |
| **M2-T10** | E6 | Build full editorial workspace shell | Editor exposes story, section, event, source, and references surfaces | M2-T05, M2-T07, M2-T08, M2-T09 |
| **M2-T11** | E6 | Add creator-note fields with explicit fact/commentary separation | Editorial structure enforces trust-bearing field distinctions | M2-T10 |
| **M2-T12** | E6 | Implement scoped regeneration commands for section or event | Creator can rerun parts of the draft without overwriting everything | M2-T05, M2-T10 |
| **M2-T13** | E6 | Persist revision history and recovery snapshots | Team can inspect material changes and recover from editing mistakes | M1-T04, M2-T07, M2-T08 |

### Milestone M3 — Trust, Review, and Publication

This milestone turns Storywall into a governed publishing system. It should end only when a draft can be validated, reviewed, and published under explicit rules.[3] [5] [8] [9]

| Ticket ID | Epic | Title | Outcome | Depends on |
|---|---|---|---|---|
| **M3-T01** | E7 | Create validation issue, validation run, and trust metadata tables | Trust and validation outputs persist as first-class records | M1-T01, M1-T05 |
| **M3-T02** | E7 | Implement validation engine skeleton with issue taxonomy | System can classify pass, warning, and blocked outcomes | M3-T01, M2-T05 |
| **M3-T03** | E7 | Add source sufficiency and missing-reference checks | Unsupported stories cannot proceed silently | M3-T02, M2-T09 |
| **M3-T04** | E7 | Add fact-commentary blending and overclaim validation rules | Core trust failures become detectable | M3-T02, M2-T10, M2-T11 |
| **M3-T05** | E7 | Add dispute-handling and confidence-state validation rules | Disputed and chatter content is governed explicitly | M3-T02, M2-T08 |
| **M3-T06** | E7 | Add imagery eligibility and misuse validation rules | Visual treatment cannot overstate certainty | M3-T02, M1-T05 |
| **M3-T07** | E7 | Build creator validation center and issue-resolution UI | Creator can understand and resolve blockers | M3-T03, M3-T04, M3-T05, M3-T06 |
| **M3-T08** | E7 | Create moderation tables for assignments, requirements, holds, and overrides | Reviewer activity can be persisted durably | M1-T01, M1-T02 |
| **M3-T09** | E7 | Implement reviewer role model and authorization checks | Reviewer, trust reviewer, and director permissions are enforceable | M3-T08, M1-T06 |
| **M3-T10** | E7 | Build reviewer queue and assignment actions | High-risk stories can enter owned review flow | M3-T08, M3-T09 |
| **M3-T11** | E7 | Implement moderation state transitions and hold logic | Reviewer states can block publish safely | M3-T08, M3-T09 |
| **M3-T12** | E7 | Build structured review requirements workflow | Review feedback becomes actionable and auditable | M3-T10, M3-T11 |
| **M3-T13** | E7 | Implement publish command with workflow and moderation gate enforcement | Publish only succeeds when both creator and reviewer conditions are satisfied | M3-T07, M3-T11 |
| **M3-T14** | E7 | Build publish-readiness summary and confirmation UI | Creator can see exactly what blocks or permits publication | M3-T13 |

### Milestone M4 — Reader Discovery, Pilot, and Launch Readiness

This milestone connects the editorial engine to public reading surfaces and proves the product through real usage before wider launch.[1] [4] [5] [10]

| Ticket ID | Epic | Title | Outcome | Depends on |
|---|---|---|---|---|
| **M4-T01** | E8 | Create public story read model projection | Published story data can be served efficiently to public routes | M3-T13 |
| **M4-T02** | E8 | Implement homepage feed and discovery-rail projections | Discovery surfaces can be populated from published stories | M4-T01 |
| **M4-T03** | E8 | Implement homepage endpoint contract | Public homepage API matches the approved envelope and field definitions | M4-T02 |
| **M4-T04** | E8 | Implement timeline/story-detail endpoint contract | Story detail reads match the approved public contract | M4-T01 |
| **M4-T05** | E8 | Build public homepage discovery UI against live data | Homepage stops being seeded and starts rendering real stories | M4-T03 |
| **M4-T06** | E8 | Build public story route against live timeline payload | Reader can consume published Storywalls with trust cues and references | M4-T04 |
| **M4-T07** | E8 | Add share metadata and teaser derivative generation | Published stories have usable discovery and share surfaces | M3-T13, M4-T02 |
| **M4-T08** | E9 | Implement post-publish visibility intervention actions | Published stories can be restricted or restored under reviewer control | M3-T11, M3-T13 |
| **M4-T09** | E9 | Add analytics and operational event instrumentation | Team can measure creation, validation, review, and publish behavior | M3-T13, M4-T05, M4-T06 |
| **M4-T10** | E9 | Prepare pilot onboarding and internal QA checklist | Internal alpha can run against a repeatable checklist | M4-T05, M4-T06 |
| **M4-T11** | E9 | Run creator pilot triage loop and backlog burn-down | Real usage drives bug fixing and workflow hardening | M4-T10 |
| **M4-T12** | E9 | Produce launch readiness scorecard and go/no-go review | Leadership can decide whether Storywall is ready to become the default experience | M4-T11 |

## 7. Immediate Build-Start Tickets

If the team wants to start implementation immediately, these are the first tickets that should be pulled. They are the smallest set that establishes momentum without violating dependency order.

| Priority | Ticket ID | Why it starts now |
|---|---|---|
| **1** | **M0-T01** | Locks the baseline and stops further strategy churn |
| **2** | **M0-T02** | Prevents architecture ambiguity |
| **3** | **M0-T04** | The current static scaffold cannot support the approved product model |
| **4** | **M0-T06** | Shared types reduce contract drift early |
| **5** | **M1-T01** | Database migrations must exist before persistence work starts |
| **6** | **M1-T02** | Story identity is the root record for almost everything else |
| **7** | **M1-T03** | Brief and framing persistence unlock creator setup |
| **8** | **M1-T06** | Auth and ownership are required for creator-side mutations |
| **9** | **M1-T07** | First usable creator route begins here |
| **10** | **M1-T09** | Enables the first meaningful user-facing workflow |

## 8. Cross-Epic Dependencies That Must Be Tracked Explicitly

Certain dependencies are easy to underestimate because they cut across multiple milestones. They should be tracked on the implementation board as program-level blockers, not just as local ticket notes.[4] [10]

| Dependency | First blocking ticket | Why it matters |
|---|---|---|
| **Canonical shared enums** | M0-T03 | Workflow, trust, moderation, and imagery logic all depend on them |
| **Full-stack upgrade completion** | M0-T04 | Most creator and reviewer tickets are otherwise impossible or misleadingly stubbed |
| **Auth and ownership model** | M1-T06 | Creator mutations and reviewer roles depend on identity and permissions |
| **Draft-version persistence** | M1-T04 | Autosave, revision history, and conflict handling depend on it |
| **Background job model** | M0-T07 | Research, draft assembly, and validation are long-running actions |
| **Validation issue taxonomy** | M3-T02 | Creator trust UI and reviewer intervention both rely on common issue types |
| **Public read-model projection** | M4-T01 | Homepage and story-detail surfaces should not read directly from authoring tables |

## 9. Acceptance Criteria for the Backlog Itself

This backlog should be treated as implementation-ready only if the team agrees that the following conditions have been satisfied.

| ID | Acceptance criterion |
|---|---|
| **BL-1** | The backlog reflects the approved Storywall specification pack rather than introducing a new product scope |
| **BL-2** | Every milestone ends with a product-truth checkpoint, not just a code-complete claim |
| **BL-3** | The earliest tickets focus on enabling the real architecture, not on cosmetic reader polish |
| **BL-4** | Creator workflow, trust enforcement, reviewer governance, and public read models are sequenced in dependency-safe order |
| **BL-5** | The first vertical slice proves one creator can create, validate, review when needed, and publish one real Storywall |
| **BL-6** | Immediate build-start tickets can be assigned without further strategy writing |

## 10. Final Recommendation

The best next move is to treat **M0 and M1 as the build kickoff package** and begin implementation there immediately. That means freezing the baseline, upgrading the project to a full-stack shape, introducing the migration framework, defining the shared domain vocabulary, and then building the creator brief-and-framing flow as the first user-facing capability.[2] [4] [6] [10]

The team should resist the temptation to start with homepage polish or isolated discovery features. Storywall’s differentiator is the creator-to-publish engine. If the team proves that vertical slice first, the rest of the product becomes execution. If it does not, the rest of the work becomes decoration around an unproven core.[3] [4] [10]

## References

[1]: file:///home/ubuntu/storywall-redesign/storywall_v1_prd.md "Storywall v1 PRD"
[2]: file:///home/ubuntu/storywall-redesign/storywall_creator_workflow_specification.md "Storywall Creator Workflow Specification"
[3]: file:///home/ubuntu/storywall-redesign/storywall_publishing_and_trust_standard.md "Storywall Publishing and Trust Standard"
[4]: file:///home/ubuntu/storywall-redesign/storywall_sprint_by_sprint_build_matrix.md "Storywall Sprint-by-Sprint Build Matrix"
[5]: file:///home/ubuntu/storywall-redesign/storywall_api_response_contracts_homepage_timeline.md "Storywall API Response Contracts for Homepage and Timeline Endpoints"
[6]: file:///home/ubuntu/storywall-redesign/storywall_database_migration_plan_actual_stack.md "Storywall Database Migration Plan for the Actual Stack"
[7]: file:///home/ubuntu/storywall-redesign/storywall_editor_cms_input_model.md "Storywall Editor and CMS Input Model"
[8]: file:///home/ubuntu/storywall-redesign/storywall_creator_side_mutation_api_contracts.md "Storywall Creator-Side Mutation and API Contracts"
[9]: file:///home/ubuntu/storywall-redesign/storywall_reviewer_permissions_moderation_state_contract.md "Storywall Reviewer Permissions and Moderation-State Contract"
[10]: file:///home/ubuntu/storywall-redesign/storywall_transition_to_implementation.md "Storywall: From Current State to Implementation"
