# Storywall Reviewer Permissions and Moderation-State Contract

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **reviewer permissions and moderation-state contract** for Storywall v1. Its purpose is to specify how reviewer authority operates once creator-side drafting, validation, and publish workflows are in place. It translates the approved creator workflow, publishing and trust rules, editor/CMS model, and creator-side mutation contracts into a formal operating model for human review, escalation, and intervention.[1] [2] [3] [4]

Storywall is explicitly **creator-led**, but it is not creator-only. The product definition allows high-risk stories, disputed frames, source-thin drafts, and trust-sensitive publication decisions to move through an additional reviewer layer when automated checks or editorial judgment indicate that extra scrutiny is warranted.[1] [2] The reviewer contract therefore needs to protect two goals at the same time: preserving creator ownership of the story and preserving Storywall’s minimum trust standard at the point of publication.[1] [2]

| Contract principle | Operational meaning |
|---|---|
| **Creator ownership remains primary** | Reviewers should not silently replace creator judgment or take over ordinary drafting by default |
| **Trust protection is enforceable** | Reviewers must be able to stop publication when mandatory publish conditions fail |
| **Moderation is stateful** | Review and intervention should move through explicit moderation states, not ad hoc comments |
| **Authority is role-bounded** | Different reviewer roles should have different powers over requests, holds, approvals, and overrides |
| **Auditability is mandatory** | All moderation actions, especially holds and overrides, must produce durable internal records |
| **Publish discipline beats convenience** | Stories should not bypass reviewer or trust gates merely because the creator is ready to publish |

## 2. Scope

This contract governs the authenticated **reviewer-side authority model** for Storywall v1. It covers reviewer roles, action permissions, moderation states, state transitions, assignment flows, escalation paths, audit requirements, and creator-reviewer interaction points. It does not redefine the public reader API, and it does not replace the creator-side mutation contract. Instead, it sits on top of that write system and governs how reviewer actors can inspect, block, return, approve, or escalate stories.[2] [4]

| Included area | Covered here |
|---|---|
| **Reviewer role definitions** | Yes |
| **Permissions by role** | Yes |
| **Moderation states and transitions** | Yes |
| **Assignment and escalation** | Yes |
| **Publish holds and overrides** | Yes |
| **Audit and provenance requirements** | Yes |
| **Reviewer-side actions against stories, events, sources, and imagery** | Yes |
| **Public reader trust presentation** | Indirectly, where moderation affects visibility |
| **Full reviewer UI design** | No |
| **General abuse or community moderation for comments/social features** | No |

## 3. Relationship to Existing Storywall Contracts

This reviewer contract should be read as an operational layer above four already-defined Storywall documents. The creator workflow establishes where review enters the process. The publishing standard establishes what reviewers are enforcing. The editor/CMS model establishes which records exist to be reviewed. The creator-side mutation contract establishes the write system that reviewer interventions must coexist with.[1] [2] [3] [4]

| Upstream document | Reviewer-contract dependency |
|---|---|
| **Creator Workflow Specification** | Defines the stage model, blocked state, ready-to-publish state, and the possibility of high-risk review layers |
| **Publishing and Trust Standard** | Defines pass, warning, and block thresholds, source sufficiency, dispute handling, and imagery misuse rules |
| **Editor/CMS Input Model** | Defines the draft, source, image, validation, and publish records that reviewers inspect or annotate |
| **Creator-Side Mutation and API Contracts** | Defines the creator write surface that reviewer permissions must complement rather than contradict |

## 4. Why Reviewer Authority Exists in v1

Storywall v1 is designed to publish grounded, source-visible, timeline-based stories rather than freeform opinion pieces.[1] [2] That means there are predictable situations where automated validation and creator intent alone are not enough. Examples include materially disputed framing, unsupported causal claims, imagery that overstates certainty, thin scope relative to the chosen frame, and stories that are technically complete but still editorially risky.[2]

Reviewers exist to enforce the **minimum publishing bar**, not to convert Storywall into a bureaucracy. The default path should still be creator-led publication for ordinary stories that satisfy validation. Reviewer authority should activate when the risk profile, trust posture, or platform standards justify human intervention.[1] [2]

