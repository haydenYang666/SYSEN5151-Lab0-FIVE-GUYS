# Prompt / provenance log

Course rule: record GenAI-assisted work; constrain generation by requirement and specification text; never
generate the whole project from one broad prompt. Add a row for every AI-assisted change.

| Date | Tool | Who | Prompt (summary) | Constrained by | Output | Human review |
|------|------|-----|------------------|----------------|--------|--------------|
| 2026-10-05 | Claude (Cowork) | Hayden Yang | Build a front-end walking skeleton for UC.1 for Milestone 1 from our Stakeholder Needs and Requirements report and BMA. | UC.1.1–UC.1.15 Action and Sequence Diagrams; SR.1–SR.12; boundary and interfaces from the BMA | First UI, workflow, stubs, acceptance checks | _Reviewer, what was checked, what changed_ |
| 2026-10-06 | Claude (Cowork) | Hayden Yang | Restructure to Lab Manual §1.4 / §2.5: one directory per model element, REST routes per sequence message, live sequence diagram and traceability views. | Lab Manual §1.4, §2.5, §3.5; Milestone 1 rubric; sequence diagram call list (docs/walking-skeleton.md) | `rescutech-orchestrator/`, `frontend/`, `docs/`, `tests/acceptance.spec.js` | _Reviewer, what was checked, what changed_ |

## Review checklist for each AI-generated change

- Does every new function or route map to one UC.1 message or one SR? (docs/traceability.md)
- Does anything do more than the requirement says? Remove it, or model it first.
- Do the acceptance checks still pass (`npm test`)?
