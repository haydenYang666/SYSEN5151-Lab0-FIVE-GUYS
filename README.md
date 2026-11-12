# RescuTech — Disaster Response Agent Orchestrator

**SYSEN 5151 · Fall 2026 · Team 15 (FIVE GUYS)** — Hayden Yang, Yu Cici Fu, Xinyuan Zhao, Yanda Shen, Xinze Fan
MBSE model: Innoslate project 584 · Primary use case: **UC.1 Coordinator Dispatches Resources to a Distress Report**

## 1. Operational concept

The RescuTech Disaster Response Agent Orchestrator (S.1) is an AI-assisted decision-support prototype for
municipal emergency response. A simulated severe-snowstorm scenario in Tompkins County provides the
operational context; it does not imply verified local procedures or an established municipal partnership.
A Citizen (X.1) submits a distress report through Interface 1. RescuTech registers it, structures the
incident, and requests resource status from Rescue Teams (X.3) through Interface 4. It evaluates the
teams' suitability and presents a recommendation with its rationale to the Emergency Coordinator (X.2)
through Interface 3. The Emergency Coordinator retains final authority: only after approval does
RescuTech issue the dispatch order to the assigned Rescue Team, which acknowledges receipt. The
operational workflow ends when that acknowledgment is recorded and shown to the coordinator.
Acknowledgment does not confirm departure, arrival, or rescue completion; physical rescue remains outside
the software boundary.

## 2. Run the walking skeleton

```bash
npm start          # http://localhost:3000  — front end + REST API, no dependencies (Node 18+)
npm test           # 12 need-linked acceptance checks + 5 contract checks + 17 F.2.5 requirement checks + 7 agent checks (mocked API)
npm run test:py    # the same 17 requirement checks as pytest tests, one per requirement ID (needs pytest)
# CI (.github/workflows/tests.yml) runs all of them on every push
npm run generate:stubs   # regenerate contracts/generated/ after changing contracts/api-v1.yaml
```

You can also open `frontend/index.html` directly from disk; it then runs the same route table in the page.

### Claude rescue agent (UC.1.4 structuring and the UC.1.9 recommendation briefing)

```bash
export ANTHROPIC_API_KEY=...        # your own key; never commit it
npm start                           # top bar shows "Claude agent · claude-haiku-4-5"
```

Without the key the server and the static page use the keyword stub (`incident-structuring-agent/agent.stub.js`).
The agent only fills the structured-incident schema and words the briefing; F.2.2 validates its output (invalid
output goes to manual handling, SyRD 2.3.1/2.3.3), the team is chosen by fixed rules, dispatch never calls the model
(CRD 2.3.1), and calls stop at `RESCUTECH_BUDGET_USD` per month (default 50, SyRD 2.5.1).
Cloud deployment: `render.yaml` (Render Blueprint); set `ANTHROPIC_API_KEY` in the Render dashboard.

### Measured behavior (Modeling and Simulation, Lab Manual 10.4)

```bash
ANTHROPIC_API_KEY=... npm run measure   # 30 UC.1 runs against the real server
```

Writes `measurements/uc1-runs.csv` (every stage of every run) and `measurements/uc1-summary.md` (measured vs the
Innoslate simulation parameters). Timing spans sit at the participant boundaries of the UC.1 sequence diagram
(`GET /api/timings`). Human actions are not timed; voice intake is represented by its transcript (ADR 0005).

The front end has three views:

| View | What it shows | Milestone row |
|------|---------------|---------------|
| **Operate** | Dispatch-console layout. A guided lane shows UC.1 in seven steps, each labelled with its function (F.2.1–F.2.5.4) and performing asset (S.1.x); the three F.2.5 steps are grouped under S.1.5. Rescue teams on the left, a simulated Tompkins County map in the centre, and on the right the current action (one primary button) above tabs for the model link (function, asset, UC steps, SR/CRD, code), the event log and the API requests | Walking Skeleton, Model-to-Product Linkage |
| **Architecture** | Level-1 IDEF0 of F.2 with mechanisms S.1.1–S.1.5, level-2 IDEF0 of F.2.5 with S.1.5.1–S.1.5.4, and the S.1 asset hierarchy. Each element opens its code, requirements and a button to see it run | Form: physical architecture |
| **Traceability** | N → SR → UC step → API → code → check, plus the S.1.5 CRD with its status in the prototype; the checks run in the browser | Requirements Baseline |

UC step numbers everywhere (code, logs, routes, UI, docs) follow the current Innoslate UC.1 Action Diagram
(UC.1.1–UC.1.16, with UC.1.7 Update Resource Availability).

**Model view** (top-bar switch): off shows a clean operator console; on adds the Innoslate IDs (F.2.x, S.1.x, UC, SR/CRD, STUB tags) and the Model link tab. The choice is remembered in the browser.

Live demo script (≈3 minutes, F.2.5 focus): Place call → Structure → Read latest team status (switch a team off to change the outcome) →
Generate recommendation → **Send order without approval (409, S.1.5.1 / SR.6)** → Approve → Issue order (S.1.5.2) →
**Acknowledge as another team (rejected, S.1.5.3 / CRD 2.4.2)** → Acknowledge → Status (S.1.5.4) → Architecture → IDEF0 F.2.5.

## 3. Repository layout — one directory per model element

