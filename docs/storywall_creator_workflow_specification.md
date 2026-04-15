# Storywall Creator Workflow Specification

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **creator-side operating workflow** for Storywall v1. It translates the product model into a concrete sequence of states, decisions, and outputs that a design team, product team, and engineering team can build against. The workflow is intentionally aligned to the Storywall principle that the product is a **creator-led, AI-first, non-fiction context engine** rather than a blank-page editor or a generic article generator.

The governing rule is simple: the creator supplies the direction, the system performs the heavy research and assembly work, and the creator retains full editorial control before publication. Storywall should therefore feel less like “write with AI” and more like “direct an expert research-and-drafting assistant that returns a complete, sourced story draft.”

| Workflow principle | Operational meaning |
|---|---|
| **Creator-led** | The creator defines subject, angle, scope, and publishing intent |
| **AI-first** | The system creates the first complete story draft before human editing |
| **Non-fiction only** | The workflow is for researchable, sourceable story subjects |
| **Timeline mandatory** | Every draft and published story must preserve a chronological backbone |
| **References mandatory** | Every publishable story must show factual references |
| **Human final control** | The creator may revise, remove, reorder, and rewrite any AI-generated content |
| **Minimal editorial skew** | Factual summaries must remain distinct from creator commentary |
| **Selective imagery** | Imagery is proposed only on approved surfaces and never by default for all events |

## 2. Workflow Objective

The objective of the creator workflow is to move a story from **research brief** to **publish-ready, sourced Storywall** with as little blank-page effort as possible and without weakening factual discipline. The system should eliminate the creator’s need to manually gather every date, event, and source from scratch, while still preserving the creator’s authority over framing and interpretation.

A Storywall session should therefore produce four concrete artifacts before publication: a normalized brief, an approved framing, a complete sourced story draft, and a validated publication package.

| Artifact | Description | Owner |
|---|---|---|
| **Normalized brief** | Clean internal representation of the creator’s intent | System |
| **Approved framing** | Selected story angle, scope, and narrative lens | Creator |
| **Complete story draft** | Timeline, event summaries, references, trust metadata, and synthesis | System |
| **Publication package** | Final edited story with validation results and publish status | Creator + System |

## 3. User Roles

The workflow involves three functional roles even if, in early v1, some responsibilities are performed by the same person. Separating them at the specification level clarifies the trust model and future moderation options.

| Role | Responsibility |
|---|---|
| **Creator** | Defines the story, selects framing, edits content, approves imagery, and publishes |
| **AI system** | Normalizes input, proposes framings, researches, assembles the full draft, proposes imagery, and validates structure |
| **Reviewer layer** | Optional human or rules-based review function for disputed, weakly sourced, or quality-risk stories |

The creator remains the accountable publisher of the final Storywall. The AI system is an assistant and assembler, not the legal or editorial owner of the content.

## 4. End-to-End Workflow Summary

The Storywall creator workflow should be implemented as a staged pipeline rather than a single prompt interaction. Each stage should end with a structured output that the next stage can consume.

| Stage | Name | Primary actor | Core output |
|---|---|---|---|
| **0** | Entry and brief intake | Creator | Initial story request |
| **1** | Brief normalization | AI system | Clean internal brief and risk signals |
| **2** | Framing proposals | AI system + Creator | Chosen story angle and scope |
| **3** | Research and source assembly | AI system | Evidence package and candidate developments |
| **4** | Full draft story assembly | AI system | Complete draft with timeline and references |
| **5** | Imagery proposal | AI system + Creator | Approved image plan for eligible surfaces |
| **6** | Human editing and refinement | Creator | Revised publication draft |
| **7** | Validation and trust review | AI system + Creator | Publish readiness decision |
| **8** | Publication | Creator | Published Storywall |

## 5. State Model

The product should treat a story as moving through a small set of explicit workflow states. These states should be visible in the creation interface so creators understand what is complete, what is pending, and what blocks publication.

| State | Meaning | Exit condition |
|---|---|---|
| **Drafting brief** | Creator has started entering story inputs | Required story inputs completed |
| **Awaiting framing choice** | AI has generated framing options | Creator selects or edits a framing |
| **Researching** | AI is gathering sources and building the story basis | Research package completed |
| **Assembling draft** | AI is generating the full story draft | Draft package completed |
| **Ready for edit** | Full draft exists and creator can edit | Creator starts revision or requests regeneration |
| **Needs validation** | Creator indicates story is structurally complete | Validation pass starts |
| **Blocked** | Validation found publication blockers | Creator resolves blockers |
| **Ready to publish** | Validation requirements are met | Creator confirms publish |
| **Published** | Story is live | Publication successful |

