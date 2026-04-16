# Storywall Sprint-by-Sprint Build Matrix

**Author:** Manus AI  
**Date:** 2026-04-14  
**Note (2026-04-16):** Milestone **M4** in the ticket backlog is now **Creator Workflow Foundation** (post **M4-T01**). See `docs/storywall_m4_creator_workflow_foundation.md`. Sprint rows below remain historical sequencing context; align future sprints with the updated M4 ticket list when planning.

## 1. Purpose

This document translates the Storywall v1 specification set into a practical **delivery matrix** for design, product, and engineering. It assumes Storywall v1 is being built as a clean-start replacement rather than a legacy migration project, and it organizes work around the product’s real risk order: first establish the story model and reader experience, then build creator tooling and AI orchestration, then harden validation, trust, and publishing.

The matrix is designed to answer five implementation questions clearly. What should be built first? What can run in parallel? What must be proven before the next sprint starts? Which decisions remain gating? And what constitutes a sprint-level definition of done for Storywall v1?

| Planning assumption | Working standard |
|---|---|
| **Sprint length** | Two weeks per sprint |
| **Delivery mode** | Cross-functional product, design, frontend, backend, and AI orchestration workstreams |
| **v1 focus** | Creator-led, AI-first, timeline-based non-fiction stories |
| **Migration policy** | No legacy story migration |
| **Primary user** | Content creators |
| **Launch approach** | Internal alpha, creator pilot, quality gate, primary launch |

## 2. Build Philosophy

The Storywall build should be sequenced around the **highest-risk product truths**, not around whichever layer is easiest to code first. The highest risks are not visual polish or analytics instrumentation. They are whether Storywall can consistently produce a complete sourced draft, whether that draft can be edited cleanly by creators, and whether readers can trust the final result.

This means the build matrix must privilege the following progression: foundational content model, reader surface, creator intake and assembly flow, editing layer, trust and validation layer, and only then launch hardening and rollout.

| Build principle | Why it matters |
|---|---|
| **Model before interface sprawl** | Schema, prompt stages, and trust objects determine product behavior |
| **Reader clarity before creator complexity** | The public story object must be coherent before editor features multiply |
| **AI assembly before AI embellishment** | Draft quality matters more than secondary automation |
| **Trust before scale** | Weak sourcing and unclear provenance would damage the product premise |
| **Pilot before replacement** | Real creator behavior must validate the system before full switch-over |

## 3. Workstreams

The sprint plan assumes six coordinated workstreams. These should not be treated as isolated departments; each sprint should pull a coherent slice across them.

| Workstream | Responsibility |
|---|---|
| **Product and design** | Flow definition, interaction decisions, design QA, prioritization |
| **Frontend reader** | Homepage, story hero, timeline, trust rail, event cards, synthesis |
| **Frontend creator** | Brief intake, framing selection, draft editor, imagery approval, publish flow |
| **Backend / data** | Story, event, source, trust, imagery, and validation persistence |
| **AI orchestration** | Prompt staging, structured outputs, validation reports, regeneration logic |
| **QA / moderation** | Acceptance testing, publish blockers, quality review, pilot feedback loop |

## 4. Sprint Sequencing Overview

This plan uses **eight implementation sprints** followed by a launch-readiness checkpoint. The first six sprints build the core product. Sprint seven stabilizes the creator pilot. Sprint eight prepares the full replacement motion.

| Sprint | Theme | Primary outcome |
|---|---|---|
| **Sprint 0** | Architecture lock and implementation setup | Finalize core decisions and establish build scaffolding |
| **Sprint 1** | Story object and reader foundation | Render a valid Storywall story with the new reader shell |
| **Sprint 2** | Creator brief intake and framing | Enable structured story setup and framing selection |
| **Sprint 3** | AI research and draft assembly | Produce a complete sourced draft before manual editing |
| **Sprint 4** | Editor and refinement layer | Make the draft fully editable and regeneration-safe |
| **Sprint 5** | Trust, validation, and imagery governance | Enforce publishability and trust presentation rules |
| **Sprint 6** | Publishing flow and homepage merchandising | Enable controlled publishing and story discovery |
| **Sprint 7** | Internal alpha and creator pilot hardening | Validate quality with real creation behavior |
| **Sprint 8** | Launch gate and replacement readiness | Prepare the new Storywall to become the default product |

