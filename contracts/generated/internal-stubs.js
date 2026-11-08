/*
 * GENERATED from contracts/api-v1.yaml (RescuTech Internal Interface Contract 1.1.0) -- do not hand-edit.
 * Regenerate after changing the contract (npm run generate:stubs), never the other way around.
 * Signature-only stubs: each first-level function module must export exactly these operations
 * (checked by tests/contract.spec.js).
 */
'use strict';

function notImplemented(op) { throw new Error(op + ' is implemented in rescutech-orchestrator/functions/, not in the stub'); }

var OPERATIONS = [
  {
    "operationId": "structureIncident",
    "method": "POST",
    "path": "/internal/f2-2/structure-incident",
    "receiver": "F.2.2",
    "module": "f2-2-structure-incident-information",
    "flowsIn": [
      "IO.10"
    ],
    "flowsOut": [
      "IO.11",
      "IO.12"
    ],
    "requirements": [
      "1.1.1",
      "2.3.1",
      "2.3.3"
    ],
    "request": "RegisteredReport",
    "responses": {
      "201": "StructuringResult",
      "422": "Error"
    },
    "summary": "F.2.1 -> F.2.2 delivers IO.10 Registered Report; F.2.2 returns IO.11 and IO.12"
  },
  {
    "operationId": "getCurrentResourceAvailability",
    "method": "POST",
    "path": "/internal/f2-3/availability",
    "receiver": "F.2.3",
    "module": "f2-3-track-resource-status",
    "flowsIn": [],
    "flowsOut": [
      "IO.13"
    ],
    "requirements": [
      "1.1.2",
      "2.1.3",
      "2.3.2"
    ],
    "request": "IncidentRef",
    "responses": {
      "200": "CurrentResourceAvailability",
      "404": "Error"
    },
    "summary": "F.2.3 -> F.2.4 provides IO.13 Current Resource Availability for one incident"
  },
  {
    "operationId": "requestResourceStatus",
    "method": "POST",
    "path": "/internal/f2-3/status-requests",
    "receiver": "F.2.3",
    "module": "f2-3-track-resource-status",
    "flowsIn": [
      "IO.11"
    ],
    "flowsOut": [],
    "requirements": [
      "1.2.2"
    ],
    "request": "IncidentResourceNeeds",
    "responses": {
      "202": "StatusRequest"
    },
    "summary": "F.2.2 -> F.2.3 delivers IO.11 Incident Resource Needs; F.2.3 opens a resource-status request (external IO.3)"
  },
  {
    "operationId": "recommendResourceAssignment",
    "method": "POST",
    "path": "/internal/f2-4/recommendation",
    "receiver": "F.2.4",
    "module": "f2-4-recommend-resource-assignment",
    "flowsIn": [
      "IO.12",
      "IO.13"
    ],
    "flowsOut": [
      "IO.14"
    ],
    "requirements": [
      "1.2.3",
      "2.1.4",
      "2.3.2"
    ],
    "request": "RecommendationInput",
    "responses": {
      "201": "RecommendationResult"
    },
    "summary": "F.2.4 receives IO.12 Structured Incident and IO.13 Current Resource Availability; returns the recommendation (external IO.5) and IO.14 Proposed Assignment"
  },
  {
    "operationId": "compileAuthorizedDispatchOrder",
    "method": "POST",
    "path": "/internal/f2-5-1/authorized-orders",
    "receiver": "F.2.5.1",
    "module": "f2-5-1-compile-authorized-dispatch-order",
    "flowsIn": [],
    "flowsOut": [
      "IO.15"
    ],
    "requirements": [
      "1.1.2",
      "1.4.1",
      "2.1.1"
    ],
    "request": "AuthorizationRequest",
    "responses": {
      "201": "AuthorizedDispatchOrder",
      "409": "Error"
    },
    "summary": "Inside F.2.5 - F.2.5.1 binds the held IO.14 Proposed Assignment to the control IO.6 Dispatch Approval and returns IO.15 Authorized Dispatch Order"
  },
  {
    "operationId": "issueDispatchOrder",
    "method": "POST",
    "path": "/internal/f2-5-2/dispatch-orders",
    "receiver": "F.2.5.2",
    "module": "f2-5-2-issue-dispatch-order",
    "flowsIn": [
      "IO.15"
    ],
    "flowsOut": [
      "IO.16"
    ],
    "requirements": [
      "1.2.1",
      "1.4.2"
    ],
    "request": "AuthorizedDispatchOrder",
    "responses": {
      "201": "IssueResult",
      "409": "Error"
    },
    "summary": "F.2.5.1 -> F.2.5.2 delivers IO.15 Authorized Dispatch Order; F.2.5.2 sends external IO.7 and returns IO.16 Issued Order Record"
  },
  {
    "operationId": "verifyDispatchAcknowledgment",
    "method": "POST",
    "path": "/internal/f2-5-3/acknowledgments",
    "receiver": "F.2.5.3",
    "module": "f2-5-3-verify-dispatch-acknowledgment",
    "flowsIn": [
      "IO.16"
    ],
    "flowsOut": [
      "IO.17"
    ],
    "requirements": [
      "1.1.3",
      "1.4.3",
      "2.4.1",
      "2.4.2"
    ],
    "request": "AcknowledgmentCheck",
    "responses": {
      "201": "VerifiedAcknowledgment",
      "404": "Error",
      "409": "Error"
    },
    "summary": "F.2.5.2 -> F.2.5.3 delivers IO.16 Issued Order Record with the external IO.8 Dispatch Acknowledgment; F.2.5.3 returns IO.17 Verified Acknowledgment"
  },
  {
    "operationId": "reportDispatchStatus",
    "method": "POST",
    "path": "/internal/f2-5-4/status",
    "receiver": "F.2.5.4",
    "module": "f2-5-4-report-dispatch-status",
    "flowsIn": [
      "IO.17"
    ],
    "flowsOut": [],
    "requirements": [
      "1.2.2",
      "1.4.4"
    ],
    "request": "StatusQuery",
    "responses": {
      "200": "DispatchStatus"
    },
    "summary": "F.2.5.3 -> F.2.5.4 delivers IO.17 Verified Acknowledgment (null until the team acknowledges); F.2.5.4 returns external IO.9 Dispatch Status"
  },
  {
    "operationId": "acceptProposedAssignment",
    "method": "POST",
    "path": "/internal/f2-5/proposed-assignments",
    "receiver": "F.2.5",
    "module": "f2-5-manage-dispatch-orders",
    "flowsIn": [
      "IO.14"
    ],
    "flowsOut": [],
    "requirements": [
      "1.2.4",
      "2.1.1"
    ],
    "request": "ProposedAssignment",
    "responses": {
      "202": "Accepted",
      "409": "Error"
    },
    "summary": "F.2.4 -> F.2.5 delivers IO.14 Proposed Assignment; F.2.5 holds it until the Emergency Coordinator's approval (control IO.6)"
  }
];