## 6. Stage 0 — Entry and Brief Intake

The first screen should not be a raw prompt box alone. Storywall should collect structured direction from the creator because story quality depends heavily on the initial framing and scope. This stage should help the creator define not just the subject, but also the explanatory goal of the story.

| Field | Required | Description |
|---|---|---|
| **Subject** | Yes | Person, topic, event, movement, organization, or issue |
| **Story type** | Yes | Biography, issue history, relationship impact, influence, controversy, movement history, or similar v1 type |
| **Research brief** | Yes | Plain-language description of the story the creator wants |
| **Desired angle** | Yes | The creator’s initial framing or hypothesis |
| **Time scope** | No, but strongly encouraged | Entire history, bounded period, or relevant era |
| **Audience** | No | General, fan, student, specialist, or custom |
| **Narrative intent** | Yes | Documentary, explanatory, analytical, commemorative, or comparative |
| **Imagery mode** | Yes | Selective editorial, minimal, sourced only, or no imagery |

When the creator provides an incomplete or overly vague brief, the system should assist rather than reject immediately. Storywall should offer **canned prompt starters** for common subjects and also prompt the creator to sharpen the angle.

| Subject class | Suggested starter |
|---|---|
| **Person** | “A biography of…” |
| **Person** | “The life and times of…” |
| **Person** | “The relationships that shaped…” |
| **Topic** | “A history of…” |
| **Topic** | “The key milestones in…” |
| **Issue / event** | “How … unfolded and why it mattered” |

### Stage 0 rules

The product should block progress only when the brief is unusably thin. In most cases, it should convert weak input into a clearer prompt by asking one or two follow-up questions rather than forcing the creator to start over.

| Intake condition | System behavior |
|---|---|
| **Subject present, angle weak** | Suggest 2 to 4 framing options |
| **Subject broad, time scope absent** | Suggest recommended time boundaries |
| **Research brief missing specificity** | Ask clarifying question or offer starters |
| **Subject non-factual or fictional** | Reject for v1 and explain non-fiction requirement |
| **Angle implies disputed claim** | Flag potential viewpoint-balance requirement |

## 7. Stage 1 — Brief Normalization

Once the creator submits the initial brief, the system should normalize it into a structured internal object. This step is essential because later stages should not depend on loose natural-language interpretation alone.

The normalization pass should infer subject type, identify likely date boundaries, detect ambiguity, and produce a ranked set of possible story angles. It should also identify early risks such as low-source availability, likely controversy, excessive breadth, or excessive narrowness.

| Output field | Purpose |
|---|---|
| **normalized_subject** | Canonical internal subject label |
| **subject_type** | Person, issue, event, movement, organization, place, or topic |
| **suggested_time_scope** | Recommended date range or reason for open-ended scope |
| **story_angle_candidates** | Two to four candidate frames |
| **risk_flags** | Ambiguity, disputed framing, low-source risk, recent-event instability, scope imbalance |
| **recommended_creation_mode** | AI-first, hybrid, or manual-heavy warning |

### Normalization guardrails

| Risk | Meaning | Expected response |
|---|---|---|
| **Too broad** | Subject cannot be covered coherently in one Storywall | Recommend tighter angle or bounded period |
| **Too narrow** | Story covers too small a slice to produce real context | Recommend a broader contextual frame |
| **Likely disputed** | Topic involves major interpretive disagreement | Require alternate-view surfacing later |
| **Low-source** | Factual grounding may be too weak | Warn creator before generation |
| **Recent/volatile** | Facts may still be changing | Lower confidence and stronger validation later |

## 8. Stage 2 — Framing Proposals and Selection

After normalization, the system should propose richer or alternative framings. This is one of the most important parts of the Storywall workflow because the product succeeds when creators do not just generate stories, but generate the **right** stories.

The creator should never be forced to accept an AI-generated framing. The purpose of this stage is to expand possibility, not to replace creator judgment.

| Framing output | Description |
|---|---|
| **Working title option** | A concise title candidate |
| **One-sentence lens** | The central framing sentence |
| **Scope rationale** | Why the frame is appropriately broad and useful |
| **Coverage implications** | What kinds of events the frame will prioritize |
| **Balance note** | Whether alternate perspectives will need explicit treatment |

### Creator choices at this stage

| Creator action | Effect |
|---|---|
| **Accept a framing** | The accepted frame becomes the story basis |
| **Edit a framing** | Creator modifications become the new basis |
| **Combine framings** | System merges into one approved working frame |
| **Request new options** | AI generates a revised set of angle proposals |
| **Change scope** | Normalization reruns with adjusted boundaries |