## 5. Sprint 0 — Architecture Lock and Implementation Setup

Sprint 0 should convert the specification set into a build-ready program. This sprint is intentionally short on visible product output and heavy on decision closure. If Storywall begins implementation without closing the key open questions, later sprints will churn.

| Category | Scope |
|---|---|
| **Objectives** | Lock the v1 story-type menu, trust taxonomy, source priority model, and system boundaries |
| **Key deliverables** | Technical architecture note, system event/state model, shared type definitions, environment setup, tracking of locked vs open decisions |
| **Dependencies** | PRD, creator workflow specification, publishing and trust standard, schema changes, prompt architecture |
| **Acceptance criteria** | Engineering can describe the end-to-end story lifecycle from brief to publish without unresolved structural ambiguity |
| **Decision gate** | Do not start Sprint 1 until story types, trust states, and reader-visible labels are fixed enough for implementation |

### Sprint 0 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Product and design** | Final v1 story-type menu and core user-flow diagrams |
| **Backend / data** | Initial entity map for story, event, source, trust, imagery, and validation objects |
| **AI orchestration** | Stage map for normalization, framing, research, draft, refinement, validation, and publish-time derivatives |
| **Frontend teams** | Shared route and component plan for reader and creator surfaces |
| **QA / moderation** | Initial quality rubric derived from publishability rules |

## 6. Sprint 1 — Story Object and Reader Foundation

Sprint 1 should prove that the new Storywall story object can be rendered as a coherent reader experience. The goal is not yet to make authoring delightful. The goal is to ensure the canonical output shape works in the product.

| Category | Scope |
|---|---|
| **Objectives** | Build the mobile-first story reading shell for hero, timeline, event cards, trust rail, and synthesis |
| **Key deliverables** | Reader route, story hero, timeline rail, event card system, creator-note treatment, trust rail placeholder, synthesis block |
| **Dependencies** | Sprint 0 architecture lock, design tokens, component inventory |
| **Acceptance criteria** | A seeded Storywall story can be rendered with title, framing, ordered timeline, references, creator identity, and synthesis |
| **Decision gate** | Do not proceed until the canonical public story surface feels structurally correct on mobile |

### Sprint 1 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Frontend reader** | Responsive story page with story hero, timeline, trust rail shell, and synthesis |
| **Product and design** | Interaction specification for fact vs creator-note separation |
| **Backend / data** | Read-model contract for the canonical story object |
| **QA / moderation** | Reader QA checklist for chronology, hierarchy, and trust cue placement |

## 7. Sprint 2 — Creator Brief Intake and Framing

Sprint 2 should create the front door for making a Storywall. The system must stop being a prototype with seeded stories and become a product where creators can direct the AI with structured intent.

| Category | Scope |
|---|---|
| **Objectives** | Build story setup, structured brief intake, story-type routing, and framing proposal selection |
| **Key deliverables** | Creator setup form, canned framing starters, framing proposal screen, approved-frame persistence, risk flags display |
| **Dependencies** | Sprint 0 story-type menu, Sprint 1 story object shape |
| **Acceptance criteria** | A creator can define subject, angle, scope, and imagery posture, then approve a framing before generation starts |
| **Decision gate** | Do not proceed until the setup flow reliably produces normalized story inputs rather than ambiguous prompts |

### Sprint 2 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Frontend creator** | Story setup and framing approval flow |
| **AI orchestration** | Normalization stage and framing generation stage with structured outputs |
| **Backend / data** | Storage for briefs, framing options, selected framing, and risk flags |
| **Product and design** | UX rules for vague briefs, too-broad subjects, and disputed-angle warnings |