| Review trigger type | Why reviewer involvement may be needed |
|---|---|
| **Blocked validation result** | A mandatory publish condition has failed |
| **Pass with warnings on sensitive stories** | Human judgment may be needed before public visibility |
| **Disputed framing or contested causality** | Alternate-view treatment may require editorial scrutiny |
| **Low-confidence or chatter-heavy draft** | Review may be needed to prevent overstatement |
| **Imagery misuse risk** | Visual treatment can mislead even if text is sourced |
| **Post-publication trust concern** | A published story may need intervention or visibility change |

## 5. Reviewer Role Taxonomy

Storywall should not treat every internal reviewer as having the same authority. A layered role model reduces accidental overreach and makes audit trails easier to interpret.

### 5.1 Recommended v1 reviewer roles

| Role | Primary function | Core authority |
|---|---|---|
| **Creator** | Owns story drafting and ordinary publication workflow | Full control over owned story drafts within creator permissions |
| **Reviewer** | Performs standard trust and quality review | Can inspect, comment, request changes, assign review state, and place non-final holds |
| **Trust reviewer** | Handles higher-risk trust questions | Can confirm blocks, mark dispute handling insufficient, require evidence fixes, and approve trust-sensitive stories |
| **Director** | Final editorial authority for exceptional cases | Can approve publish overrides, sustain or release high-severity holds, and authorize emergency visibility changes |

The use of **director** as the highest authority term is intentional and should remain consistent across Storywall documentation.[5]

### 5.2 Role design rationale

The standard reviewer role should be able to keep ordinary review moving without carrying unilateral authority over exceptional or politically sensitive decisions. The trust reviewer role should handle the most trust-bearing cases because those cases often depend on nuanced judgments about evidence sufficiency, disputed framing, and publication risk.[2] The director role should exist only for rare overrides, deadlocks, or urgent post-publication interventions, not for routine drafting choices.

## 6. Permission Model by Role

The safest reviewer model is **bounded intervention**. Reviewers should have strong authority over visibility, readiness, and trust state, but limited authority over silently rewriting creator narrative fields.

### 6.1 Permission matrix

| Action family | Creator | Reviewer | Trust reviewer | Director |
|---|---|---|---|---|
| View assigned draft workspace | Yes | Yes | Yes | Yes |
| Comment on draft objects | Yes | Yes | Yes | Yes |
| Request creator changes | No separate role needed | Yes | Yes | Yes |
| Assign or reassign reviewer | No | Yes, within lane | Yes | Yes |
| Place ordinary review hold | No | Yes | Yes | Yes |
| Place trust hold | No | Recommend only | Yes | Yes |
| Confirm publish readiness | Self through creator flow | Yes, for standard cases | Yes | Yes |
| Publish directly | Yes, when allowed | No by default | No by default | Yes, only in override cases |
| Override blocked publish | No | No | No | Yes |
| Change public visibility post-publish | No, except own ordinary unpublish path | Limited, if policy allows | Yes for trust reasons | Yes |
| Patch creator narrative fields directly | Yes | No by default | No by default | No by default |
| Patch moderation metadata and review records | No | Yes | Yes | Yes |
| Patch trust or dispute annotations | Limited through creator fields | Yes | Yes | Yes |
| Approve or reject imagery for trust reasons | Yes | Yes | Yes | Yes |
| Force-remove misleading image from public view | No | Recommend only | Yes | Yes |

### 6.2 Core boundary rule

Reviewer authority should be strongest over **state**, **readiness**, **visibility**, **annotation**, and **requirements**, but weakest over **unilateral rewriting of creator-authored narrative content**. That division preserves creator ownership while still allowing Storywall to enforce trust and publication policy.[1] [2] [4]

Reviewers may annotate a story as insufficient, hold it, return it for changes, or require alternate-view treatment. They should not silently edit factual summaries, creator notes, or synthesis prose except in narrowly defined emergency or formatting-safe scenarios that are themselves logged as privileged actions.

## 7. Moderation Object Model

The moderation system should persist its own durable records rather than relying only on comments or ephemeral UI flags. The reviewer layer therefore needs a compact set of moderation-bearing objects that sit alongside the editor data model.[3]

