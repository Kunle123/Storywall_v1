# Storywall v1 PRD

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Product Summary

Storywall v1 is an **AI-first, creator-led, non-fiction context engine** for producing sourced, timeline-based stories. A creator begins with a research brief. The system then helps sharpen the framing, researches objective facts, assembles a complete draft story with sources and a mandatory timeline, proposes selective editorial imagery, and presents the result for human editing and approval.

Storywall is not a generic writing tool and it is not a freeform opinion platform. Its core value is that it produces **rich contextual stories grounded in referenceable facts**, while still letting creators express commentary clearly and responsibly.

## 2. Problem Statement

Creators who want to explain a person, issue, movement, or sequence of events often have to choose between shallow social formats and labor-intensive manual research. Existing formats make it difficult to combine chronology, context, commentary, and visible sourcing in a coherent mobile-first reading experience.

Storywall v1 solves this by making the timeline and factual references mandatory, while using AI to do the heavy lifting of research, assembly, and first-draft creation. The creator remains the final editor and publisher, but does not have to start from a blank page.

## 3. Product Vision

Storywall v1 should let a creator say:

> “Here is the subject, here is the angle, now assemble a deep, sourced, readable story that I can refine and publish.”

The resulting story should be broad enough to provide meaningful context, structured enough to guide the reader through time, and trustworthy enough that the reader can inspect references, see who created it, and understand where alternate viewpoints exist.

## 4. Primary User

The primary v1 user is the **content creator**. This creator may be an independent researcher, explainer, commentator, educator, fan-historian, or media operator who wants to publish non-fiction contextual stories efficiently without sacrificing factual grounding.

| User | Priority | Need |
|---|---|---|
| **Content creator** | Primary | Fast research-to-story workflow with strong editing control |
| **Reader** | Secondary | Readable story, visible sources, clear creator attribution, appropriate imagery |
| **Reviewer/editor** | Supporting | Clear signals for weak sourcing, contested framing, and publish readiness |

## 5. Core Product Principles

| Principle | Meaning |
|---|---|
| **Non-fiction first** | Stories must be researchable and linked to objective facts |
| **Timeline mandatory** | Every story requires a chronological backbone |
| **References mandatory** | Every publishable story must visibly reference sources |
| **AI-first workflow** | AI generates a near-complete story draft before human editing |
| **Human final control** | Creators can edit everything before publication |
| **Minimal editorial skew** | The factual layer should avoid unnecessary framing or opinion |
| **Dispute visibility** | Where important viewpoints differ, the story should surface that clearly |
| **Selective imagery** | Imagery is limited to approved surfaces and must support the story rather than dominate it |

## 6. Goals

Storywall v1 should achieve four primary goals. It should enable creators to produce richer stories than a thread or post. It should reduce the time required to create a sourced non-fiction story. It should maintain consistent visual quality across stories. It should make trust legible to readers through source visibility and creator attribution.

| Goal | Description |
|---|---|
| **Richness** | Stories should feel substantial and contextual rather than brief or skeletal |
| **Efficiency** | AI should reduce time spent researching, structuring, and drafting |
| **Consistency** | Stories should share the same narrative and visual system |
| **Trust** | Readers should see who created the story and what sources support it |

## 7. Non-Goals

Storywall v1 is not intended to be a social feed, a pure opinion platform, a long-form essay tool without chronology, or a general-purpose publishing CMS. It is also not a legacy migration project; old stories will not be ported into v1 in the initial release.

| Non-goal | Explanation |
|---|---|
| **Legacy migration** | Existing stories are out of scope for v1 |
| **Pure opinion publishing** | Unsupported commentary without factual grounding is not acceptable |
| **Image-heavy storytelling** | Visual spectacle should not override reference-driven storytelling |
| **Blank-page writing tool** | The workflow starts from a structured brief, not from an empty editor |

## 8. Canonical User Flow

The v1 workflow should be designed around a clear sequence from research brief to publish.

| Step | Description |
|---|---|
| **1. Brief** | Creator enters subject, angle, and story intent |
| **2. Framing assist** | AI suggests stronger or alternative framings |
| **3. Research pass** | AI gathers candidate facts, dates, and sources |
| **4. Draft assembly** | AI creates a complete draft story with timeline and references |
| **5. Imagery proposal** | AI proposes approved imagery surfaces and prompts |
| **6. Human edit** | Creator edits structure, text, commentary, and visuals |
| **7. Validation** | System checks factual sufficiency, source visibility, and disputed framing handling |
| **8. Publish** | Creator publishes the finalized Storywall |

## 9. Story Inputs

The story setup should capture enough structure to guide the AI effectively. A blank freeform prompt is not sufficient on its own.

| Input | Required | Example |
|---|---|---|
| **Subject** | Yes | Whitney Houston |
| **Story type** | Yes | Biography, relationships, works, influence, issue history |
| **Research brief** | Yes | The life and times of Whitney Houston |
| **Desired angle** | Yes | How relationships and industry pressures shaped her life |
| **Time scope** | No, but encouraged | Entire life, 1980–2000, early career |
| **Audience** | No | General audience, students, fans |
| **Imagery mode** | Yes | Selective editorial |

If the creator’s brief is too thin, the system should help enrich it by suggesting alternate angles and more specific framings.

## 10. Core Story Requirements

Every publishable Storywall must satisfy a minimum structure.

| Requirement | Why it is mandatory |
|---|---|
| **Timeline** | Provides chronological grounding and helps orient the reader |
| **References** | Establishes factual credibility and trust |
| **Story framing** | Makes the narrative intent explicit |
| **Creator attribution** | Shows who is responsible for publication |
| **Contextual breadth** | Prevents narrow or underdeveloped stories |
| **Dispute handling** | Prevents one-sided treatment of contested topics |
| **Synthesis** | Ensures the story ends with meaning, not only chronology |

