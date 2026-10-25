/*
 * RescuTech — S.1 orchestration of the first-level functions F.2.1–F.2.5.
 *
 * Since Lab 7 the behaviour lives in rescutech-orchestrator/functions/, one module per first-level function of
 * F.2 Orchestrate Rescue Resource Dispatch (Innoslate project 584). This file only carries the internal flows
 * between them, and every internal flow crosses a module boundary through an operation of
 * contracts/api-v1.yaml (see docs/decisions/0003-*.md):
 *
 *   F.2.1 --IO.10--> F.2.2 --IO.11--> F.2.3 --IO.13--> F.2.4 --IO.14--> F.2.5
 *                        \--------------IO.12---------->/
 *
 * The public functions keep the UC.1 action names (UC.1.1–UC.1.15) so routes.js, the front end and the
 * acceptance checks are unchanged. Requirement IDs refer to SRD.1 (SR.x) and SyRD.1 (x.y.z).
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./functions/common.js') : root.RescuTechCommon;
  var F21 = node ? require('./functions/f2-1-register-distress-reports.js') : root.RescuTechF21;
  var F22 = node ? require('./functions/f2-2-structure-incident-information.js') : root.RescuTechF22;
  var F23 = node ? require('./functions/f2-3-track-resource-status.js') : root.RescuTechF23;
  var F24 = node ? require('./functions/f2-4-recommend-resource-assignment.js') : root.RescuTechF24;
  var F25 = node ? require('./functions/f2-5-manage-dispatch-orders.js') : root.RescuTechF25;
  var GuardError = Common.GuardError;

  function createWorkflow(opts) {
    opts = opts || {};
    var now = opts.clock || function () { return new Date(); };
    var seq = { R: 0, I: 0, REC: 0, AP: 0, DO: 0 };
    var logEntries = [];

    var ctx = {
      now: now,
      nextId: function (prefix) { seq[prefix] += 1; return prefix + '-' + String(seq[prefix]).padStart(4, '0'); },
      log: function (uc, actor, text, refs, kind) {
        var entry = { time: now(), uc: uc, actor: actor, text: text, refs: refs || [], kind: kind || 'ok' };
        logEntries.push(entry);
        if (opts.onLog) opts.onLog(entry);
        return entry;
      }
    };

    var f = { 'F.2.1': F21.create(ctx), 'F.2.2': F22.create(ctx), 'F.2.3': F23.create(ctx),
              'F.2.4': F24.create(ctx), 'F.2.5': F25.create(ctx) };

    // Every internal flow passes through here: one contract operation, request in, { status, body } out.
    function call(receiver, operationId, request) {
      var response = f[receiver][operationId](request);
      if (opts.onContractCall) opts.onContractCall({ receiver: receiver, operationId: operationId, request: request, response: response });
      return response;
    }

    // Internal flows produced by one step and consumed by a later, separately triggered step (ADR 0003).
    var inTransit = {};   // incidentId -> { structuredIncident (IO.12), incidentResourceNeeds (IO.11) }

    var state = {
      reports: f['F.2.1'].reports, incidents: f['F.2.2'].incidents, statusRequests: f['F.2.3'].statusRequests,
      teams: f['F.2.3'].teams, recommendations: f['F.2.4'].recommendations, approvals: f['F.2.5'].approvals,
      orders: f['F.2.5'].orders, log: logEntries
    };

    // UC.1.1–UC.1.3 (F.2.1)
    function submitDistressReport(input) { return f['F.2.1'].submitDistressReport(input); }

    // UC.1.4 (F.2.2): IO.10 F.2.1 -> F.2.2; F.2.2 returns IO.11 and IO.12
    function structureIncidentInformation(reportId) {
      var res = call('F.2.2', 'structureIncident', f['F.2.1'].registeredReport(reportId));
      if (res.status !== 201) return { error: res.body.error, rule: res.body.rule };
      inTransit[res.body.structuredIncident.incidentId] = res.body;
      return f['F.2.2'].incidents[res.body.structuredIncident.incidentId];
    }

    // UC.1.5 (F.2.3): IO.11 F.2.2 -> F.2.3
    function requestResourceStatus(incidentId) {
      var flows = inTransit[incidentId];
      if (!flows) throw new GuardError('SR.10', 'Incident ' + incidentId + ' has not been structured.');
      var res = call('F.2.3', 'requestResourceStatus', flows.incidentResourceNeeds);
      return f['F.2.3'].statusRequests[res.body.incidentId];
    }

    // UC.1.6 (F.2.3): external IO.4 from the Rescue Team
    function provideResourceStatus(incidentId, teamId, status) { return f['F.2.3'].provideResourceStatus(incidentId, teamId, status); }

    // UC.1.7–UC.1.8 (F.2.4): IO.13 F.2.3 -> F.2.4 and IO.12 F.2.2 -> F.2.4; IO.14 F.2.4 -> F.2.5
    function presentDispatchRecommendation(incidentId) {
      var flows = inTransit[incidentId];
      if (!flows) throw new GuardError('SR.4', 'Incident ' + incidentId + ' has not been structured.');
      var availability = call('F.2.3', 'getCurrentResourceAvailability', { incidentId: incidentId });
      if (availability.status !== 200) throw new GuardError('SR.10', availability.body.error);
      var res = call('F.2.4', 'recommendResourceAssignment',
                     { structuredIncident: flows.structuredIncident, currentResourceAvailability: availability.body });
      if (res.body.proposedAssignment) call('F.2.5', 'acceptProposedAssignment', res.body.proposedAssignment);
      return res.body.dispatchRecommendation;
    }

    // UC.1.9 Review Dispatch Recommendation (X.2 Emergency Coordinator) — logged only
    function reviewDispatchRecommendation(recId) {
      ctx.log('UC.1.9', 'Coordinator', 'Recommendation ' + recId + ' opened for review.', ['N.4']);
      return f['F.2.4'].recommendations[recId];
    }

    // UC.1.10–UC.1.13 (F.2.5)
    function approveResourceAssignment(recId, by) { return f['F.2.5'].approveResourceAssignment(recId, by); }
    function issueDispatchOrder(recId) { return f['F.2.5'].issueDispatchOrder(recId); }
    function acknowledgeDispatchOrder(orderId, teamId) { return f['F.2.5'].acknowledgeDispatchOrder(orderId, teamId); }

    // UC.1.14 Present Dispatch Status (F.2.5, IO.9) -> UC.1.15 Review Dispatch Status (X.2) — SR.7 / N.6
    function presentDispatchStatus(orderId) { return f['F.2.5'].presentDispatchStatus(orderId); }
    function reviewDispatchStatus(orderId) {
      var s = presentDispatchStatus(orderId);
      ctx.log('UC.1.14', 'RescuTech', 'Status for ' + orderId + ' shown to coordinator: ' + s.label + '.', ['SR.7']);
      ctx.log('UC.1.15', 'Coordinator', 'Coordinator reviewed status of ' + orderId + '.', ['SR.7', 'N.6']);
      return s;
    }

    return {
      state: state,
      functions: f,
      submitDistressReport: submitDistressReport,
      structureIncidentInformation: structureIncidentInformation,
      requestResourceStatus: requestResourceStatus,
      provideResourceStatus: provideResourceStatus,
      presentDispatchRecommendation: presentDispatchRecommendation,
      reviewDispatchRecommendation: reviewDispatchRecommendation,
      approveResourceAssignment: approveResourceAssignment,
      issueDispatchOrder: issueDispatchOrder,
      acknowledgeDispatchOrder: acknowledgeDispatchOrder,
      presentDispatchStatus: presentDispatchStatus,
      reviewDispatchStatus: reviewDispatchStatus
    };
  }

  var api = { createWorkflow: createWorkflow, GuardError: GuardError };
  if (node) module.exports = api;
  else root.RescuTechWorkflow = api;
})(this);
