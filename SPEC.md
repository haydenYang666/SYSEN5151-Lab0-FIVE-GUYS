# SPEC.md — RescuTech walking skeleton

Source of truth for prompts and code. Derived from Innoslate project 584:
User Needs Document **UN.1** (N.1–N.10) and Stakeholder Requirements Document **SRD.1** (SR.1–SR.12).
Do not add a capability here unless it traces to a need in UN.1.

Status values: **Implemented** (real logic in `rescutech-orchestrator/workflow.js`), **Stubbed** (placeholder with the
final interface), **Planned** (later increment).

## 1. Needs, requirements, and acceptance criteria

| Need | Requirement (SRD.1) | Acceptance criterion (objective) | Test name | Status |
|------|---------------------|----------------------------------|-----------|--------|
| N.1 | SR.1 Citizen submits location + assistance description | A report with both fields is registered with both values unchanged; a report missing either field is rejected with guidance. | `N.1 / SR.1 — …` (2 tests) | Implemented |
| N.2 | SR.2 Registration confirmation | Receipt contains the report ID, states "registered", and states it does not mean assignment or dispatch. | `N.2 / SR.2 — …` | Implemented |
| N.3 | SR.3 Structured presentation | Incident has separate location and assistance fields; every undetermined field is listed in `missing` and left null. | `N.3 / SR.3 — …` | Stubbed (keyword rules) |
| N.4 | SR.4 Recommendation | Zero recommendations of a team that is unavailable, has incomplete status, or lacks a required capability. | `N.4 / SR.4 — …` | Stubbed (rule-based) |
| N.4 | SR.5 Rationale | Every recommendation lists availability (with report time), capability match, and distance basis. | `N.4 / SR.5 — …` | Implemented |
| N.5 | SR.6 Order only after approval | Calling issue without an approval of the same recommendation throws `GuardError(SR.6)` and creates no order; after approval exactly one order is created for the approved team. | `N.5 / SR.6 — …` (2 tests) | Implemented |
| N.6 | SR.7 Acknowledgment visibility | Status is `AWAITING_ACK` after issue and `ACKNOWLEDGED` only after a recorded acknowledgment. | `N.6 / SR.7 — …` | Implemented |
| N.7 | SR.8 Order content | Order contains the incident location and a non-empty task matching the approved incident. | `N.7 / SR.8 — …` | Implemented |
| N.6 | SR.9 Team acknowledgment | Acknowledgment is accepted only from the assigned team and recorded against that order. | `N.6 / SR.9 — …` | Implemented |
| N.8 | SR.10 Team status response | Each response updates the team record; a response missing availability, location, or capability is flagged and the team is excluded. | `N.8 / SR.10 — …` | Stubbed (simulated teams) |
| N.9 | SR.11 Adoption information | README section "Intended use, limitations, and responsibilities" exists and covers all four items. | Review checklist | Implemented (doc) |
| N.10 | SR.12 Repeatable checks | `npm test` runs in CI on every push and fails the build on any failed check. | CI job `acceptance` | Implemented |

## 2. Data contract (current skeleton)

| Item | Source | Fields (type) | Missing / unavailable behaviour |
|------|--------|---------------|--------------------------------|
| Distress report | Citizen form (Interface 1) | `location` (string), `description` (string) | Either empty → rejected, user asked to complete |
| Structured incident | UC.1.4 structurer | `location` (string\|null), `zone` ({name,x,y}\|null), `assistanceNeeded` (string\|null), `requiredCapabilities` (string[]), `urgency` ("High"\|"Standard"), `peopleCount` (int\|null), `missing` (string[]) | Unknown values stay null and are named in `missing`; never guessed |
| Team status | Rescue Team (Interface 4), simulated | `available` (bool), `zoneKey` (string), `capabilities` (string[]), `reportedAt` (time) | Any field absent → `statusIncomplete = true`, team excluded |
| Dispatch order | UC.1.11 | `id`, `teamId`, `location`, `task`, `urgency`, `approvalId`, `issuedAt`, `acknowledgedAt` | Not created without approval |

Refresh cadence: team status is collected once per incident on request (UC.1.5). Real-time refresh is planned.

## 3. Model response contract (planned for the language-model agent, Lab Manual Ch. 8)

The structurer must return exactly the **Structured incident** schema above as JSON. If the response does not
parse, omits a field, or names a capability outside {snow-access, medical, water-rescue}, the system keeps
the raw report, marks the incident `missing: ["model output invalid"]`, and shows it to the coordinator for
manual handling. No recommendation is generated from an invalid response.

## 4. Open decisions (from Table 7-1)

- Rejection, editing, and reassignment of a recommendation (OI-04) are not modeled yet and are not implemented.
- Duplicate or unknown acknowledgments, no-match handling, and status freshness rules (OI-06) need team decisions.
