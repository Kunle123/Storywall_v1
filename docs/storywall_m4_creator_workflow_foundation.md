# Storywall M4 — Creator Workflow Foundation

**Status:** Canonical backlog continuation **after M4-T01** (April 2026).  
**Related:** `docs/storywall_ticket_ready_implementation_backlog.md` (milestone table and ticket index).

## Status note

This update is the canonical backlog continuation **after M4-T01**. The current decision is to treat **M4-T01 — Public story share cards / Open Graph metadata** as a **merge-ready bridge ticket** and to pause further implementation long enough to define the next creator-facing milestone clearly.

The next approved implementation sequence begins at **M4-T02**.

| Item | Status | Notes |
| --- | --- | --- |
| **M4-T01** | Merge-ready bridge ticket | Public-share metadata work is ready; planning paused before further post-M3 implementation |
| **M4-T02 onward** | Approved planning sequence | These tickets define the next creator-workflow milestone |
| **Canonical milestone theme** | **M4 — Creator Workflow Foundation** | Turns previously inferred creator-product gaps into explicit backlog work |

## Milestone definition

> **M4 — Creator Workflow Foundation**
>
> **Goal:** Make it possible for a creator to **define, structure, compose, evidence, preview, and maintain** a Storywall inside **one coherent editorial workflow**.

The purpose of this milestone is to correct backlog imbalance. Completed work to date strongly covers **validation**, **publish readiness**, **publish triggering**, and **public reader / trust surfaces**, but it does not yet define the creator-side story-building workflow with the same explicitness.

## Why this milestone exists

| Already explicitly covered | Still needing explicit backlog definition |
| --- | --- |
| Creator-facing validation UI | New story setup / story brief flow |
| Publish gate and publish mutation | Creator workspace architecture |
| Public reader trust surfaces | Narrative composition editor |
| Public references, explainer, FAQ | Evidence organization / source attachment |
| Share metadata bridge ticket (M4-T01) | Visual workflow, preview parity, republish, creator-side design polish |

## Approved M4 ticket sequence

Formal proposed implementation order **after M4-T01**.

| Ticket | Title | Intent | Priority |
| --- | --- | --- | --- |
| **M4-T02** | New story setup / brief creation flow | Give creators a real starting point for title, angle, scope, framing, and working summary. | Must-have |
| **M4-T03** | Creator workspace information architecture | Define the creator workspace shell, navigation, panel hierarchy, and mode clarity for draft work. | Must-have |
| **M4-T04** | Narrative section composition editor | Provide a true editorial writing surface for composing and ordering story sections. | Must-have |
| **M4-T05** | Timeline event management UX | Let creators add, edit, order, and inspect events in a clear timeline workflow. | Must-have |
| **M4-T06** | Source attachment and evidence organization surface | Give creators a clear evidence workflow showing which sources support which story elements. | Must-have |
| **M4-T07** | Visual asset and hero-media workflow | Define how imagery is selected, previewed, and kept visually coherent with the story. | Should-have |
| **M4-T08** | Creator preview parity surface | Let creators preview the public result honestly before publish. | Must-have |
| **M4-T09** | Post-publish update / republish workflow | Define how already-published stories are edited and republished safely. | Should-have |
| **M4-T10** | Creator empty states and onboarding copy pass | Improve clarity when stories are new, incomplete, blocked, or waiting on next actions. | Nice-to-have |
| **M4-T11** | Creator-side design system polish pass | Unify hierarchy, spacing, panel treatment, and editorial visual language across the creator workspace. | Should-have |

## Dependency order

Execute in **strict dependency order** (foundation → completeness → operations → polish).

| Phase | Tickets | Rationale |
| --- | --- | --- |
| **Foundation** | **M4-T02 to M4-T06** | Story setup, workspace structure, composition, timeline editing, evidence workflow |
| **Create-to-publish completeness** | **M4-T07 to M4-T08** | Imagery workflow and trustworthy preview before broadening operational scope |
| **Operational maturity** | **M4-T09** | Republish only after the initial authoring loop is coherent |
| **Clarity and polish** | **M4-T10 to M4-T11** | Onboarding and visual consistency once the core workflow exists |

## Coverage of previously identified gaps

| Gap | Covered by this sequence? | Primary ticket(s) |
| --- | --- | --- |
| Full story setup wizard / idea-to-story workflow | Yes | **M4-T02** |
| Rich editorial composition canvas | Yes | **M4-T03**, **M4-T04**, **M4-T05** |
| Unified source tray / evidence rail design | Yes | **M4-T06** |
| Image selection / visual story assembly UX | Yes | **M4-T07** |
| Republish / post-publish revision management UX | Yes | **M4-T09** |
| Strong creator-side design system polish | Yes | **M4-T11** |

## Scope guardrails for M4

This milestone stays focused on the **creator workflow**. It should **not** drift into broad public-reader enhancements unless a later milestone explicitly calls for that. It should **not** expand into collaboration, analytics, audience targeting, advanced templates, or generalized CMS tooling unless later approved as separate milestones.

> M4 is about making Storywall **usable as a creator tool**, not about adding more public-reader ornamentation or unrelated platform features.

## Superseded planning note

An earlier draft of `storywall_ticket_ready_implementation_backlog.md` labeled **M4 — Reader Discovery, Pilot, and Launch Readiness** with different ticket IDs (homepage feed, discovery rails, analytics, pilot triage, etc.). That ordering is **superseded** for M4 numbering by this document. Discovery, pilot instrumentation, and launch-readiness packaging should be **re-proposed under a later milestone** once the creator workflow foundation is in place, if still required by product strategy.

## Immediate next action

1. **Merge M4-T01** when ready.  
2. Treat this document as the approved backlog continuation for planning and implementation.  
3. **Next implementation ticket:** **M4-T02 — New story setup / brief creation flow**.

## References (repository)

- `docs/storywall_ticket_ready_implementation_backlog.md` — Master ticket index and milestone table  
- `docs/storywall_sprint_by_sprint_build_matrix.md` — Sprint sequencing (may be updated separately for alignment)  
- Implemented trust/public track through **M3-T14** and bridge **M4-T01** (see git history / `staging` branch)