## 8. Sprint 3 — AI Research and Draft Assembly

Sprint 3 is the first major product truth sprint. Storywall must prove that it can produce a **complete sourced draft before human editing**. If this sprint fails, the product premise is not yet viable.

| Category | Scope |
|---|---|
| **Objectives** | Implement research pass, source attachment, event extraction, chronology assembly, and full draft generation |
| **Key deliverables** | Research status view, event candidate generation, source matching, corroboration map, first complete story draft object |
| **Dependencies** | Sprint 2 approved framing flow, prompt architecture stages for research and drafting, schema support for event and source objects |
| **Acceptance criteria** | The system can produce a draft with timeline, references, trust metadata shells, and synthesis without requiring manual writing first |
| **Decision gate** | Do not proceed until the median draft feels like a real story rather than a research dump |

### Sprint 3 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **AI orchestration** | Research, event generation, corroboration, and draft assembly stages |
| **Backend / data** | Persistence for event candidates, sources, corroboration, and draft versions |
| **Frontend creator** | Research-progress and draft-ready states |
| **QA / moderation** | Draft-quality review rubric focused on completeness, chronology, and evidence attachment |

## 9. Sprint 4 — Editor and Refinement Layer

Sprint 4 should make the AI draft genuinely usable by creators. Storywall succeeds only if creators can confidently reshape output without fighting the system or destroying structure unintentionally.

| Category | Scope |
|---|---|
| **Objectives** | Build direct editing, section/event refinement, creator-note insertion, regeneration controls, and revision-safe provenance handling |
| **Key deliverables** | Draft editor, event editor, creator notes UI, selective regeneration for event or section, revision history foundation |
| **Dependencies** | Sprint 3 complete draft object, creator workflow specification, edit-signaling standard |
| **Acceptance criteria** | A creator can edit every major story field, revise events, manage notes, and regenerate safely without losing unrelated work |
| **Decision gate** | Do not proceed until the editing experience supports real human ownership of the story |

### Sprint 4 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Frontend creator** | Full story editor with story-level and event-level controls |
| **AI orchestration** | Scoped regeneration and editorial refinement stages |
| **Backend / data** | Revision persistence and provenance-safe draft versioning |
| **Product and design** | Rules for fact fields, creator-note fields, and subtle edit signaling |

## 10. Sprint 5 — Trust, Validation, and Imagery Governance

Sprint 5 should turn Storywall from an editing system into a standards-driven publishing system. This is where trust becomes enforceable rather than aspirational.

| Category | Scope |
|---|---|
| **Objectives** | Implement trust states, publish blockers, dispute handling, source sufficiency checks, and imagery eligibility enforcement |
| **Key deliverables** | Validation engine, issue taxonomy, trust panel, dispute cues, confidence-state rendering, imagery approval rules |
| **Dependencies** | Publishing and Trust Standard, Sprint 4 editor, schema support for validation and trust metadata |
| **Acceptance criteria** | The system blocks publication for unsupported key claims, missing references, inadequate scope, fact/commentary blending, and imagery misuse |
| **Decision gate** | Do not proceed until Storywall can explain why a draft is or is not publishable |

### Sprint 5 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **AI orchestration** | Validation passes for overclaim, unsupported causality, duplicate events, timeline gaps, and tone drift |
| **Frontend creator** | Validation report, trust review panel, imagery approval surface |
| **Frontend reader** | Reader-facing trust cues for source visibility, creator identity, dispute posture, and creator notes |
| **Backend / data** | Validation issue persistence, trust metadata, imagery provenance and eligibility storage |
| **QA / moderation** | Manual review workflow for high-risk or disputed stories |

## 11. Sprint 6 — Publishing Flow and Homepage Merchandising