| Moderation object | Purpose |
|---|---|
| `review_assignment` | Tracks who is responsible for active review |
| `moderation_state_entry` | Stores state changes with actor, rationale, and timestamps |
| `review_comment` | Stores structured feedback attached to story, section, event, source, image, or validation issue |
| `review_requirement` | Stores required fixes or publish conditions imposed by a reviewer |
| `override_decision` | Stores director-level exception decisions |
| `visibility_intervention` | Stores emergency post-publication visibility changes |

These objects should remain separate from creator-authored draft fields so that reviewer actions do not blur into narrative authorship.

## 8. Moderation States

Storywall already has creator workflow states such as `ready_for_edit`, `blocked`, and `ready_to_publish`.[1] [4] Reviewer moderation needs its own state model that overlays those workflow states without replacing them.

### 8.1 Recommended moderation states

| Moderation state | Meaning | Typical entry trigger |
|---|---|---|
| `none` | No reviewer intervention is active | Default state |
| `queued_for_review` | Story has entered reviewer intake but is not yet owned | Validation outcome, manual escalation, or publish-prep route |
| `in_review` | A reviewer is actively reviewing the story | Reviewer assignment accepted |
| `changes_requested` | Creator must address reviewer requirements before publication | Insufficient support, missing structure, or incomplete dispute handling |
| `trust_hold` | Story cannot advance until trust-critical issues are resolved | Unsupported claims, contested framing, imagery misuse, or misleading evidence posture |
| `director_review` | Case requires highest-level editorial resolution | Override request, deadlock, or exceptional sensitivity |
| `approved_for_publish` | Reviewer process is complete and no reviewer-side hold remains | Reviewer or trust reviewer approval |
| `post_publish_watch` | Published story is live but under ongoing reviewer observation | Emerging dispute, evolving evidence, or correction monitoring |
| `visibility_restricted` | Story visibility is limited or suspended for trust reasons | Serious post-publication issue |
| `closed` | Review case is complete and inactive | Story published cleanly, archived, or withdrawn |

### 8.2 Relationship between workflow state and moderation state

A story may be `ready_to_publish` in the creator workflow but still be `queued_for_review` or `trust_hold` in moderation. Publication should require both a publishable creator state and a non-blocking reviewer state.[1] [2] [4]

| Creator workflow state | Moderation interpretation |
|---|---|
| `ready_for_edit` | Reviewer may annotate or request changes, but publish is not yet expected |
| `needs_validation` | Reviewer usually waits for validation unless early intervention is necessary |
| `blocked` | Reviewer may confirm the block, add requirements, or escalate |
| `ready_to_publish` | Reviewer may approve, queue, hold, or escalate |
| `published` | Reviewer may move to `post_publish_watch` or `visibility_restricted` if trust issues arise |

## 9. Moderation-State Transition Rules

Reviewer actions should produce explicit state transitions with clear legal paths. This prevents ambiguous internal statuses and makes escalation auditable.

| From state | Action | To state | Allowed actor |
|---|---|---|---|
| `none` | Queue for review | `queued_for_review` | System, reviewer, trust reviewer |
| `queued_for_review` | Accept assignment | `in_review` | Reviewer, trust reviewer, director |
| `in_review` | Request changes | `changes_requested` | Reviewer, trust reviewer, director |
| `in_review` | Place trust hold | `trust_hold` | Trust reviewer, director |
| `in_review` | Approve review | `approved_for_publish` | Reviewer, trust reviewer, director |
| `changes_requested` | Creator resolves requirements and resubmits | `queued_for_review` | System or creator-triggered workflow |
| `trust_hold` | Escalate for exceptional judgment | `director_review` | Trust reviewer, director |
| `director_review` | Release with approval | `approved_for_publish` | Director |
| `director_review` | Sustain hold | `trust_hold` | Director |
| `approved_for_publish` | Publish completed | `closed` or `post_publish_watch` | System |
| `published` overlay | Open post-publication monitoring | `post_publish_watch` | Reviewer, trust reviewer, director |
| `post_publish_watch` | Restrict visibility | `visibility_restricted` | Trust reviewer, director |
| `visibility_restricted` | Restore after review | `closed` or `post_publish_watch` | Director |