| Directory | Model element | Role | Status |
|-----------|---------------|------|--------|
| `rescutech-orchestrator/` | S.1 RescuTech | Service layer: orchestration of the internal flows (`workflow.js`), REST routes (`routes.js`), server | Real |
| `rescutech-orchestrator/functions/` | F.2.1–F.2.5, first-level functions of F.2; F.2.5.1–F.2.5.4, second-level functions of F.2.5 | One module per function (`f2-N-…`, `f2-5-N-…`), each performed by one asset (S.1.N, S.1.5.N); modules talk only through `contracts/api-v1.yaml` | Real (F.2.2/F.2.4 call stubs) |
| `contracts/` | Internal flows IO.10–IO.17 | Internal interface contract v1 (OpenAPI) and stubs generated from it | Real |
| `scripts/` | — | Stub generator and its dependency-free YAML reader | — |
| `incident-structuring-agent/` | S.1.2 mechanism (and S.1.4 briefing) | `agent.js`: Claude rescue agent (structuring + recommendation briefing, schema-checked, budget-capped); `agent.stub.js`: keyword fallback with the same schema | Real with API key, stub otherwise |
| `measurements/` | Modeling and Simulation (Lab Manual 10.4) | `scripts/measure-uc1.js` output: per-stage timings of 30 UC.1 runs and the measured-vs-simulated table | Generated |
| `resource-status-source/` | X.3 Rescue Team as status source | Five fictional teams | Stub |
| `frontend/` | X.1, X.2, X.3 user interfaces (Interfaces 1, 3, 4) | Citizen phone, coordinator console, team tablet | Real |
| `tests/` | SR.12; S.1.5 CRD | Need-linked acceptance checks; contract conformance checks; F.2.5 requirement checks named by requirement ID (`functional-requirements.spec.js`, `test_functional_requirements.py`) | Real |
| `docs/` | — | Context inventory, walking skeleton call list, traceability, route table, prompt log, decisions | — |

## 4. API (one route per sequence-diagram message group)

| Method and path | UC.1 messages | Requirement |
|-----------------|---------------|-------------|
| `POST /api/distress-reports` (`channel: voice` transcript or text) | UC.1.1–1.3 | SR.1, SR.2 |
| `POST /api/distress-reports/:id/incident` | UC.1.4 (Claude agent or stub) | SR.3 |
| `PUT /api/teams/:teamId/status` | UC.1.6 Push Status Update | SR.10 |
| `POST /api/incidents/:id/status-requests` | UC.1.5 Retrieve Latest Team Status | SR.10 |
| `PUT /api/incidents/:id/team-status/:teamId` | UC.1.6 (refresh reply) | SR.10 |
| `GET /api/timings`, `POST /api/timings/reset` | Instrumentation (Lab Manual 10.4) | — |
| `GET /api/agent` | Agent status and spend (SyRD 2.5.1) | 2.5.1 |
| `POST /api/incidents/:id/recommendation` | UC.1.7–1.10 | SR.4, SR.5, SR.10 |
| `POST /api/recommendations/:id/approval` | UC.1.11 | SR.6 |
| `POST /api/recommendations/:id/dispatch-order` | UC.1.12 (409 without approval) | SR.6, SR.8 |
| `POST /api/dispatch-orders/:id/acknowledgment` | UC.1.13–1.14 | SR.9 |
| `GET /api/dispatch-orders/:id/status` | UC.1.15–1.16 | SR.7 |

### Internal interfaces (Lab 7, `contracts/api-v1.yaml`)

The first-level IDEF0 of F.2 has five internal flows, and the second-level IDEF0 of F.2.5 adds three more. Each one
crosses a module boundary only through an operation of the contract; `tests/contract.spec.js` checks every call against the schemas. See
`docs/decisions/0003-*.md` and `0004-*.md` for where the contract changed the code.

| Flow | From → To | Contract operation |
|------|-----------|--------------------|
| IO.10 Registered Report | F.2.1 → F.2.2 | `structureIncident` (request) |
| IO.11 Incident Resource Needs | F.2.2 → F.2.3 | `structureIncident` (response) → `retrieveLatestTeamStatus` (request) |
| IO.12 Structured Incident | F.2.2 → F.2.4 | `structureIncident` (response) → `recommendResourceAssignment` (request) |
| IO.13 Current Resource Availability | F.2.3 → F.2.4 | `getCurrentResourceAvailability` (response) → `recommendResourceAssignment` (request) |
| IO.14 Proposed Assignment | F.2.4 → F.2.5 | `recommendResourceAssignment` (response) → `acceptProposedAssignment` (request) |
| IO.15 Authorized Dispatch Order | F.2.5.1 → F.2.5.2 (C.9) | `compileAuthorizedDispatchOrder` (response) → `issueDispatchOrder` (request) |
| IO.16 Issued Order Record | F.2.5.2 → F.2.5.3 (C.10) | `issueDispatchOrder` (response) → `verifyDispatchAcknowledgment` (request) |
| IO.17 Verified Acknowledgment | F.2.5.3 → F.2.5.4 (C.11) | `verifyDispatchAcknowledgment` (response) → `reportDispatchStatus` (request) |

The entry-point audit (`docs/route-table.md`, Lab 6) maps every route above to UC.1; four extra routes
(`/api/health`, `/api/reset`, `/api/teams`, `/api/log`) are a demonstration and test harness (ADR 0002).

## 5. Intended use, limitations, and responsibilities (SR.11)

- **Intended use:** coursework prototype demonstrating the modeled UC.1 dispatch-support workflow.
- **Supported capabilities:** the UC.1 normal path, plus the SR.6 block on unapproved dispatch.
- **Known limitations:** simulated data only; keyword structuring is not yet a language model; distances
  use a simulated grid; no rejection or reassignment flow; in-memory state; not validated with real users.
- **Responsibilities kept by people:** the Emergency Coordinator approves every dispatch; the municipality
  would own adoption, operation, and data decisions.

See `SPEC.md`, `docs/context.md`, `docs/walking-skeleton.md`, `docs/traceability.md`, and `docs/prompt-log.md`.