The stage should end only when the creator has approved a framing. Story generation should not begin until the system has an explicit angle because Storywall is not meant to return a generic encyclopedia timeline.

## 9. Stage 3 — Research and Source Assembly

After framing approval, the system should begin the research pass. This is the phase in which Storywall behaves like a research assistant rather than like a prose generator. The goal is to collect factual anchors, relevant developments, corroborating sources, and obvious areas of uncertainty before the story draft is written.

The research stage should focus on **events and developments**, not on article summaries. A source should attach to an event only if it materially supports or contextualizes that event.

| Research output | Description |
|---|---|
| **Candidate events** | Chronological developments relevant to the chosen framing |
| **Source bundle** | Articles, archives, reports, interviews, or records tied to specific events |
| **Corroboration map** | Which sources support which event objects |
| **Dispute map** | Events or claims where sourced viewpoints materially differ |
| **Coverage gaps** | Missing periods, unsupported claims, or weakly evidenced sections |

### Research-stage rules

| Rule | Reason |
|---|---|
| **Event-led extraction** | Keeps Storywall focused on developments rather than headlines |
| **Date precision required** | Allows the system to represent uncertainty honestly |
| **Low-confidence developments can exist** | But they must be labeled appropriately and not overclaimed |
| **Duplicate developments must collapse into one event** | Prevents inflated or repetitive timelines |
| **Disputed claims must be tracked separately** | Enables later trust surfacing without rewriting facts as opinion |

### Research-stage classifications

| Classification | Meaning |
|---|---|
| **Verified** | Strongly supported by reliable sources |
| **Mostly verified** | Supported but not fully corroborated |
| **Emerging** | Plausible but early or unstable |
| **Disputed** | Sourced accounts materially disagree |
| **Unsupported** | Not publishable without additional evidence |
| **Chatter** | Reported development with low confidence and limited weight |

The system should not yet write the final public narrative in this stage. Its job is to assemble the factual material and confidence posture that the draft builder will use.

## 10. Stage 4 — Full Draft Story Assembly

This is the defining stage of the Storywall workflow. Once framing is approved and research is assembled, the system should generate the **complete story draft before human editing**. That draft should be structurally publishable even if it still requires creator refinement.

A complete draft should include the hero framing, timeline structure, event summaries, source references, trust metadata, optional creator-note placeholders, and end synthesis. The draft should already feel coherent, not like a research dump awaiting heavy manual reconstruction.

| Draft component | Required | Description |
|---|---|---|
| **Title** | Yes | Public story title aligned to chosen framing |
| **Summary / dek** | Yes | Short factual overview of the story |
| **Framing statement** | Yes | Declared angle or explanatory lens |
| **Timeline structure** | Yes | Ordered events or grouped chronological sections |
| **Event cards** | Yes | Date, headline, factual summary, significance, references |
| **Source references** | Yes | Attached at story and/or event level |
| **Trust metadata** | Yes | Confidence, dispute posture, and evidence signals |
| **Creator note slots** | Yes | Places where creator commentary may be added |
| **Synthesis ending** | Yes | Concluding sense-making block |
| **Image eligibility map** | Yes | Which surfaces qualify for imagery |

### Draft-writing rules

| Rule | Effect |
|---|---|
| **Write factual summaries separately from creator commentary** | Prevents invisible editorialization |
| **Preserve timeline backbone even for thematic stories** | Maintains Storywall identity |
| **Promote only the most important events to turning points** | Protects hierarchy |
| **Avoid over-fragmentation** | Prevents bloated, low-value event stacks |
| **Ensure breadth relative to chosen frame** | Reduces thin or under-contextualized outputs |
| **Always include references before draft completion** | Prevents unsupported prose from hardening into publish flow |

### Draft quality threshold

A draft should be considered complete only if a creator can review it as a coherent story rather than as a partial scaffold. That means the AI output must answer the core creator request, not merely list some events and expect the human to supply the actual story logic.

## 11. Stage 5 — Imagery Proposal

After the full text draft exists, the system should propose imagery according to the approved Storywall imagery policy. This stage is intentionally downstream from story assembly because imagery should support narrative structure, not drive it.

| Surface | Default rule | System behavior |
|---|---|---|
| **Story hero** | Usually eligible | Propose one strong editorial image |
| **Turning point** | Selectively eligible | Propose only for major narrative pivots |
| **Context / synthesis block** | Conditionally eligible | Propose when a visual clarifies the story |
| **Standard event card** | Usually ineligible | No image by default |
| **Low-confidence event** | Ineligible by default | Prefer text-only |