## 10. Entry Conditions for Reviewer Involvement

Not every story should require a reviewer. Reviewer involvement should be triggered by explicit conditions so the operating model remains scalable.

| Trigger | Default reviewer behavior |
|---|---|
| **Creator requests review** | Queue for standard review |
| **Validation result is `blocked`** | Queue automatically and attach blocker report |
| **Validation result is pass with warnings on disputed topic** | Queue for trust review |
| **Story includes contested causal framing** | Queue for trust review |
| **Story includes multiple `emerging`, `disputed`, or `chatter` events in critical positions** | Queue for trust review |
| **Imagery risk flagged** | Queue for imagery trust check |
| **Post-publication challenge or correction signal** | Open post-publication review |

These triggers should be implemented as operational defaults, with the option for human reviewers to escalate additional cases.

## 11. Reviewer Actions by Content Surface

Reviewer authority should differ slightly depending on which object is under review.

### 11.1 Story-level reviewer actions

| Story surface | Reviewer action | Typical outcome |
|---|---|---|
| Title, summary, framing, synthesis | Comment or require change | Creator revision required |
| Scope adequacy | Mark insufficient | `changes_requested` or `trust_hold` |
| Fact/commentary separation | Flag blending in core fields | `changes_requested` or `trust_hold` |
| Dispute handling | Require alternate-view module or dispute note | `changes_requested` or `trust_hold` |
| Publish readiness | Approve or withhold approval | `approved_for_publish` or hold |

### 11.2 Event-level reviewer actions

| Event surface | Reviewer action | Typical outcome |
|---|---|---|
| Headline or summary overstating certainty | Comment or require rewrite | Creator revision required |
| Date or chronology issue | Require correction | Event remains unresolved |
| Confidence state mismatch | Adjust trust annotation or require creator confirmation | Validation rerun or hold |
| Event significance inflation | Request demotion or de-emphasis | Creator revision required |
| Chatter event over-prominence | Require de-emphasis or removal | `changes_requested` |

### 11.3 Source-level reviewer actions

| Source surface | Reviewer action | Typical outcome |
|---|---|---|
| Weak relevance | Mark decorative or insufficient | Requirement added |
| Verification mismatch | Downgrade trust posture or require stronger source | Requirement added |
| Missing support for key claim | Escalate to trust hold if central | `trust_hold` possible |
| Public visibility of sensitive source | Restrict from public view if needed | Internal-only source status |

### 11.4 Image-level reviewer actions

| Image surface | Reviewer action | Typical outcome |
|---|---|---|
| Misleading certainty | Reject image | Replacement required |
| Ineligible surface usage | Remove approval | Surface returns to no-image state |
| Photorealistic generated depiction risk | Require alternative treatment | `changes_requested` or `trust_hold` |
| Repetitive or drama-led imagery | Request replacement | Creator revision required |

## 12. Review Requirements and Creator Obligations

A reviewer should not merely say that a story is “not ready.” The moderation contract should require structured, resolvable requirements.

| Requirement field | Purpose |
|---|---|
| `requirement_id` | Stable identifier |
| `severity` | `info`, `warning`, `required`, `blocking` |
| `target_type` | Story, section, event, source, image, validation issue |
| `target_id` | Specific object under review |
| `reason_code` | Stable machine-readable rationale |
| `human_explanation` | Plain-language explanation for creator |
| `suggested_fix` | Clear next action |
| `created_by_role` | Reviewer, trust reviewer, or director |
| `status` | Open, resolved, rejected, superseded |

This structure allows creators to respond precisely and allows the platform to distinguish cosmetic notes from genuine publication blockers.[2] [3]

## 13. Escalation Model

Some stories should not remain with a standard reviewer once a certain threshold is crossed. Escalation rules should therefore be explicit.

