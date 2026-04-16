# Storywall — Repository-ready backlog update (M4 closure)

**Document type:** Canonical planning sync for the repository  
**Scope:** Milestone **M4 — Creator Workflow Foundation** through **M4-T11** only  
**Date:** 2026-04-16  

## 1. Purpose

This file is the **durable, repo-local** record that aligns the Storywall repository with the **approved formal M4 sequence** that was used to drive implementation after **M4-T01**. It does **not** introduce new product scope, new milestone numbering beyond the already-approved M4 line, or a replacement roadmap.

Use it when you need a **single in-repo pointer** for:

- What “M4” meant in execution order after the M4-T01 bridge  
- Where the detailed intent and guardrails live  
- Which implementation commits on `staging` correspond to each approved ticket (reference table below)

**Related canonical docs (unchanged substance):**

- `docs/storywall_m4_creator_workflow_foundation.md` — milestone definition, ticket intents, dependency phases, superseded reader-discovery note  
- `docs/storywall_ticket_ready_implementation_backlog.md` — master milestone table and full M0–M4 ticket index  

## 2. Formal M4 sequence status

The **approved** M4 ticket line runs **M4-T01** through **M4-T11**. That sequence is **closed for planning purposes** at **M4-T11**; the next program step is **not** defined in this document (no M5 invention here).

| Ticket | Title (approved) | `staging` reference commit |
| --- | --- | --- |
| **M4-T01** | Public story share cards / Open Graph metadata | `4ddfba6` |
| **M4-T02** | New story setup / brief creation flow | `d6d9deb` |
| **M4-T03** | Creator workspace information architecture | `f7f474e` |
| **M4-T04** | Narrative section composition editor | `935343a` |
| **M4-T05** | Timeline event management UX | `a4d45cd` |
| **M4-T06** | Source attachment and evidence organization surface | `4f46eda` |
| **M4-T07** | Visual asset and hero-media workflow | `bd991b6` |
| **M4-T08** | Creator preview parity surface | `9d31ac6` |
| **M4-T09** | Post-publish update / republish workflow | `e5687e0` |
| **M4-T10** | Creator empty states and onboarding copy pass | `458ffc0` |
| **M4-T11** | Creator-side design system polish pass | `449cd68` |

**Verification:** On a checkout of `staging`, `git merge-base --is-ancestor <commit> HEAD` should succeed for each row when that commit is merged. If history is rewritten, re-attach SHAs from `git log` while preserving the **ticket order and titles** above.

## 3. What this document does *not* do

- It does **not** add tickets beyond **M4-T11** or rename the approved M4 sequence.  
- It does **not** supersede `storywall_m4_creator_workflow_foundation.md`; that file remains the milestone narrative source.  
- It does **not** define **M5** or redraft discovery/pilot/launch work deferred by the superseded “reader discovery M4” draft — those items remain **out of this M4 numbering** until a **later milestone** is explicitly approved elsewhere.  

## 4. Repository maintenance note

When updating `docs/storywall_ticket_ready_implementation_backlog.md`, keep the **M4** section consistent with this closure table, or add a short line pointing here so drift is obvious in review.

---

*End of repository-ready backlog update (M4 closure).*
