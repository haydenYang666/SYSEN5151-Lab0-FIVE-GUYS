# Traceability — need → requirement → model → code → test

IDs refer to Innoslate project 584: UN.1 needs, SRD.1 stakeholder requirements (SR.x), SyRD.1 system requirements,
the S.1.5 Component Requirements Document (CRD), the UC.1 Action Diagram (UC.1.1–UC.1.16) and the IDEF0 diagrams of
F.2 (first level) and F.2.5 (second level). The SR table is also rendered in the demo's Traceability view from
`frontend/model-trace.js`; the CRD table there comes from `frontend/model-architecture.js`.

Each function in the IDEF0 has one module in `rescutech-orchestrator/functions/`, performed by one asset:
first-level `f2-N-…` (F.2.N, S.1.N) and, for the decomposed function F.2.5, second-level `f2-5-N-…` (F.2.5.N, S.1.5.N).
Modules exchange internal flows only through operations of `contracts/api-v1.yaml` (checked by `tests/contract.spec.js`).

## F.2.5 Manage Dispatch Orders — the function selected for PMC2

### Function → asset → module → contract

| Function ID | Function | Asset (mechanism) | Module path | Contract operation · internal flows | UC.1 steps |
|---|---|---|---|---|---|
| F.2.5 | Manage Dispatch Orders | S.1.5 Dispatch Management Subsystem | `rescutech-orchestrator/functions/f2-5-manage-dispatch-orders.js` | `acceptProposedAssignment` · IO.14 in | UC.1.11–UC.1.15 |
| F.2.5.1 | Compile Authorized Dispatch Order | S.1.5.1 Dispatch Authorization Module | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | `compileAuthorizedDispatchOrder` · IO.15 out (control IO.6) | UC.1.11 |
| F.2.5.2 | Issue Dispatch Order | S.1.5.2 Order Transmission Module | `rescutech-orchestrator/functions/f2-5-2-issue-dispatch-order.js` | `issueDispatchOrder` · IO.15 in, IO.16 out (external IO.7) | UC.1.12 |
| F.2.5.3 | Verify Dispatch Acknowledgment | S.1.5.3 Acknowledgment Verification Module | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | `verifyDispatchAcknowledgment` · IO.16 in, IO.17 out (external IO.8) | UC.1.13–UC.1.14 |
| F.2.5.4 | Report Dispatch Status | S.1.5.4 Status Reporting Module | `rescutech-orchestrator/functions/f2-5-4-report-dispatch-status.js` | `reportDispatchStatus` · IO.17 in (external IO.9) | UC.1.15 |

Each second-level module states its function ID, mechanism and ICOMs in its header and exposes one function whose
signature is built from them, for example F.2.5.1 `compile(proposedAssignment /* I IO.14 */, dispatchApproval /* C IO.6 */)
→ authorizedDispatchOrder /* O IO.15 */`.

### Requirement → function → module → test

Tests are named by requirement ID. `tests/test_functional_requirements.py` (pytest, one test per requirement) runs the
matching check in `tests/functional-requirements.spec.js`; CI runs both on every push (`.github/workflows/tests.yml`).

