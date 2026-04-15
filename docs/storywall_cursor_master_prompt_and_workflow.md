# Storywall Cursor Master Prompt and Workflow Guide

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document is designed to help you use Cursor as an implementation copilot without allowing it to silently redefine Storywall. The goal is not to ask Cursor to invent the product. The goal is to make Cursor implement the product that has already been defined in the Storywall specification pack and ticket-ready backlog.[1] [2] [3] [4] [5] [6] [7] [8] [9] [10]

The safest way to do this is to treat Cursor as a **disciplined execution assistant**. It should receive a bounded ticket, the relevant source documents, explicit constraints, and a required response format. If you work this way, Cursor can be very effective. If you ask it to “build Storywall” in one open-ended pass, it will likely compress decisions, substitute patterns, or introduce drift.

| Working principle | Meaning in practice |
|---|---|
| **Spec-first** | Cursor must implement the approved Storywall documents, not reinterpret them |
| **Ticket-scoped** | Cursor should work on one ticket or tightly related ticket set at a time |
| **Plan-before-code** | Cursor must first restate scope, dependencies, files, and risks |
| **Contract-safe** | Cursor must preserve agreed API shapes, workflow states, and trust semantics |
| **Proof-oriented** | Cursor must explain how the change satisfies the ticket and what still needs validation |

## 2. The Most Important Rule to Give Cursor

The single best instruction is the simplest one:

> **Do not redesign Storywall. Implement Storywall exactly as specified unless I explicitly approve a change request.**

That instruction matters because Cursor will otherwise try to be helpful by simplifying flows, collapsing structured models into generic CRUD, changing field names, flattening moderation logic, or replacing milestone-based implementation with whatever pattern looks easiest in the current codebase.[2] [3] [5] [7] [8] [9] [10]

## 3. Master Prompt for Cursor

You can paste the following prompt into Cursor as your standing project instruction.

```text
You are implementing Storywall.

Storywall is already defined. You are not here to redesign it, simplify it, or replace its contracts with generic patterns. You must implement it faithfully from the provided specification documents and the approved implementation backlog.

Operating rules:
1. Treat the attached Storywall documents as the source of truth.
2. Implement only the current ticket or explicitly provided scope.
3. Before coding, restate the ticket in your own words and list:
   - the goal,
   - dependencies,
   - affected files,
   - database or API contracts involved,
   - assumptions that need confirmation.
4. If the current codebase conflicts with the Storywall spec, do not silently choose one. Stop and explain the conflict.
5. Do not rename fields, states, enums, endpoints, or concepts unless the spec or ticket explicitly requires it.
6. Do not collapse structured editorial objects into generic blobs or freeform JSON if the spec defines a typed structure.
7. Do not simplify moderation, trust, validation, provenance, or workflow states.
8. Do not invent placeholder logic for critical paths unless you label it clearly and explain the exact follow-up required.
9. After coding, provide a compliance report with:
   - what changed,
   - what contracts were touched,
   - how the implementation matches the ticket,
   - what remains unimplemented,
   - any risks or divergences.
10. Prefer minimal, faithful implementation over broad speculative scaffolding.

Storywall implementation priorities:
- Follow milestone and dependency ordering from the implementation backlog.
- Prioritize backend foundation, data model, creator workflow, validation, moderation, and public read models in that order.
- Do not prioritize homepage polish ahead of the creator-to-publish vertical slice.

Required response format for every task:
A. Ticket restatement
B. Dependency check
C. Implementation plan
D. Files to change
E. Risks / ambiguities
F. Await approval before coding if the task is architectural or ambiguous

After implementation, return:
A. Summary of changes
B. Files changed
C. Spec compliance check
D. Outstanding follow-ups
E. Suggested next ticket
```

## 4. What You Should Paste with Each Ticket

Cursor performs best when each task is wrapped with context instead of thrown in raw. For each ticket, you should send a short packet that includes the ticket text, the relevant documents, and the rules of engagement.

| Packet element | What to include |
|---|---|
| **Ticket** | The ticket ID, title, desired outcome, and definition of done |
| **Relevant sources** | Only the Storywall files needed for that ticket |
| **Constraints** | Naming, contract, workflow, and trust rules that must not change |
| **Task mode** | Whether you want plan only, implementation, refactor, or verification |
| **Output requirement** | Ask for a compliance check against the ticket and spec |

## 5. Recommended Ticket Prompt Template

Use this for normal implementation work.

```text
Implement Storywall ticket: [TICKET ID] — [TITLE]

Outcome required:
[Paste the ticket outcome]

Definition of done:
[Paste the acceptance criteria or done condition]

Relevant Storywall source documents:
- [document 1]
- [document 2]
- [document 3]

Hard constraints:
- Do not redesign workflows.
- Do not change API or data contracts unless the ticket explicitly requires it.
- Preserve approved terminology, state names, enums, and trust semantics.
- If the current code conflicts with the spec, stop and explain the conflict before coding.
- Keep implementation faithful to milestone ordering and existing dependencies.

First, do not code yet.
Return only:
1. Ticket restatement
2. Dependency check
3. Implementation plan
4. Files you expect to modify
5. Open questions or conflicts

After I approve the plan, implement it and then return:
1. Summary of changes
2. Files changed
3. Spec compliance check
4. Remaining risks
5. Suggested next ticket
```

## 6. Recommended Prompt for Architectural Tickets

Use this when the ticket touches project structure, auth, database, jobs, or cross-cutting contracts.

