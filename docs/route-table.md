# Route table — entry points mapped to use cases (Lab Manual §6.4)

Audit of every entry point in the application against the use cases in Innoslate project 584
(model state checked 2026-10-23: UC.1 with steps UC.1.1–UC.1.15; UC.2 and UC.3 exist as empty placeholders).
Entry points were enumerated from `rescutech-orchestrator/routes.js`, which is the only route table: `server.js`
serves it over HTTP and `frontend/api-client.js` calls the same table in-process, so there is no second path.
The front end calls nothing outside this table.

> **Dispositions decided 2026-10-23 (team):** all four orphan entry points are **kept and justified** as a
> demonstration and test harness; none is added to the model as a use case, because none serves an operational
> actor. The justification is recorded in `docs/decisions/0002-orphan-entry-points-kept-as-demo-harness.md`
> (§6.4: "Either delete it, or add the missing use case to the model and justify it. Do not leave it.").

## Operational entry points (9) — each serves UC.1

| # | Entry point | Use case step(s) | Called by | Notes |
|---|-------------|------------------|-----------|-------|
| 1 | `POST /api/distress-reports` | UC.1.1 Submit Distress Report, UC.1.2 Register Distress Report, UC.1.3 Receive Report Receipt | Citizen form | 422 if location or description is missing (SR.1) |
| 2 | `POST /api/distress-reports/:id/incident` | UC.1.4 Structure Incident Information | Demo step "structure" | Calls the stubbed incident-structuring agent |
| 3 | `POST /api/incidents/:id/status-requests` | UC.1.5 Request Resource Status | Demo step "request" | |
| 4 | `PUT /api/incidents/:id/team-status/:teamId` | UC.1.6 Provide Resource Status | Simulated Rescue Team | |
| 5 | `POST /api/incidents/:id/recommendation` | UC.1.7 Evaluate Resource Suitability, UC.1.8 Present Dispatch Recommendation, UC.1.9 Review Dispatch Recommendation | Demo step "status" | UC.1.9 is a Coordinator action; the route only logs that the recommendation was opened |
| 6 | `POST /api/recommendations/:id/approval` | UC.1.10 Approve Resource Assignment | Coordinator console | |
| 7 | `POST /api/recommendations/:id/dispatch-order` | UC.1.11 Issue Dispatch Order | Coordinator console | 409 without a matching approval (SR.6) |
| 8 | `POST /api/dispatch-orders/:id/acknowledgment` | UC.1.12 Acknowledge Dispatch Order, UC.1.13 Record Dispatch Acknowledgment | Simulated Rescue Team | 409 if the sender is not the assigned team (SR.9) |
| 9 | `GET /api/dispatch-orders/:id/status` | UC.1.14 Present Dispatch Status, UC.1.15 Review Dispatch Status | Coordinator console | UC.1.15 is a Coordinator action; the route only logs it |

All 15 steps of UC.1 are reached by at least one entry point.

## Orphan entry points (4) — trace to no use case

| # | Entry point | What it does | Used by | Origin | Disposition (decided) |
|---|-------------|--------------|---------|--------|----------------------------------------|
| 10 | `GET /api/health` | Returns `{ ok: true }` | `frontend/api-client.js` to choose HTTP or in-process mode | Milestone 1 walking skeleton (2026-10-06) | **Kept — technical probe.** Not triggered by any actor; selects the transport mode only |
| 11 | `POST /api/reset` | Discards all workflow state | Demo "restart" button | Milestone 1 walking skeleton | **Kept — demo harness.** Unguarded state wipe; must be removed or gated before any operational build |
| 12 | `GET /api/teams` | Returns every team's full status record | Demo steps "request"/"status"; acceptance tests | Milestone 1 walking skeleton | **Kept — demo and test harness.** Lets any caller read all Rescue Team status with no actor behind the call (the same pattern as the manual's `list_all_flights()`); it supplies the roster to the simulated Rescue Team and to the acceptance checks. Must be removed or gated before any operational build |
| 13 | `GET /api/log` | Returns the full event log | Live sequence-diagram and traceability views | Milestone 1 walking skeleton | **Kept — demo harness.** Feeds the live sequence-diagram and traceability views; no operational actor |

## Unimplemented use cases

| Use case | Status | Note |
|----------|--------|------|
| UC.2 Evaluate and Match Resources | Pending model clean-up | Empty placeholder in the model (no description or steps); to be removed from the model or marked descoped |
| UC.3 Authorize & Execute Dispatch | Pending model clean-up | Same as UC.2 |

## Reconciliation

| Count | Model | Application |
|-------|-------|-------------|
| Use cases with steps | 1 (UC.1, 15 steps) | 1 (UC.1, all 15 steps reached) |
| Operational entry points | — | 9 |
| Orphan entry points | — | 4 (kept as demo/test harness, justified in ADR 0002) |
| Unimplemented use cases | 2 empty placeholders (UC.2, UC.3) | — |

All four orphans arrived with the Milestone 1 walking skeleton (prompt-log entries of 2026-10-05/06) as demo
and test conveniences; none was requested by a requirement or a use case.

Note on location: the Lab Manual places decision records in `docs/adr/`; this repository keeps them in
`docs/decisions/` (since ADR 0001). The team may rename the directory later; the record numbering is unaffected.
