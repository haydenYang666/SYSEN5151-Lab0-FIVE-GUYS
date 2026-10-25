# Prompt / provenance log

Course rule: record GenAI-assisted work; constrain generation by requirement and specification text; never
generate the whole project from one broad prompt. Add a row for every AI-assisted change.

| Date | Tool | Who | Prompt (summary) | Constrained by | Output | Human review |
|------|------|-----|------------------|----------------|--------|--------------|
| 2026-10-05 | Claude (Cowork) | Hayden Yang | Build a front-end walking skeleton for UC.1 for Milestone 1 from our Stakeholder Needs and Requirements report and BMA. | UC.1.1–UC.1.15 Action and Sequence Diagrams; SR.1–SR.12; boundary and interfaces from the BMA | First UI, workflow, stubs, acceptance checks | Yanda Shen, 2026-10-06: ran `npm test` (12/12 pass); checked function and route names against UC.1.1–UC.1.15 in the Innoslate Action/Sequence Diagrams; no changes needed. |
| 2026-10-06 | Claude (Cowork) | Hayden Yang | Restructure to Lab Manual §1.4 / §2.5: one directory per model element, REST routes per sequence message, live sequence diagram and traceability views. | Lab Manual §1.4, §2.5, §3.5; Milestone 1 rubric; sequence diagram call list (docs/walking-skeleton.md) | `rescutech-orchestrator/`, `frontend/`, `docs/`, `tests/acceptance.spec.js` | Yanda Shen, 2026-10-06: checked docs/traceability.md rows against SRD.1 (SR.1–SR.12) and UN.1 (N.1–N.10); confirmed the SR.6 guard returns 409 without approval; no changes needed. |
| 2026-10-23 | Claude (Claude Code) | Yanda Shen | Lab 6 §6.4: enumerate every entry point in the repository and list what calls it; propose a use-case mapping for the team to decide. | Lab Manual §6.4; UC.1.1–UC.1.15 and UC.0–UC.3 as read from Innoslate project 584 on 2026-10-23 | `docs/route-table.md`, `docs/decisions/0002-…` (13 entry points; 4 orphans) | Team decided the orphan dispositions (keep all four as demo/test harness), 2026-10-23. **Reviewer and date to be filled in by Yanda Shen.** |
| 2026-10-25 | Claude (Claude Code) | Yanda Shen | Lab 7 §7.4: write the internal interface contract from the IDEF0 internal-flow list (IO.10–IO.14 descriptions from Innoslate), generate stubs from it, refactor S.1 into F.2.1–F.2.5 behind it, record divergences. Contract drafted from the model flow list, not from the code. | Lab Manual §7.4; first-level IDEF0 and N² of F.2; IO.10–IO.14 descriptions; SyRD.1 requirement IDs; existing acceptance checks must still pass | `contracts/`, `scripts/`, `rescutech-orchestrator/functions/`, `workflow.js`, `routes.js`, `tests/contract.spec.js`, ADRs 0003–0004, README | Assistant assumptions recorded as ADR 0003/0004, not silently resolved: IO.11/IO.12 held in transit by the orchestrator; F.2.3 still queries all teams; 2.3.1/2.3.3 path has no acceptance check yet. **Reviewer: to be filled in by Yanda Shen after running `npm test` and reading the diff.** |

## Review checklist for each AI-generated change

- Does every new function or route map to one UC.1 message or one SR? (docs/traceability.md)
- Does anything do more than the requirement says? Remove it, or model it first.
- Do the acceptance checks still pass (`npm test`)?
