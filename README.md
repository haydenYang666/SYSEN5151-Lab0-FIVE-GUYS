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
npm test           # 12 need-linked acceptance checks (also run by CI on every push)
```

You can also open `frontend/index.html` directly from disk; it then runs the same route table in the page.

The demo has three views:

| View | What it shows | Milestone 1 row |
|------|---------------|-----------------|
| **Demo** | UC.1 in seven steps, each on the actor's own device, with a live sequence diagram, the model link for the step, and every API request | Walking Skeleton |
| **System context** | S.1, its boundary, X.1–X.3, the interfaces, and which internal parts are real or stubbed | Mission / SoI / Boundary |
| **Traceability** | N → SR → UC step → API → code → acceptance check, with a button that runs the checks in the browser | Requirements Baseline, Model-to-Product Linkage |

Live demo script (≈2 minutes): Send report → Continue → Request status → Send status responses →
**Send order without approval (409, blocked by SR.6)** → Approve → Send dispatch order → Acknowledge →
Open traceability.

## 3. Repository layout — one directory per model element

| Directory | Model element | Role | Status |
|-----------|---------------|------|--------|
| `rescutech-orchestrator/` | S.1 RescuTech | Service layer: UC.1 actions (`workflow.js`), REST routes (`routes.js`), server | Real |
| `incident-structuring-agent/` | Model participant inside S.1 | Keyword stub returning the final structured-incident schema | Stub |
| `resource-status-source/` | X.3 Rescue Team as status source | Five fictional teams | Stub |
| `frontend/` | X.1, X.2, X.3 user interfaces (Interfaces 1, 3, 4) | Citizen phone, coordinator console, team tablet | Real |
| `tests/` | SR.12 | Need-linked acceptance checks | Real |
| `docs/` | — | Context inventory, walking skeleton call list, traceability, prompt log, decisions | — |

## 4. API (one route per sequence-diagram message group)

| Method and path | UC.1 messages | Requirement |
|-----------------|---------------|-------------|
| `POST /api/distress-reports` | UC.1.1–1.3 | SR.1, SR.2 |
| `POST /api/distress-reports/:id/incident` | UC.1.4 | SR.3 |
| `POST /api/incidents/:id/status-requests` | UC.1.5 | SR.10 |
| `PUT /api/incidents/:id/team-status/:teamId` | UC.1.6 | SR.10 |
| `POST /api/incidents/:id/recommendation` | UC.1.7–1.9 | SR.4, SR.5 |
| `POST /api/recommendations/:id/approval` | UC.1.10 | SR.6 |
| `POST /api/recommendations/:id/dispatch-order` | UC.1.11 (409 without approval) | SR.6, SR.8 |
| `POST /api/dispatch-orders/:id/acknowledgment` | UC.1.12–1.13 | SR.9 |
| `GET /api/dispatch-orders/:id/status` | UC.1.14–1.15 | SR.7 |

## 5. Intended use, limitations, and responsibilities (SR.11)

- **Intended use:** coursework prototype demonstrating the modeled UC.1 dispatch-support workflow.
- **Supported capabilities:** the UC.1 normal path, plus the SR.6 block on unapproved dispatch.
- **Known limitations:** simulated data only; keyword structuring is not yet a language model; distances
  use a simulated grid; no rejection or reassignment flow; in-memory state; not validated with real users.
- **Responsibilities kept by people:** the Emergency Coordinator approves every dispatch; the municipality
  would own adoption, operation, and data decisions.

See `SPEC.md`, `docs/context.md`, `docs/walking-skeleton.md`, `docs/traceability.md`, and `docs/prompt-log.md`.