Sprint 6 should complete the main loop from story creation to public discovery. By this point, Storywall should already be able to produce and validate strong stories. Now it needs controlled publication and a way to surface completed work.

| Category | Scope |
|---|---|
| **Objectives** | Enable publishing, post-publish read integrity, and homepage merchandising of completed Storywalls |
| **Key deliverables** | Publish action, publish checklist, story status transitions, homepage rails, discovery cards, teaser generation, internal analytics hooks |
| **Dependencies** | Sprint 5 validation and trust enforcement |
| **Acceptance criteria** | A creator can publish a validated story and see it appear in the homepage/discovery surfaces with correct summary, imagery, and trust posture |
| **Decision gate** | Do not proceed until public stories preserve the same trust cues and editorial hierarchy seen in the editor preview |

### Sprint 6 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Frontend creator** | Publish confirmation flow and publish-readiness summary |
| **Frontend reader** | Homepage discovery surfaces and shared story cards |
| **AI orchestration** | Publish-time derivative generation such as share title, share description, and teaser summary |
| **Backend / data** | Story publication status, homepage ordering fields, analytics event model |
| **QA / moderation** | Post-publish QA checks for regressions between preview and live render |

## 12. Sprint 7 — Internal Alpha and Creator Pilot Hardening

Sprint 7 should expose Storywall to real creation behavior from internal users and a limited creator pilot. The objective is not new scope. It is product hardening through real usage.

| Category | Scope |
|---|---|
| **Objectives** | Validate output quality, creation speed, trust clarity, and editor usability with actual creators |
| **Key deliverables** | Pilot onboarding flow, issue triage board, quality review loop, prompt tuning backlog, blocker/bug backlog burn-down |
| **Dependencies** | Complete creation-to-publish loop from Sprint 6 |
| **Acceptance criteria** | Pilot creators can generate, edit, validate, and publish stories without staff reconstructing the workflow for them |
| **Decision gate** | Do not proceed until pilot output quality is consistently near the Whitney benchmark for richness and coherence |

### Sprint 7 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Product and design** | Pilot interview and usability feedback synthesis |
| **AI orchestration** | Prompt tuning based on weak-story patterns and recurrent validation failures |
| **QA / moderation** | High-risk story review log and quality trend reporting |
| **Frontend teams** | Fixes to creation friction, rendering issues, and mobile polish |
| **Backend / data** | Stability improvements and operational monitoring |

## 13. Sprint 8 — Launch Gate and Replacement Readiness

Sprint 8 should decide whether the new Storywall is ready to become the primary product. This sprint is not for speculative feature expansion. It is for confirming that the system meets the v1 promise and that switching over will improve the product rather than merely refresh it visually.

| Category | Scope |
|---|---|
| **Objectives** | Final launch QA, replacement readiness review, operational handoff, and go/no-go decision |
| **Key deliverables** | Launch checklist, quality scorecard, support playbook, rollout plan, fallback plan, replacement recommendation |
| **Dependencies** | Successful pilot outcomes and stable publish loop |
| **Acceptance criteria** | Leadership can review quality, trust, and creator-efficiency evidence and make a confident replacement decision |
| **Decision gate** | Replace the existing primary experience only if quality, trust, and creation metrics meet the v1 bar |

### Sprint 8 deliverable matrix

| Workstream | Deliverable |
|---|---|
| **Product and design** | Final go/no-go brief and launch narrative |
| **QA / moderation** | Launch-readiness scorecard against publishability and trust standards |
| **Backend / data** | Production readiness and rollback plan |
| **Frontend teams** | Final bug-fix and polish pass |
| **AI orchestration** | Final prompt and validation configuration freeze for launch candidate |

## 14. Cross-Sprint Dependency Map

Several dependencies cut across all sprints and should be tracked explicitly. These are the items most likely to create downstream churn if left vague.