### Imagery proposal outputs

| Output | Description |
|---|---|
| **Surface recommendation** | Where imagery should appear |
| **Asset type** | Generated editorial visual, sourced image, abstract graphic, map, or none |
| **Prompt or selection rationale** | Why the proposed image supports the story |
| **Provenance note** | Generated, licensed, creator-uploaded, or sourced |
| **Risk note** | Recognition risk, factual overstatement risk, or style mismatch |

The creator should be able to accept, reject, swap, or remove every image proposal. No image should be mandatory except where product design later makes a story-hero visual compulsory as a layout choice.

## 12. Stage 6 — Human Editing and Refinement

Once the full draft is available, the creator enters the main editing stage. This is where Storywall becomes creator-led in visible form. The system has done the heavy lifting, but the creator now has full authority over the story’s final shape.

The editing model should be direct and permissive. The creator must be able to change any headline, rewrite any summary, remove events, add context, change order where justified, insert creator notes, and adjust or remove imagery. The product should never trap the creator inside a locked AI artifact.

| Editable element | Creator control |
|---|---|
| **Title and dek** | Full edit |
| **Framing statement** | Full edit |
| **Timeline structure** | Reorder, group, merge, split, or remove within validation constraints |
| **Event summaries** | Rewrite, shorten, or expand |
| **Creator notes** | Add, remove, or rewrite freely |
| **References** | Review, remove weak sources, add stronger ones |
| **Trust flags** | Cannot be manually hidden if system-detected, but creator can address their causes |
| **Imagery** | Approve, remove, replace, or skip |
| **Synthesis** | Full edit |

### Edit signaling model

The user requirement is to keep edit signaling subtle. Storywall should therefore avoid heavy “AI vs human diff theater.” Instead, it should maintain internal provenance while exposing only a light-touch signal where meaningful.

| Edit signal policy | Meaning |
|---|---|
| **Default** | No loud per-line authorship markers |
| **Where substantial manual revision occurred** | Optional subtle “creator revised” or equivalent metadata treatment |
| **Internal audit layer** | Full provenance retained for system logic and moderation |
| **Reader-facing principle** | Trust should come mainly from sources and creator identity, not novelty labeling |

### Regeneration rules during editing

| Creator action | System response |
|---|---|
| **Regenerate one event** | Rebuild only that event and preserve surrounding manual edits |
| **Regenerate a section** | Rebuild that section under current framing |
| **Change framing materially** | Warn that major regeneration may affect the whole story |
| **Add creator-provided source** | Re-run corroboration and optionally update affected events |
| **Delete a critical event** | Allow, but trigger validation if chronology becomes structurally weak |

## 13. Stage 7 — Validation and Trust Review

Before publication, Storywall should validate the story against structural, factual, and trust-based rules. Validation is not merely grammar checking. It is the final gate that determines whether the story meets the minimum Storywall standard.

| Validation domain | What is checked |
|---|---|
| **Structure** | Presence of title, framing, timeline, and synthesis |
| **Chronology** | Order, date precision handling, and sequence coherence |
| **Factual sufficiency** | Whether major claims have visible support |
| **Reference sufficiency** | Whether references are present and attached meaningfully |
| **Scope adequacy** | Whether the story is too brief or too narrow for its stated frame |
| **Dispute handling** | Whether contested viewpoints are surfaced when relevant |
| **Imagery compliance** | Whether image usage follows policy |
| **Trust presentation** | Whether creator identity and source visibility are intact |

### Validation outcome states

| Outcome | Meaning | Publish effect |
|---|---|---|
| **Pass** | Story meets minimum Storywall standard | Publish allowed |
| **Pass with warnings** | Story is publishable but has quality risks | Publish allowed with creator acknowledgment |
| **Blocked** | Story fails mandatory requirements | Publish disallowed |

### Typical blockers

| Blocker | Description |
|---|---|
| **No timeline backbone** | Story lacks coherent chronology |
| **No visible references** | Story fails mandatory trust requirement |
| **Insufficient breadth** | Story is too slight for its framing |
| **Unsupported key claims** | Important claims lack evidence |
| **Unsurfaced dispute** | Story advances a disputed reading without acknowledging alternatives |
| **Imagery misuse** | Images attached where policy disallows or where they mislead |

Validation should return actionable guidance, not just failure labels. The creator must understand exactly what to fix and why it matters.

## 14. Stage 8 — Publication