| Escalation trigger | Escalate to | Reason |
|---|---|---|
| **Unsupported key claim in core frame** | Trust reviewer | High trust risk |
| **Contested causality or interpretive dispute central to the story** | Trust reviewer | Requires stronger dispute handling judgment |
| **Reviewer-creator deadlock after repeated change cycles** | Director | Needs final decision |
| **Publish override request** | Director | Highest-consequence exception |
| **Post-publication evidence collapse or serious correction need** | Trust reviewer, then director if unresolved | Public trust risk |
| **Legally or reputationally sensitive imagery dispute** | Director | Exceptional platform exposure |

### 13.1 Deadlock rule

If a story has moved between `changes_requested` and resubmission more than a defined threshold, such as two full cycles without convergence, the case should become eligible for `director_review`. This prevents endless looping while preserving a clear final authority path.

## 14. Publish Approval and Override Rules

Reviewer involvement should affect publication in a controlled, explicit way.

### 14.1 Standard publish approval

A story that is `ready_to_publish` and has no active moderation hold may be published through the normal creator flow. If reviewer approval is required by policy, the moderation state must reach `approved_for_publish` before the publish action succeeds.[2] [4]

### 14.2 Publish hold effect

If a story is in `changes_requested`, `trust_hold`, `director_review`, or `visibility_restricted`, the creator-side publish endpoint should reject with a moderation-aware error, even if the creator-facing workflow state appears otherwise ready.[4]

| Moderation state | Publish allowed? | Reason |
|---|---|---|
| `none` | Yes, if creator workflow is publishable | No reviewer barrier |
| `queued_for_review` | No | Review not complete |
| `in_review` | No | Active review in progress |
| `changes_requested` | No | Creator obligations unresolved |
| `trust_hold` | No | Trust-critical issues unresolved |
| `director_review` | No | Awaiting final authority |
| `approved_for_publish` | Yes | Reviewer barrier cleared |
| `post_publish_watch` | Already published | Monitoring only |
| `visibility_restricted` | No for republish until released | Public trust issue unresolved |

### 14.3 Override rule

A **director-only override** may permit publication of a story that would otherwise remain held, but only when the reason is documented explicitly and the override is attached to a durable `override_decision` record. Overrides should be rare, inspectable, and never silent.[2]

| Override field | Purpose |
|---|---|
| `override_id` | Stable identifier |
| `story_id` | Affected story |
| `director_id` | Responsible authority |
| `override_type` | Publish despite warning, release hold, restore visibility, emergency unpublish reversal |
| `reason_summary` | Short rationale |
| `reason_detail` | Full internal explanation |
| `effective_at` | Activation timestamp |
| `expires_at` | Optional expiry |

## 15. Post-Publication Moderation

Reviewer authority should continue after publication because Storywall stories can face new evidence, corrections, or trust challenges over time.[2] The platform therefore needs a post-publication review posture that is disciplined but not destabilizing.

| Post-publication scenario | Recommended action |
|---|---|
| **Minor correction needed** | Open review note, request creator revision, keep story live if not materially misleading |
| **New dispute becomes material** | Move to `post_publish_watch`, require updated trust treatment |
| **Source support collapses for a core claim** | Consider `visibility_restricted` pending correction |
| **Misleading image discovered** | Remove or replace image immediately, preserve audit trail |
| **Serious trust failure** | Restrict visibility and escalate to director if necessary |

Post-publication moderation should prefer the least disruptive remedy that still protects reader trust. However, the platform should not leave materially misleading stories fully visible merely for continuity or convenience.

## 16. Audit and Provenance Requirements

Because reviewer authority can affect both publication and visibility, every reviewer action should be durable, attributable, and inspectable internally.

| Audit requirement | Standard |
|---|---|
| **Actor identity recorded** | Mandatory for all reviewer actions |
| **Timestamp recorded** | Mandatory |
| **State before and after recorded** | Mandatory for moderation transitions |
| **Reason code recorded** | Mandatory for holds, approvals, and overrides |
| **Human explanation recorded** | Mandatory for creator-facing requirements |
| **Silent privileged edits forbidden** | Narrative or trust-affecting edits must leave provenance |
| **Published-visibility interventions logged** | Mandatory |

This audit posture also supports the subtle edit-signaling requirement by preserving full internal provenance without forcing loud reader-facing authorship theatrics.[2]