| Dependency | First needed | Why it is critical |
|---|---|---|
| **Exact v1 story-type menu** | Sprint 0 | Determines setup UX, prompt routing, and validation rules |
| **Canonical story API shape** | Sprint 1 | Determines reader rendering and later editor structure |
| **Prompt stage contracts** | Sprint 2 | Determines orchestration and persistence model |
| **Source and trust taxonomy** | Sprint 3 | Determines validation, trust UI, and publish logic |
| **Subtle edit-signaling policy** | Sprint 4 | Determines provenance and reader-facing disclosures |
| **Imagery governance rules** | Sprint 5 | Determines asset approval and misuse blocking |
| **Homepage merchandising logic** | Sprint 6 | Determines discovery and launch presentation |

## 15. Exit Criteria by Milestone

The sprint sequence should also be read as four broader milestones. Each milestone should have a clear exit bar before the team expands scope.

| Milestone | Sprints | Exit criteria |
|---|---|---|
| **Foundation milestone** | 0–1 | Story model and reader shell are stable enough to represent the product correctly |
| **Creation milestone** | 2–4 | A creator can go from structured brief to editable complete draft |
| **Trust milestone** | 5–6 | A story can be validated, published, and read with visible trust posture |
| **Launch milestone** | 7–8 | Pilot creators succeed and replacement risk is acceptably low |

## 16. Recommended Team Rhythm

A sprint-by-sprint plan will only work if each sprint ends with the same type of review. Storywall should adopt a review rhythm that checks not only whether features are complete, but whether the product is becoming more publishable and more trustworthy.

| Ceremony | Purpose |
|---|---|
| **Sprint planning** | Confirm the one product truth the sprint must prove |
| **Mid-sprint draft review** | Review actual story outputs, not only tickets |
| **Trust review** | Examine weak-source, disputed-view, and validation failures |
| **Reader QA review** | Check mobile reading quality and hierarchy |
| **Sprint demo** | Demonstrate end-to-end user outcomes |
| **Retro** | Identify churn sources in prompts, data model, or UI |

## 17. Risks to the Plan

The biggest risk to this build matrix is not underestimation of coding effort. It is scope diffusion. Storywall could easily slip into building a generic editor, an over-designed visual timeline, or a weakly governed AI writing tool. The sprint structure above is meant to resist that drift.

| Risk | Likely sprint impact | Mitigation |
|---|---|---|
| **Open story-type ambiguity persists** | Sprints 0–3 | Lock the menu early and defer extras |
| **AI drafts are incomplete or generic** | Sprints 3–4 | Tighten prompt staging and quality rubric before scaling |
| **Trust model is added too late** | Sprints 4–6 | Treat validation as a core sprint, not polish |
| **Homepage/discovery starts too early** | Sprints 1–3 | Do not prioritize merchandising before creation quality |
| **Pilot begins before blockers are real** | Sprint 7 | Require full publish-loop completion first |
| **Replacement pressure outruns quality evidence** | Sprint 8 | Use explicit go/no-go criteria and fallback plan |

## 18. Final Recommendation

The practical Storywall sequence is therefore straightforward. **Lock the model, prove the reader object, prove the creator flow, enforce the trust layer, then launch through a controlled pilot.**

That sequence gives the team the best chance of replacing the current product with something that is not only more visually coherent, but actually more useful, more creator-friendly, and more trustworthy.

## 19. Alignment with M4 Creator Workflow Foundation

After public reader trust work and **M4-T01** (share metadata), the **formal M4 ticket queue** is defined in **`docs/storywall_m4_creator_workflow_foundation.md`**: story setup (**M4-T02**), workspace IA (**M4-T03**), section editor (**M4-T04**), timeline UX (**M4-T05**), evidence surface (**M4-T06**), imagery (**M4-T07**), preview parity (**M4-T08**), republish (**M4-T09**), empty states (**M4-T10**), design polish (**M4-T11**). When updating sprint plans, map those tickets onto upcoming sprints rather than the superseded “reader discovery first” M4 draft in older backlog snapshots.
