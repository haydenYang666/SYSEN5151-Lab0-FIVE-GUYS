# ADR 0003 — Internal flows cross module boundaries only through the contract, carried by the orchestrator

**Status:** Accepted (2026-10-25)

## Context
Before Lab 7, all of S.1 lived in one `workflow.js`. The five internal flows of the first-level IDEF0
(IO.10–IO.14) were not interfaces at all: every step read and wrote one shared `state` object. Writing
`contracts/api-v1.yaml` from the model's flow list (not from the code) and generating stubs from it exposed three
places where the code did not match the first-level architecture:

1. **No boundaries.** F.2.4's suitability evaluation (UC.1.7) read team records straight out of shared state
   instead of receiving IO.13, and the dispatch order (UC.1.11) was assembled by reading F.2.2's incident record
   instead of receiving IO.14.
2. **A hidden backward flow.** Approving an assignment (UC.1.10, F.2.5) wrote `status = 'APPROVED'` into the
   recommendation record owned by F.2.4. The model has no flow from F.2.5 back to F.2.4; the N² diagram
   (report Figure 6) shows every internal flow above the diagonal, with no feedback.
3. **Separately triggered steps.** In the model, F.2.2 sends IO.11 and IO.12 as soon as it structures an incident.
   In the product, each UC.1 step is a separate REST call made by the user interface (`docs/route-table.md`), so a
   flow produced by one call is consumed by a later one.

## Decision
- Split S.1 into one module per first-level function in `rescutech-orchestrator/functions/`
  (`f2-1-…` to `f2-5-…`). Each module owns its own records and exposes the contract operations assigned to it
  (`x-receiver` in the contract).
- `workflow.js` becomes the orchestration layer only. It is the sole place that calls a contract operation, and
  it holds a flow "in transit" when the consuming step is triggered by a later REST call (IO.11 and IO.12 between
  UC.1.4 and UC.1.5/UC.1.8). This plays the role of the manual's `kiosk_service` caller.
- Remove the backward write: a recommendation keeps `status: 'PRESENTED'`; approval is recorded by F.2.5 against
  the proposed assignment it holds (IO.14 plus control IO.6). The front end never read the recommendation status.
- Keep every public route and response shape, so the front end and the 12 acceptance checks are unchanged.
- Enforce the decision with `tests/contract.spec.js` (C.3 validates every internal-flow call against the schemas;
  C.5 fails if one F.2.x module requires another), run by `npm test` and CI.

## Consequences
- A recommendation can no longer be produced before a resource-status request is open for the incident:
  `getCurrentResourceAvailability` returns 404, surfaced as 409 by the route. Previously the old code silently
  evaluated the initial simulated roster. The UI and tests always request status first, so neither changes.
- `evaluateResourceSuitability()` is no longer a public workflow function; it is internal to F.2.4 and is reached
  through `recommendResourceAssignment`.
- Flows in transit live in memory, like all other state in the walking skeleton.

## Model entities affected
F.2.1, F.2.2, F.2.3, F.2.4, F.2.5; IO.10, IO.11, IO.12, IO.13, IO.14; IO.6 (control on F.2.5);
UC.1.4–UC.1.11. No model change is needed: the code now matches the first-level IDEF0. If the team later wants
each subfunction to push its outputs immediately, the sequence diagram's single RescuTech lifeline would need to
be decomposed first (Lab Manual §6.2.1).