| Requirement | Function | Module path | What is checked | Test name |
|---|---|---|---|---|
| CRD 1.1.1 | F.2.5.1 | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | Accepts the Proposed Assignment (IO.14) from the Recommendation Subsystem | `test_CRD_1_1_1_accept_proposed_assignment` |
| CRD 1.1.2 | F.2.5.1 | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | Accepts the Dispatch Approval (IO.6) from the Emergency Coordinator | `test_CRD_1_1_2_accept_dispatch_approval` |
| CRD 1.4.1 | F.2.5.1 | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | Compiles the authorized dispatch order (IO.15) only from a matching approval | `test_CRD_1_4_1_compile_authorized_dispatch_order` |
| CRD 2.1.1 | F.2.5.1 | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | Matches each dispatch order to its approved resource assignment | `test_CRD_2_1_1_match_order_to_approved_assignment` |
| SR.6 | F.2.5.1 | `rescutech-orchestrator/functions/f2-5-1-compile-authorized-dispatch-order.js` | No dispatch order is issued before the coordinator approves the assignment | `test_SR_6_no_order_without_coordinator_approval` |
| CRD 1.2.1 | F.2.5.2 | `rescutech-orchestrator/functions/f2-5-2-issue-dispatch-order.js` | Provides the Dispatch Order (IO.7) to the assigned Rescue Team | `test_CRD_1_2_1_provide_dispatch_order_to_rescue_team` |
| CRD 1.4.2 | F.2.5.2 | `rescutech-orchestrator/functions/f2-5-2-issue-dispatch-order.js` | Issues exactly one dispatch order per authorization | `test_CRD_1_4_2_issue_one_order_per_authorization` |
| SR.8 | F.2.5.2 | `rescutech-orchestrator/functions/f2-5-2-issue-dispatch-order.js` | The dispatch order identifies the incident location and the assigned task | `test_SR_8_order_identifies_location_and_task` |
| CRD 1.1.3 | F.2.5.3 | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | Accepts the Dispatch Acknowledgment (IO.8) from the Rescue Team | `test_CRD_1_1_3_accept_dispatch_acknowledgment` |
| CRD 1.4.3 | F.2.5.3 | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | Verifies the acknowledgment against the issued-order record (IO.16) and passes IO.17 | `test_CRD_1_4_3_verify_acknowledgment_against_issued_order` |
| CRD 2.4.1 | F.2.5.3 | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | Records each acknowledgment against its identified dispatch order | `test_CRD_2_4_1_record_acknowledgment_against_its_order` |
| CRD 2.4.2 | F.2.5.3 | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | Rejects acknowledgments from rescue teams not assigned to the order | `test_CRD_2_4_2_reject_acknowledgment_from_non_assigned_team` |
| SR.9 | F.2.5.3 | `rescutech-orchestrator/functions/f2-5-3-verify-dispatch-acknowledgment.js` | The assigned Rescue Team can acknowledge receipt of a dispatch order | `test_SR_9_assigned_team_can_acknowledge` |
| CRD 1.2.2 | F.2.5.4 | `rescutech-orchestrator/functions/f2-5-4-report-dispatch-status.js` | Provides the Dispatch Status (IO.9) to the Emergency Coordinator | `test_CRD_1_2_2_provide_dispatch_status_to_coordinator` |
| CRD 1.4.4 | F.2.5.4 | `rescutech-orchestrator/functions/f2-5-4-report-dispatch-status.js` | Reports dispatch status from the verified acknowledgment (IO.17) only | `test_CRD_1_4_4_report_status_from_verified_acknowledgment` |
| SR.7 | F.2.5.4 | `rescutech-orchestrator/functions/f2-5-4-report-dispatch-status.js` | The coordinator can see whether the assigned team acknowledged the order | `test_SR_7_coordinator_sees_acknowledgment_status` |
| CRD 2.3.1 | F.2.5 | `rescutech-orchestrator/functions/f2-5-manage-dispatch-orders.js` | Issues dispatch orders without invoking the language model (inspection of the S.1.5 modules) | `test_CRD_2_3_1_no_language_model_in_dispatch_management` |

Interface requirements CRD 1.3.1–1.3.3 are checked by the contract conformance checks (`tests/contract.spec.js`
C.3, C.4). Not yet built, so not tested: CRD 2.2.2 (offline acknowledgment queue), 2.4.3 (coordinator authentication),
2.4.4 (365-day retention). CRD 2.2.1 (runs in a browser) is verified by demonstration.

### Requirements trace for F.2.5 in Innoslate

- **Parent function, system level:** F.2.5 satisfies SyRD 1.1.3, 1.1.4, 1.2.4, 1.2.5, 1.3.2, 1.3.3, 2.1.1, 2.4.1, 2.4.2
  and stakeholder requirements SR.6–SR.9 (table below).