## 11. Reader Experience Requirements

Readers should encounter a story that is immediately understandable, clearly authored, and visibly grounded. The timeline should remain the structural spine even when the story angle is thematic. Commentary must be present, if at all, as a clearly separated layer rather than blended invisibly into factual summaries.

| Surface | Must show |
|---|---|
| **Story hero** | Title, framing summary, creator identity, top-level trust cues |
| **Timeline** | Ordered milestones or grouped chronological sections |
| **Event cards** | Date, factual summary, references, significance |
| **Creator notes** | Human commentary, clearly separated from factual layer |
| **Trust cues** | Source visibility, disputed framing indicators where relevant |
| **Ending synthesis** | Why the story matters or what pattern emerges |

## 12. Trust Model

Trust in Storywall v1 should not rely on abstract branding alone. It should be shown through transparent references, creator identity, and careful handling of disputed viewpoints.

| Trust signal | How it appears |
|---|---|
| **Source visibility** | Readers can see the references attached to the story and/or events |
| **Creator identity** | The story visibly names or links the creator |
| **Dispute surfacing** | The product indicates when alternate sourced viewpoints exist |
| **Subtle edit disclosure** | The UI can lightly signal where human editing materially changed AI-generated draft content |

## 13. Imagery Policy

Storywall v1 will use restrained, selective imagery. The system should only generate or attach images on approved surfaces.

| Image surface | Default policy |
|---|---|
| **Story hero** | Usually included |
| **Turning-point image** | Optional and selective |
| **Context / synthesis image** | Optional when explanatory |
| **Standard event card image** | Usually omitted |

Images should support comprehension or tone. They should not overwhelm the story or imply false factual certainty. For recognizable people, non-photorealistic editorial treatments are preferred.

## 14. Quality Standard

A good Storywall is rich, broad enough to add real context, visibly sourced, and careful with contested framing. A bad Storywall is thin, too narrow in timespan, weakly sourced, or strongly slanted without acknowledging alternate viewpoints.

| Acceptable story | Rejectable story |
|---|---|
| Provides meaningful context across time | Covers only a trivial slice without broader explanatory value |
| Includes timeline and references | Lacks mandatory factual backbone |
| Handles disputed topics responsibly | Pushes one contested reading as settled fact |
| Feels complete before edit | Reads like an unfinished research stub |
| Uses imagery sparingly and consistently | Overuses images or applies them arbitrarily |

## 15. Success Metrics

Success should be defined by quality and usability, not only throughput.

| Metric area | Example measure |
|---|---|
| **Story richness** | Average story depth, event count, synthesis completeness |
| **Trust quality** | Percentage of stories meeting source and validation thresholds |
| **Creator efficiency** | Time from brief to first full draft, time from draft to publish |
| **Publish confidence** | Draft-to-publish conversion rate |
| **Visual consistency** | QA pass rate against approved imagery and layout rules |

## 16. Functional Requirements

| Requirement ID | Requirement |
|---|---|
| **FR-1** | The system must accept a creator research brief and story parameters |
| **FR-2** | The system must suggest alternate or richer framings for the story |
| **FR-3** | The system must generate a full draft story before human editing |
| **FR-4** | Every generated story must include a timeline |
| **FR-5** | Every generated story must include references |
| **FR-6** | The creator must be able to edit any generated content before publishing |
| **FR-7** | The reader-facing story must show creator attribution |
| **FR-8** | The system must surface contested or alternate viewpoints where materially relevant |
| **FR-9** | The system must apply approved image-surface rules |
| **FR-10** | The system must block publication when minimum trust requirements are not met |

## 17. Acceptance Criteria for v1

| Area | Acceptance criterion |
|---|---|
| **Creation** | A creator can enter a brief and receive a complete sourced draft |
| **Framing** | The system suggests richer framing options before full generation |
| **Timeline** | Every publishable story contains a coherent chronology |
| **References** | Every publishable story contains visible references |
| **Editing** | The creator can fully revise AI-generated content |
| **Trust** | Readers can see sources and creator identity clearly |
| **Disputed topics** | The product surfaces alternate viewpoints where needed |
| **Imagery** | Stories follow approved selective image-surface policy |

## 18. Open Product Questions

| Question | Why it matters |
|---|---|
| **What are the exact v1 story types?** | Determines routing, templates, and prompts |
| **How strong must alternate-viewpoint surfacing be?** | Affects trust UI and validation rules |
| **What qualifies as sufficient breadth for a story?** | Defines automatic rejection or warning logic |
| **How should subtle edit disclosure be presented?** | Affects reader trust without adding clutter |
| **Which source classes are preferred?** | Affects research ranking and trust weighting |

## 19. Release Recommendation

The product should be built in phases, beginning with the strongest core loop: story brief, AI draft generation, human edit, and reader-facing publication with timeline and sources. Secondary features should not distract from that main loop in v1.

| Phase | Focus |
|---|---|
| **Phase 1** | Story generation core, timeline assembly, reference model |
| **Phase 2** | Human editing flow, creator attribution, trust presentation |
| **Phase 3** | Selective imagery workflow and disputed-view handling refinement |
| **Phase 4** | Launch polish, quality thresholds, analytics |

## 20. Final Product Definition

Storywall v1 is a product for creating **sourced, timeline-based non-fiction stories** where AI does the first complete pass and the creator does the final shaping. It succeeds when the resulting stories are richer than a post, more grounded than an opinion piece, and more visually coherent than a generic timeline.
