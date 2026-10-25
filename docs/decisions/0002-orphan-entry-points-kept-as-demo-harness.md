# ADR 0002 — Orphan entry points kept as a demonstration and test harness

**Status:** Accepted (team decision, 2026-10-23)

## Context
The Lab 6 endpoint-to-use-case audit (`docs/route-table.md`, Lab Manual §6.4) found 13 entry points in
`rescutech-orchestrator/routes.js`. Nine serve UC.1 and together reach all 15 of its steps. Four trace to no
use case in Innoslate project 584:

| Entry point | Used by |
|-------------|---------|
| `GET /api/health` | `frontend/api-client.js`, to choose HTTP or in-process mode |
| `POST /api/reset` | the demo "restart" button |
| `GET /api/teams` | the simulated Rescue Team in the demo, and `tests/acceptance.spec.js` |
| `GET /api/log` | the live sequence-diagram and traceability views |

All four arrived with the Milestone 1 walking skeleton (prompt-log entries of 2026-10-05 and 2026-10-06) as
demo and test conveniences. No requirement or use case asked for them.

## Decision
Keep all four, and classify them as a demonstration and test harness rather than as system capability. Do not
add use cases to the model for them: none is triggered by an operational actor (Citizen, Emergency
Coordinator or Rescue Team), so modelling them would put test scaffolding into the operational architecture.

## Consequences
- `POST /api/reset` (unguarded state wipe) and `GET /api/teams` (reads every team's status with no actor behind
  the call) must be removed or access-controlled before any operational build. This is recorded so that the
  Design Definition chapters do not inherit them silently.
- Any further entry point must either map to a use-case step in `docs/route-table.md` or be added to this
  harness list with a justification.

## Model entities affected
None. UC.1 and UC.1.1–UC.1.15 are unchanged; the harness has no model counterpart by design.

## Note on location
The Lab Manual places decision records in `docs/adr/`. This repository has kept them in `docs/decisions/`
since ADR 0001; the team may rename the directory later without renumbering.