```text
We are implementing an architectural Storywall ticket.

Ticket:
[TICKET ID] — [TITLE]

You must be conservative. Do not code immediately.
First inspect the current codebase and compare it against the Storywall documents.
Then return:
1. Current-state assessment
2. Required target-state assessment
3. Gap analysis
4. Proposed implementation plan
5. Files/modules likely to change
6. Migration or compatibility risks
7. Questions that need approval before implementation

Do not make architectural substitutions without explaining them.
Do not introduce generic abstractions that weaken Storywall’s defined workflow or trust model.
```

## 7. Recommended Prompt for Verification or Drift Detection

Use this when you want Cursor to audit what it already changed.

```text
Audit the current implementation against the Storywall specification documents for this ticket.

Focus areas:
- contract fidelity,
- workflow-state fidelity,
- trust and moderation fidelity,
- naming consistency,
- dependency compliance,
- unapproved simplifications.

Return only:
1. What matches the spec
2. What partially matches the spec
3. What drifts from the spec
4. Exact files involved
5. Minimal correction plan

Do not rewrite code yet unless I ask.
```

## 8. Which Documents to Give Cursor for Which Kind of Ticket

You do not need to dump the entire Storywall pack into every prompt. That can make Cursor noisy. Instead, attach the smallest relevant set.

| Ticket type | Minimum documents to provide |
|---|---|
| **Architecture / stack upgrade** | Transition roadmap, ticket-ready backlog, database migration plan |
| **Data model / migrations** | Database migration plan, CMS input model, creator mutation contracts |
| **Creator intake and framing** | Creator workflow specification, CMS input model, creator mutation contracts |
| **AI draft assembly** | Creator workflow specification, prompt architecture, creator mutation contracts |
| **Editorial workspace** | CMS input model, creator workflow specification, creator mutation contracts |
| **Validation and trust** | Publishing and trust standard, reviewer contract, creator mutation contracts |
| **Reviewer tooling** | Reviewer permissions and moderation-state contract, publishing and trust standard |
| **Public homepage and timeline reads** | API response contracts, PRD, publishing and trust standard |
| **Implementation sequencing** | Ticket-ready backlog, sprint-by-sprint build matrix, transition roadmap |

## 9. How to Keep Cursor Faithful During the Build

The main risk with long Cursor sessions is drift. Drift usually appears in one of four forms: silent field renaming, generic schema flattening, shortcut workflow transitions, or UI-led implementation that ignores the dependency order already defined in the backlog.[4] [5] [6] [7] [8] [9] [10]

To prevent that, you should run Cursor using a strict loop.

| Step | What you do |
|---|---|
| **1. Pick one ticket** | Never ask Cursor to build a whole milestone at once |
| **2. Attach only relevant docs** | Keep context sharp and reduce improvisation |
| **3. Ask for plan first** | Force Cursor to surface conflicts before coding |
| **4. Approve or correct the plan** | Keep architectural control in your hands |
| **5. Let it implement** | Only after the plan matches the Storywall spec |
| **6. Ask for compliance check** | Make Cursor justify fidelity after the change |
| **7. Manually review diffs** | Confirm that real code matches the explanation |
| **8. Run ticket-level tests** | Validate the exact vertical slice that ticket was meant to unlock |

## 10. The Instructions You Should Repeat Often

Cursor benefits from repeated guardrails. The following short instructions are worth restating frequently:

```text
Do not redesign Storywall.
Implement only the current ticket.
Preserve Storywall terminology and contracts exactly.
If the codebase conflicts with the spec, stop and surface the conflict.
Do not simplify trust, validation, moderation, provenance, or workflow logic.
Return a compliance check after every implementation step.
```

## 11. Suggested Working Sequence in Cursor

The best sequence to start with is the same one already established in the implementation backlog.[10]

| Order | Start with this ticket type | Reason |
|---|---|---|
| **1** | Baseline freeze and architecture decision | Stops interpretation drift |
| **2** | Full-stack upgrade | Makes the rest of Storywall technically possible |
| **3** | Migration framework and core story tables | Establishes durable records |
| **4** | Auth and creator ownership guards | Needed for every creator-side mutation |
| **5** | Brief shell, autosave, and framing workflow | First real user-facing vertical slice |
| **6** | Research and draft assembly jobs | Proves the AI-first product premise |
| **7** | Editorial workspace and revision system | Enables human ownership of the draft |
| **8** | Validation and reviewer moderation | Makes publication governable |
| **9** | Publish flow and public reads | Exposes trusted outputs to readers |

## 12. What Not to Tell Cursor

There are several prompt patterns that will produce worse results.

| Bad instruction pattern | Why it causes trouble |
|---|---|
| **Build Storywall end to end** | Too open-ended; invites invention and scope compression |
| **Feel free to improve the design** | Encourages workflow and contract drift |
| **Use your best judgment on missing details** | Often results in silent substitution rather than surfaced ambiguity |
| **Make it production-ready in one pass** | Encourages broad speculative scaffolding and weak verification |
| **Clean up the schema if needed** | Risks flattening the structured Storywall model |

## 13. Final Recommendation

Yes, you can absolutely use Cursor for this build, and it is a sound approach **if you keep control of product fidelity outside the tool**. In practice, that means you should use Cursor as a highly capable implementation assistant that works inside the Storywall documents, not above them.[1] [2] [3] [10]

The most reliable pattern is simple: **one ticket, relevant documents, plan first, approve, implement, verify, then move to the next ticket.** If you keep that discipline, Cursor can accelerate the build while preserving the design, trust model, workflow, and implementation sequence already established here.[4] [10]

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
[10]: file:///home/ubuntu/storywall-redesign/storywall_ticket_ready_implementation_backlog.md "Storywall Ticket-Ready Implementation Backlog"
