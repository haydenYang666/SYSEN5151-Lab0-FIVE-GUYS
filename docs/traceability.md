# Traceability — need → requirement → model → code

IDs refer to Innoslate project 584 (UN.1, SRD.1, UC.1 Action Diagram). The same table is rendered in the
demo's Traceability view from `frontend/model-trace.js`.

| Need | Requirement | Model step (UC.1 actions) | Code | Check |
|------|-------------|---------------------------|------|-------|
| N.1 | SR.1 | UC.1.1 Submit Distress Report | `submitDistressReport()` | N.1 / SR.1 tests |
| N.2 | SR.2 | UC.1.2 Register Distress Report, UC.1.3 Receive Report Receipt | `registerDistressReport()` | N.2 / SR.2 test |
| N.3 | SR.3 | UC.1.4 Structure Incident Information | `structureIncidentInformation()` → `incident-structuring-agent/agent.stub.js` | N.3 / SR.3 test |
| N.4 | SR.4 | UC.1.7 Evaluate Resource Suitability, UC.1.8 Present Dispatch Recommendation | `evaluateResourceSuitability()`, `presentDispatchRecommendation()` | N.4 / SR.4 test |
| N.4 | SR.5 | UC.1.8, UC.1.9 Review Dispatch Recommendation | `rec.rationale`, `reviewDispatchRecommendation()` | N.4 / SR.5 test |
| N.5 | SR.6 | UC.1.10 Approve Resource Assignment, UC.1.11 Issue Dispatch Order | `approveResourceAssignment()`, guard in `issueDispatchOrder()` | N.5 / SR.6 tests |
| N.6 | SR.7 | UC.1.14 Present Dispatch Status, UC.1.15 Review Dispatch Status | `presentDispatchStatus()`, `reviewDispatchStatus()` | N.6 / SR.7 test |
| N.7 | SR.8 | UC.1.11 Issue Dispatch Order | `order.location`, `order.task` | N.7 / SR.8 test |
| N.6 | SR.9 | UC.1.12 Acknowledge Dispatch Order, UC.1.13 Record Dispatch Acknowledgment | `acknowledgeDispatchOrder()`, `recordDispatchAcknowledgment()` | N.6 / SR.9 test |
| N.8 | SR.10 | UC.1.5 Request Resource Status, UC.1.6 Provide Resource Status | `requestResourceStatus()`, `provideResourceStatus()` → `resource-status-source/teams.stub.js` | N.8 / SR.10 test |
| N.9 | SR.11 | Delivery documentation (not an operational step) | README "Intended use, limitations, and responsibilities" | Review |
| N.10 | SR.12 | Delivery checks (not an operational step) | `tests/acceptance.spec.js`, `.github/workflows/ci.yml` | CI |

## Live trace used at Milestone 1

**N.5** "Emergency Coordinators need to retain final authority over resource dispatch decisions"
→ **SR.6** "RescuTech shall issue a dispatch order only after the Emergency Coordinator has approved the
corresponding resource assignment"
→ **UC.1.10 → UC.1.11** (Dispatch Approval triggers Issue Dispatch Order in the Action Diagram)
→ guard in `issueDispatchOrder()`; in the demo, "Send order without approval" returns 409 from `POST /api/recommendations/:id/dispatch-order` and the sequence diagram shows the blocked message.

## No capability without a model counterpart

Every button in the demo calls one UC.1.x function. Nothing in the code adds a capability outside UC.1
(no routing, maps, rejection flow, or automatic dispatch).