## 17. Creator-Reviewer Interaction Contract

The reviewer system should remain operationally clear to creators. A creator should always be able to answer four questions: who is reviewing the story, what state it is in, what is required, and what blocks publication.

| Creator-facing review field | Meaning |
|---|---|
| `current_moderation_state` | Reviewer status of the story |
| `assigned_reviewer` | Current owner of the review case |
| `open_requirements_count` | Number of unresolved reviewer requirements |
| `blocking_requirements_count` | Number of unresolved blocker-level requirements |
| `last_reviewed_at` | Most recent reviewer activity |
| `escalation_status` | Whether the case is with reviewer, trust reviewer, or director |

Reviewers should communicate through structured requirements and comments attached to the specific objects under discussion. Freeform commentary may still exist, but it should not be the only mechanism for explaining blockers.

## 18. Recommended Reviewer-Side API Surface

Although this document is primarily a policy and state contract, Storywall will ultimately need reviewer-facing endpoints that mirror the creator-side system.[4] A future technical contract should formalize these fully, but the recommended surface is already clear.

| Endpoint family | Purpose |
|---|---|
| `GET /api/v1/reviewer/queue` | Retrieve assigned or eligible review cases |
| `POST /api/v1/reviewer/stories/:storyId/assign` | Assign or reassign review owner |
| `POST /api/v1/reviewer/stories/:storyId/state` | Change moderation state |
| `POST /api/v1/reviewer/stories/:storyId/requirements` | Create structured review requirement |
| `PATCH /api/v1/reviewer/requirements/:requirementId` | Resolve or update a requirement |
| `POST /api/v1/reviewer/stories/:storyId/approve` | Mark review complete |
| `POST /api/v1/reviewer/stories/:storyId/escalate` | Escalate to trust reviewer or director |
| `POST /api/v1/reviewer/stories/:storyId/visibility` | Restrict or restore public visibility |
| `POST /api/v1/reviewer/stories/:storyId/override` | Director-only exception action |

## 19. Acceptance Criteria

The reviewer permissions and moderation-state contract should be considered implementation-ready only if the following conditions are satisfied.

| ID | Acceptance criterion |
|---|---|
| **REV-1** | Reviewer authority is clearly separated from creator ownership |
| **REV-2** | Reviewer roles have bounded, non-overlapping high-consequence powers |
| **REV-3** | Moderation states are explicit and interoperable with creator workflow states |
| **REV-4** | Publish is blocked whenever reviewer-side blocking states remain active |
| **REV-5** | Trust-critical decisions can escalate beyond a standard reviewer |
| **REV-6** | Reviewer interventions produce durable audit records |
| **REV-7** | Post-publication visibility interventions are supported explicitly |
| **REV-8** | Creator-facing review obligations are structured and resolvable |
| **REV-9** | The contract supports selective imagery enforcement, dispute handling, and source-sufficiency enforcement |
| **REV-10** | Director overrides are rare, explicit, and fully logged |

## 20. Final Recommendation

Storywall should implement reviewer authority as a **stateful trust-and-publication layer**, not as an informal comments system and not as a hidden editorial takeover mechanism. The platform works best when creators remain visibly responsible for their stories while reviewers retain enforceable authority over trust, readiness, and public visibility.[1] [2] [4]

With this document in place, the next most useful implementation document is a **reviewer-side API and queue contract** that turns these permissions, states, and escalation rules into concrete request and response shapes for internal editorial tooling.

## References

[1]: file:///home/ubuntu/storywall-redesign/storywall_creator_workflow_specification.md "Storywall Creator Workflow Specification"
[2]: file:///home/ubuntu/storywall-redesign/storywall_publishing_and_trust_standard.md "Storywall Publishing and Trust Standard"
[3]: file:///home/ubuntu/storywall-redesign/storywall_editor_cms_input_model.md "Storywall Editor and CMS Input Model"
[4]: file:///home/ubuntu/storywall-redesign/storywall_creator_side_mutation_api_contracts.md "Storywall Creator-Side Mutation and API Contracts"
[5]: file:///home/ubuntu/storywall-redesign/todo.md "Project Todo and terminology context"