var STUBS = {
  "f2-2-structure-incident-information": {
    /** F.2.2 structureIncident(RegisteredReport) -> 201 StructuringResult, 422 Error. Flows in: IO.10; flows out: IO.11, IO.12. */
    structureIncident: function (registeredReport) { return notImplemented("structureIncident"); }
  },
  "f2-3-track-resource-status": {
    /** F.2.3 getCurrentResourceAvailability(IncidentRef) -> 200 CurrentResourceAvailability, 404 Error. Flows in: none; flows out: IO.13. */
    getCurrentResourceAvailability: function (incidentRef) { return notImplemented("getCurrentResourceAvailability"); },
    /** F.2.3 requestResourceStatus(IncidentResourceNeeds) -> 202 StatusRequest. Flows in: IO.11; flows out: none. */
    requestResourceStatus: function (incidentResourceNeeds) { return notImplemented("requestResourceStatus"); }
  },
  "f2-4-recommend-resource-assignment": {
    /** F.2.4 recommendResourceAssignment(RecommendationInput) -> 201 RecommendationResult. Flows in: IO.12, IO.13; flows out: IO.14. */
    recommendResourceAssignment: function (recommendationInput) { return notImplemented("recommendResourceAssignment"); }
  },
  "f2-5-1-compile-authorized-dispatch-order": {
    /** F.2.5.1 compileAuthorizedDispatchOrder(AuthorizationRequest) -> 201 AuthorizedDispatchOrder, 409 Error. Flows in: none; flows out: IO.15. */
    compileAuthorizedDispatchOrder: function (authorizationRequest) { return notImplemented("compileAuthorizedDispatchOrder"); }
  },
  "f2-5-2-issue-dispatch-order": {
    /** F.2.5.2 issueDispatchOrder(AuthorizedDispatchOrder) -> 201 IssueResult, 409 Error. Flows in: IO.15; flows out: IO.16. */
    issueDispatchOrder: function (authorizedDispatchOrder) { return notImplemented("issueDispatchOrder"); }
  },
  "f2-5-3-verify-dispatch-acknowledgment": {
    /** F.2.5.3 verifyDispatchAcknowledgment(AcknowledgmentCheck) -> 201 VerifiedAcknowledgment, 404 Error, 409 Error. Flows in: IO.16; flows out: IO.17. */
    verifyDispatchAcknowledgment: function (acknowledgmentCheck) { return notImplemented("verifyDispatchAcknowledgment"); }
  },
  "f2-5-4-report-dispatch-status": {
    /** F.2.5.4 reportDispatchStatus(StatusQuery) -> 200 DispatchStatus. Flows in: IO.17; flows out: none. */
    reportDispatchStatus: function (statusQuery) { return notImplemented("reportDispatchStatus"); }
  },
  "f2-5-manage-dispatch-orders": {
    /** F.2.5 acceptProposedAssignment(ProposedAssignment) -> 202 Accepted, 409 Error. Flows in: IO.14; flows out: none. */
    acceptProposedAssignment: function (proposedAssignment) { return notImplemented("acceptProposedAssignment"); }
  }
};

module.exports = { OPERATIONS: OPERATIONS, STUBS: STUBS };