Once the story passes validation, the creator may publish it. Publication should create a stable public Storywall object containing the final approved text, trust metadata, and image placements.

The published story should clearly show the creator identity, preserve source visibility, and retain the distinction between factual event summaries and creator commentary. Publication should not strip away the trust layer for aesthetic simplicity.

| Publish artifact | Requirement |
|---|---|
| **Public story URL** | Required |
| **Creator attribution** | Required |
| **Visible references** | Required |
| **Trust indicators** | Required |
| **Timeline structure** | Required |
| **Selective imagery** | Preserved only where approved |
| **Provenance metadata** | Retained internally and surfaced subtly where policy requires |

## 15. Happy Path User Journey

The intended creator experience can be summarized as a simple, high-confidence path. The interface should make this flow feel linear even if the underlying system is modular.

| Step | Creator experience |
|---|---|
| **1** | Enter subject, brief, angle, and story settings |
| **2** | Review AI-suggested framings and approve one |
| **3** | Wait while the system researches and assembles sources |
| **4** | Receive a complete sourced story draft |
| **5** | Review proposed hero and turning-point imagery |
| **6** | Edit text, references, notes, and images |
| **7** | Run validation and resolve any blockers |
| **8** | Publish the story |

## 16. Failure and Recovery Paths

The workflow should assume that not every story will be cleanly generatable on the first pass. v1 should therefore define clear fallback behavior.

| Failure condition | Expected fallback |
|---|---|
| **Brief too vague** | Ask clarifying question and propose starter frames |
| **Research returns weak sources** | Warn creator and reduce confidence posture |
| **Story too narrow after generation** | Recommend expanding scope or broadening frame |
| **Too many repetitive events** | Compress, merge, and re-rank events |
| **Disputed topic handled one-sidedly** | Insert alternate-view requirement before publish |
| **Creator rewrites major portions** | Preserve final authority while keeping subtle provenance internally |
| **Creator wants manual-heavy flow** | Allow manual editing but keep validation and reference requirements mandatory |

## 17. Product and Interface Requirements

The workflow should drive the editor design, not the other way around. The product interface should expose the stages clearly and provide the right tools at each step.

| Interface area | Required capability |
|---|---|
| **Brief panel** | Structured intake fields and suggested starters |
| **Framing chooser** | View, compare, edit, and approve angle options |
| **Research status view** | Show progress and risk signals without noisy technical detail |
| **Draft editor** | Edit all story fields and event objects directly |
| **Reference inspector** | Review source support at story and event level |
| **Trust panel** | Display confidence, dispute, and blocker states |
| **Image manager** | Approve or reject image proposals by eligible surface |
| **Validation report** | Explain blockers, warnings, and fixes |
| **Publish action** | Disabled until mandatory requirements pass |

## 18. Data and Handoff Requirements

Each workflow stage should write structured outputs so later engineering work can define API contracts and persistence rules cleanly.

| Stage | Minimum persisted output |
|---|---|
| **Brief intake** | Story setup object |
| **Normalization** | Canonical brief object and risk flags |
| **Framing** | Approved angle object |
| **Research** | Event candidates, source links, corroboration map |
| **Draft assembly** | Draft story object with timeline and trust fields |
| **Imagery proposal** | Surface eligibility and asset proposal set |
| **Editing** | Final creator-approved content and provenance metadata |
| **Validation** | Pass/warning/block result set |
| **Publication** | Public story version record |

## 19. Acceptance Criteria

This workflow specification should be considered successfully implemented only if the product can support the following outcomes.

| ID | Acceptance criterion |
|---|---|
| **WF-1** | A creator can start from a structured brief rather than a blank editor |
| **WF-2** | The system proposes multiple framing options before story generation |
| **WF-3** | The system produces a complete sourced draft before the creator is expected to write manually |
| **WF-4** | Every draft includes a timeline and references |
| **WF-5** | The creator has full editing control over generated content |
| **WF-6** | Imagery proposals follow the selective imagery policy |
| **WF-7** | Validation blocks stories that fail mandatory structural or trust requirements |
| **WF-8** | Published stories show creator identity and visible references |
| **WF-9** | The workflow supports disputed-view surfacing where relevant |
| **WF-10** | The final creator journey feels substantially faster than manual from-scratch story construction |

## 20. Recommended Next Specification Dependency

The next document in the sequence should be the **Publishing and Trust Standard**. This workflow document defines *how stories are made*. The next document must define *what counts as sufficiently sourced, balanced, and publishable*. Without that standard, validation logic, reader trust presentation, and editorial quality thresholds will remain under-specified.
