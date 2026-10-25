/*
 * GENERATED from contracts/api-v1.yaml (RescuTech Internal Interface Contract 1.0.0) -- do not hand-edit.
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
  "f2-5-manage-dispatch-orders": {
    /** F.2.5 acceptProposedAssignment(ProposedAssignment) -> 202 Accepted, 409 Error. Flows in: IO.14; flows out: none. */
    acceptProposedAssignment: function (proposedAssignment) { return notImplemented("acceptProposedAssignment"); }
  }
};

module.exports = { OPERATIONS: OPERATIONS, STUBS: STUBS };