- **Component specification, second level:** the S.1.5 CRD — functional (1.4.1–1.4.4), input/output (1.1.1–1.1.3,
  1.2.1–1.2.2) and interface (1.3.1–1.3.3) requirements, each allocated to S.1.5.1–S.1.5.4 and verified by a test case
  TC.CRD.x.
- **Flow-down example:** SyRD 2.5.1, the USD 50/month language-model budget, is **apportioned** across subsystems
  (S.1.2 60 %, S.1.4 40 %, S.1.5 0 %) and becomes CRD 2.3.1 "Shall issue dispatch orders without invoking the
  language model" (test `test_CRD_2_3_1_no_language_model_in_dispatch_management`). Other methods used: equivalence
  (SyRD 2.1.1 → CRD 2.1.1) and synthesis (SyRD 2.2.2 → CRD 2.2.2).

## Need → stakeholder requirement → UC step → code (whole system)

| Need | Requirement | Model step (UC.1 actions) | Code | Check |
|------|-------------|---------------------------|------|-------|
| N.1 | SR.1 | UC.1.1 Submit Distress Report | `submitDistressReport()` | N.1 / SR.1 tests |
| N.2 | SR.2 | UC.1.2 Register Distress Report, UC.1.3 Receive Report Receipt | `registerDistressReport()` | N.2 / SR.2 test |
| N.3 | SR.3 | UC.1.4 Structure Incident Information | `structureIncidentInformation()` → `incident-structuring-agent/agent.stub.js` | N.3 / SR.3 test |
| N.4 | SR.4 | UC.1.8 Evaluate Resource Suitability, UC.1.9 Present Dispatch Recommendation | F.2.4 `recommendResourceAssignment()` (`functions/f2-4-…`), via `presentDispatchRecommendation()` | N.4 / SR.4 test |
| N.4 | SR.5 | UC.1.9, UC.1.10 Review Dispatch Recommendation | `rec.rationale`, `reviewDispatchRecommendation()` | N.4 / SR.5 test |
| N.5 | SR.6 | UC.1.11 Approve Resource Assignment, UC.1.12 Issue Dispatch Order | `approveResourceAssignment()`, guard in `issueDispatchOrder()` | N.5 / SR.6 tests |
| N.6 | SR.7 | UC.1.15 Present Dispatch Status, UC.1.16 Review Dispatch Status | `presentDispatchStatus()`, `reviewDispatchStatus()` | N.6 / SR.7 test |
| N.7 | SR.8 | UC.1.12 Issue Dispatch Order | `order.location`, `order.task` | N.7 / SR.8 test |
| N.6 | SR.9 | UC.1.13 Acknowledge Dispatch Order, UC.1.14 Record Dispatch Acknowledgment | `acknowledgeDispatchOrder()`, `recordDispatchAcknowledgment()` | N.6 / SR.9 test |
| N.8 | SR.10 | UC.1.5 Request Resource Status, UC.1.6 Provide Resource Status, UC.1.7 Update Resource Availability | `requestResourceStatus()`, `provideResourceStatus()`, `getCurrentResourceAvailability()` → `resource-status-source/teams.stub.js` | N.8 / SR.10 test |
| N.9 | SR.11 | Delivery documentation (not an operational step) | README "Intended use, limitations, and responsibilities" | Review |
| N.10 | SR.12 | Delivery checks (not an operational step) | `tests/acceptance.spec.js`, `.github/workflows/tests.yml` | CI |

## Live trace used at Milestone 1

**N.5** "Emergency Coordinators need to retain final authority over resource dispatch decisions"
→ **SR.6** "RescuTech shall issue a dispatch order only after the Emergency Coordinator has approved the
corresponding resource assignment"
→ **UC.1.11 → UC.1.12** (Dispatch Approval triggers Issue Dispatch Order in the Action Diagram)
→ guard in `issueDispatchOrder()`; in the demo, "Send order without approval" returns 409 from `POST /api/recommendations/:id/dispatch-order` and the sequence diagram shows the blocked message.

## No capability without a model counterpart

Every button in the demo calls one UC.1.x function. Nothing in the code adds a capability outside UC.1
(no routing, maps, rejection flow, or automatic dispatch).
