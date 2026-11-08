/*
 * Physical architecture (Form) from Innoslate project 584, as used by the Architecture view and the
 * function strip. Function -> performing asset is one-to-one at both levels (F.2.x -> S.1.x, F.2.5.x -> S.1.5.x).
 * UC numbers follow the current Innoslate UC.1 Action Diagram (UC.1.1–UC.1.16, with UC.1.7 Update Resource
 * Availability), the same numbering the service code logs.
 */
(function (root) {
  'use strict';
  var F25 = 'rescutech-orchestrator/functions/f2-5-manage-dispatch-orders.js';
  var EL = {
    'F.2': { kind: 'Function', name: 'Orchestrate Rescue Resource Dispatch', asset: 'S.1',
      desc: 'The system function of RescuTech, decomposed into five first-level functions.' },
    'F.2.1': { kind: 'Function', name: 'Register Distress Reports', asset: 'S.1.1', step: 0,
      inputs: 'IO.1 Distress Report', outputs: 'IO.2 Report Receipt · IO.10 Registered Report',
      uc: 'UC.1.1–UC.1.3', srs: ['SR.1', 'SR.2'],
      code: 'functions/f2-1-register-distress-reports.js', fns: 'submitDistressReport(), registerDistressReport()',
      api: 'POST /api/distress-reports' },
    'F.2.2': { kind: 'Function', name: 'Structure Incident Information', asset: 'S.1.2', step: 1,
      inputs: 'IO.10 Registered Report', outputs: 'IO.11 Incident Resource Needs · IO.12 Structured Incident',
      uc: 'UC.1.4', srs: ['SR.3'], stub: true,
      code: 'functions/f2-2-structure-incident-information.js + incident-structuring-agent/', fns: 'structureIncident()',
      api: 'POST /api/distress-reports/:id/incident' },
    'F.2.3': { kind: 'Function', name: 'Track Resource Status', asset: 'S.1.3', step: 2,
      inputs: 'IO.11 Incident Resource Needs · IO.4 Resource Status', outputs: 'IO.3 Resource Status Request · IO.13 Current Resource Availability',
      uc: 'UC.1.5–UC.1.7', srs: ['SR.10'], stub: true,
      code: 'functions/f2-3-track-resource-status.js + resource-status-source/', fns: 'requestResourceStatus(), provideResourceStatus(), getCurrentResourceAvailability()',
      api: 'POST /api/incidents/:id/status-requests · PUT …/team-status/:teamId' },
    'F.2.4': { kind: 'Function', name: 'Recommend Resource Assignment', asset: 'S.1.4', step: 3,
      inputs: 'IO.12 Structured Incident · IO.13 Current Resource Availability', outputs: 'IO.5 Dispatch Recommendation · IO.14 Proposed Assignment',
      uc: 'UC.1.8–UC.1.10', srs: ['SR.4', 'SR.5'], stub: true,
      code: 'functions/f2-4-recommend-resource-assignment.js', fns: 'recommendResourceAssignment()',
      api: 'POST /api/incidents/:id/recommendation' },
    'F.2.5': { kind: 'Function', name: 'Manage Dispatch Orders', asset: 'S.1.5', step: 4,
      inputs: 'IO.14 Proposed Assignment · IO.8 Dispatch Acknowledgment', control: 'IO.6 Dispatch Approval',
      outputs: 'IO.7 Dispatch Order · IO.9 Dispatch Status',
      uc: 'UC.1.11–UC.1.16', srs: ['SR.6', 'SR.7', 'SR.8', 'SR.9'],
      code: F25, fns: 'four second-level functions, see F.2.5.1–F.2.5.4', api: 'approval, dispatch-order, acknowledgment, status routes' },
    'F.2.5.1': { kind: 'Function', name: 'Compile Authorized Dispatch Order', asset: 'S.1.5.1', step: 4,
      inputs: 'IO.14 Proposed Assignment', control: 'IO.6 Dispatch Approval', outputs: 'IO.15 Authorized Dispatch Order',
      uc: 'UC.1.11', srs: ['SR.6'], crd: ['1.1.1', '1.1.2', '1.3.1', '1.3.2', '1.4.1', '2.1.1', '2.4.3'],
      code: F25, fns: 'acceptProposedAssignment(), approveResourceAssignment(), approval guard in issueDispatchOrder()',
      api: 'POST /api/recommendations/:id/approval' },
    'F.2.5.2': { kind: 'Function', name: 'Issue Dispatch Order', asset: 'S.1.5.2', step: 5,
      inputs: 'IO.15 Authorized Dispatch Order', outputs: 'IO.7 Dispatch Order · IO.16 Issued Order Record',
      uc: 'UC.1.12', srs: ['SR.6', 'SR.8'], crd: ['1.2.1', '1.3.3', '1.4.2', '2.3.1'],
      code: F25, fns: 'issueDispatchOrder()', api: 'POST /api/recommendations/:id/dispatch-order' },
    'F.2.5.3': { kind: 'Function', name: 'Verify Dispatch Acknowledgment', asset: 'S.1.5.3', step: 5,
      inputs: 'IO.8 Dispatch Acknowledgment · IO.16 Issued Order Record', outputs: 'IO.17 Verified Acknowledgment',
      uc: 'UC.1.13–UC.1.14', srs: ['SR.9'], crd: ['1.1.3', '1.3.3', '1.4.3', '2.2.2', '2.4.1', '2.4.2'],
      code: F25, fns: 'acknowledgeDispatchOrder() — rejects a team that is not the assigned one', api: 'POST /api/dispatch-orders/:id/acknowledgment' },
    'F.2.5.4': { kind: 'Function', name: 'Report Dispatch Status', asset: 'S.1.5.4', step: 6,
      inputs: 'IO.17 Verified Acknowledgment', outputs: 'IO.9 Dispatch Status',
      uc: 'UC.1.15–UC.1.16', srs: ['SR.7'], crd: ['1.2.2', '1.3.2', '1.4.4'],
      code: F25, fns: 'presentDispatchStatus()', api: 'GET /api/dispatch-orders/:id/status' },

    'S.1': { kind: 'Asset · system', name: 'RescuTech Disaster Response Agent Orchestrator', fn: 'F.2',
      desc: 'System of interest. Exchanges IO.1–IO.9 with X.1 Citizen (C.1), X.2 Emergency Coordinator (C.2) and X.3 Rescue Team (C.3).' },
    'S.1.1': { kind: 'Asset · subsystem', name: 'Report Intake Subsystem', fn: 'F.2.1', conduits: 'C.1 (X.1) · C.4 → S.1.2',
      desc: 'Receives citizen reports, checks required fields, registers them and issues report receipts.' },
    'S.1.2': { kind: 'Asset · subsystem', name: 'Incident Structuring Subsystem', fn: 'F.2.2', conduits: 'C.4 · C.5 → S.1.3 · C.6 → S.1.4',
      desc: 'Turns registered reports into structured incidents and resource needs; invalid model output goes to manual handling.' },
    'S.1.3': { kind: 'Asset · subsystem', name: 'Resource Status Subsystem', fn: 'F.2.3', conduits: 'C.3 (X.3) · C.5 · C.7 → S.1.4',
      desc: 'Requests status from rescue teams and keeps current resource availability.' },
    'S.1.4': { kind: 'Asset · subsystem', name: 'Recommendation Subsystem', fn: 'F.2.4', conduits: 'C.2 (X.2) · C.6 · C.7 · C.8 → S.1.5',
      desc: 'Matches the structured incident against availability and produces the recommendation and proposed assignment.' },
    'S.1.5': { kind: 'Asset · subsystem', name: 'Dispatch Management Subsystem', fn: 'F.2.5', conduits: 'C.8 · C.2 (X.2) · C.3 (X.3)',
      desc: 'Holds proposed assignments, issues authorized orders, validates acknowledgments and reports status. Decomposed to level 2.' },
    'S.1.5.1': { kind: 'Asset · module', name: 'Dispatch Authorization Module', fn: 'F.2.5.1', conduits: 'C.8 · C.2 in · C.9 → S.1.5.2',
      desc: 'Binds the coordinator approval to its proposed assignment and only then compiles the authorized order.' },
    'S.1.5.2': { kind: 'Asset · module', name: 'Order Transmission Module', fn: 'F.2.5.2', conduits: 'C.9 · C.3 → X.3 · C.10 → S.1.5.3',
      desc: 'Sends the dispatch order to the assigned team and records the issued order.' },
    'S.1.5.3': { kind: 'Asset · module', name: 'Acknowledgment Verification Module', fn: 'F.2.5.3', conduits: 'C.3 in · C.10 · C.11 → S.1.5.4',
      desc: 'Matches each acknowledgment to the issued order and rejects senders that are not the assigned team.' },
    'S.1.5.4': { kind: 'Asset · module', name: 'Status Reporting Module', fn: 'F.2.5.4', conduits: 'C.11 · C.2 → X.2',
      desc: 'Turns verified acknowledgments into the dispatch status shown to the coordinator.' }
  };
  Object.keys(EL).forEach(function (k) {
    var e = EL[k]; e.id = k;
    if (e.kind === 'Function' && !e.desc) e.desc = EL[e.asset] ? EL[e.asset].desc : '';
  });

  // S.1.5 Component Requirements Document (CRD) — Innoslate, flowed down from SyRD.
  var CRD = [
    ['1.1.1', 'Shall accept Proposed Assignment from the Recommendation Subsystem.', 'S.1.5.1', 'Test'],
    ['1.1.2', 'Shall accept Dispatch Approval from the Emergency Coordinator.', 'S.1.5.1', 'Test'],
    ['1.1.3', 'Shall accept Dispatch Acknowledgment from the Rescue Team.', 'S.1.5.3', 'Test'],
    ['1.2.1', 'Shall provide Dispatch Order to the Rescue Team.', 'S.1.5.2', 'Test'],
    ['1.2.2', 'Shall provide Dispatch Status to the Emergency Coordinator.', 'S.1.5.4', 'Test'],
    ['1.3.1', 'Shall interface with the Recommendation Subsystem through the Proposed Assignment Interface.', 'S.1.5.1', 'Inspection'],
    ['1.3.2', 'Shall interface with the Emergency Coordinator through the Coordination Interface.', 'S.1.5.1, S.1.5.4', 'Test'],
    ['1.3.3', 'Shall interface with the Rescue Team through the Rescue Team Interface.', 'S.1.5.2, S.1.5.3', 'Test'],
    ['1.4.1', 'Shall compile authorized dispatch order.', 'S.1.5.1', 'Test'],
    ['1.4.2', 'Shall issue dispatch order.', 'S.1.5.2', 'Test'],
    ['1.4.3', 'Shall verify dispatch acknowledgment.', 'S.1.5.3', 'Test'],
    ['1.4.4', 'Shall report dispatch status.', 'S.1.5.4', 'Test'],
    ['2.1.1', 'Shall match each dispatch order to its approved resource assignment.', 'S.1.5.1', 'Test'],
    ['2.2.1', 'Shall run in the current browser of each test device without dedicated hardware.', 'S.1.5.1–S.1.5.4', 'Demonstration'],
    ['2.2.2', 'Shall process queued dispatch acknowledgments in their original send order upon Rescue Team client reconnection.', 'S.1.5.3', 'Test'],
    ['2.3.1', 'Shall issue dispatch orders without invoking the language model.', 'S.1.5.1–S.1.5.4', 'Inspection'],
    ['2.4.1', 'Shall record each acknowledgment against its identified dispatch order.', 'S.1.5.3', 'Test'],
    ['2.4.2', 'Shall reject acknowledgments from rescue teams not assigned to the identified dispatch order.', 'S.1.5.3', 'Test'],
    ['2.4.3', 'Shall reject each Dispatch Approval from unauthenticated Emergency Coordinator accounts.', 'S.1.5.1', 'Test'],
    ['2.4.4', 'Shall retain each dispatch record (approval, order or acknowledgment) for 365 days.', 'S.1.5.1–S.1.5.3', 'Inspection'],
    ['2.6.1', 'Shall complete the baseline dispatch steps (UC.1.11–UC.1.16) in the end-of-term project demonstration.', 'S.1.5.1–S.1.5.4', 'Demonstration']
  ];
  // How each CRD item shows up in this prototype (honest status: shown / partial / planned).
  var CRD_PROTO = {
    '1.1.1': ['shown', 'acceptProposedAssignment() via contract'], '1.1.2': ['shown', 'Approve button → approval route'],
    '1.1.3': ['shown', 'Acknowledge button → acknowledgment route'], '1.2.1': ['shown', 'Order card on team tablet'],
    '1.2.2': ['shown', 'Status timeline on console'], '1.3.1': ['shown', 'contracts/api-v1.yaml, contract checks'],
    '1.3.2': ['shown', 'Coordinator console'], '1.3.3': ['shown', 'Rescue Team tablet'],
    '1.4.1': ['shown', 'Approval bound to recommendation'], '1.4.2': ['shown', 'One order per approval'],
    '1.4.3': ['shown', 'Wrong-team acknowledgment rejected'], '1.4.4': ['shown', 'Status from recorded events only'],
    '2.1.1': ['shown', 'Send without approval → 409'], '2.2.1': ['shown', 'Runs in any current browser'],
    '2.2.2': ['planned', 'Offline queue not built yet'], '2.3.1': ['shown', 'f2-5 module makes no model calls'],
    '2.4.1': ['shown', 'Ack stored on its order'], '2.4.2': ['shown', 'GuardError for non-assigned team'],
    '2.4.3': ['partial', 'Approver name recorded; no login yet'], '2.4.4': ['planned', 'In-memory store for now'],
    '2.6.1': ['shown', 'This Operate view, steps 5–7']
  };

  // Since 2026-11-08 the service code logs the current Innoslate numbering, so no conversion is needed.
  function ucModel(code) { return code; }
  var UC_NAMES = {
    'UC.1.1': 'Submit Distress Report', 'UC.1.2': 'Register Distress Report', 'UC.1.3': 'Receive Report Receipt',
    'UC.1.4': 'Structure Incident Information', 'UC.1.5': 'Request Resource Status', 'UC.1.6': 'Provide Resource Status',
    'UC.1.7': 'Update Resource Availability', 'UC.1.8': 'Evaluate Resource Suitability', 'UC.1.9': 'Present Dispatch Recommendation',
    'UC.1.10': 'Review Dispatch Recommendation', 'UC.1.11': 'Approve Resource Assignment', 'UC.1.12': 'Issue Dispatch Order',
    'UC.1.13': 'Acknowledge Dispatch Order', 'UC.1.14': 'Record Dispatch Acknowledgment', 'UC.1.15': 'Present Dispatch Status',
    'UC.1.16': 'Review Dispatch Status'
  };

  root.RESCUTECH_ARCH = { EL: EL, CRD: CRD, CRD_PROTO: CRD_PROTO, ucModel: ucModel, UC_NAMES: UC_NAMES };
})(this);
