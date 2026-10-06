/*
 * RescuTech walking skeleton — System of Interest S.1 behaviour.
 *
 * Each public function implements one action from the Innoslate Action Diagram for
 * UC.1 "Coordinator Dispatches Resources to a Distress Report" (UC.1.1–UC.1.15).
 * Function names follow the action names so a reviewer can trace code -> model.
 * Requirement IDs (SR.x) and need IDs (N.x) refer to SRD.1 and UN.1 in Innoslate
 * project 584. See docs/TRACEABILITY.md.
 */
(function (root) {
  'use strict';

  var Structurer = (typeof module !== 'undefined' && module.exports)
    ? require('../incident-structuring-agent/agent.stub.js') : root.IncidentStructurerStub;
  var Registry = (typeof module !== 'undefined' && module.exports)
    ? require('../resource-status-source/teams.stub.js') : root.ResourceRegistryStub;

  function GuardError(rule, message) {
    this.name = 'GuardError';
    this.rule = rule;
    this.message = message;
  }
  GuardError.prototype = Object.create(Error.prototype);

  function createWorkflow(opts) {
    opts = opts || {};
    var now = opts.clock || function () { return new Date(); };
    var seq = { R: 0, I: 0, REC: 0, AP: 0, DO: 0 };
    function nextId(prefix) { seq[prefix] += 1; return prefix + '-' + String(seq[prefix]).padStart(4, '0'); }

    var state = {
      reports: {}, incidents: {}, statusRequests: {}, teams: Registry.initialTeams(),
      recommendations: {}, approvals: {}, orders: {}, log: []
    };

    function log(uc, actor, text, refs, kind) {
      var entry = { time: now(), uc: uc, actor: actor, text: text, refs: refs || [], kind: kind || 'ok' };
      state.log.push(entry);
      if (opts.onLog) opts.onLog(entry);
      return entry;
    }

    // UC.1.1 Submit Distress Report (X.1 Citizen, Interface 1) — SR.1 / N.1
    function submitDistressReport(input) {
      var report = {
        location: (input.location || '').trim(),
        description: (input.description || '').trim()
      };
      if (!report.location || !report.description) {
        log('UC.1.1', 'Citizen', 'Submission incomplete: location and description of assistance are both required.', ['SR.1'], 'warn');
        return { ok: false, error: 'Please enter where you are and what help you need.' };
      }
      log('UC.1.1', 'Citizen', 'Distress report submitted via Interface 1.', ['SR.1', 'N.1']);
      return registerDistressReport(report);
    }

    // UC.1.2 Register Distress Report (S.1) -> UC.1.3 Receive Report Receipt (Citizen) — SR.2 / N.2
    function registerDistressReport(report) {
      var id = nextId('R');
      report.id = id;
      report.registeredAt = now();
      state.reports[id] = report;
      log('UC.1.2', 'RescuTech', 'Report ' + id + ' registered.', ['SR.2']);
      var receipt = {
        reportId: id,
        message: 'Your report ' + id + ' has been registered. This confirms registration only; ' +
                 'it does not mean a team has been assigned or dispatched.'
      };
      log('UC.1.3', 'Citizen', 'Registration receipt for ' + id + ' delivered to the citizen.', ['SR.2', 'N.2']);
      return { ok: true, report: report, receipt: receipt };
    }

    // UC.1.4 Structure Incident Information (S.1, STUB for language-model agent) — SR.3 / N.3
    function structureIncidentInformation(reportId) {
      var report = state.reports[reportId];
      var structured = Structurer.structure(report);
      var id = nextId('I');
      var incident = Object.assign({ id: id, reportId: reportId, status: 'STRUCTURED' }, structured);
      state.incidents[id] = incident;
      var missingNote = incident.missing.length ? ' Missing fields flagged: ' + incident.missing.join(', ') + '.' : '';
      log('UC.1.4', 'RescuTech', 'Incident ' + id + ' structured from ' + reportId + ' [stub].' + missingNote,
          ['SR.3', 'N.3'], incident.missing.length ? 'warn' : 'ok');
      return incident;
    }

    // UC.1.5 Request Resource Status (S.1 -> Rescue Teams, Interface 4)
    function requestResourceStatus(incidentId) {
      var req = { incidentId: incidentId, requestedAt: now(), responses: {} };
      state.statusRequests[incidentId] = req;
      log('UC.1.5', 'RescuTech', 'Resource status requested from ' + state.teams.length + ' teams.', ['SR.10']);
      return req;
    }

    // UC.1.6 Provide Resource Status (X.3 Rescue Team) — SR.10 / N.8
    function provideResourceStatus(incidentId, teamId, status) {
      var team = state.teams.filter(function (t) { return t.id === teamId; })[0];
      var req = state.statusRequests[incidentId];
      var partial = typeof status.available !== 'boolean' || !status.zoneKey || !Array.isArray(status.capabilities);
      if (typeof status.available === 'boolean') team.available = status.available;
      if (status.zoneKey) team.zoneKey = status.zoneKey;
      if (Array.isArray(status.capabilities)) team.capabilities = status.capabilities.slice();
      team.statusIncomplete = partial;
      team.reportedAt = now();
      req.responses[teamId] = true;
      log('UC.1.6', 'Rescue Team', team.name + ' reported ' + (team.available ? 'available' : 'unavailable') +
          (partial ? ' (incomplete status flagged)' : '') + '.', ['SR.10', 'N.8'], partial ? 'warn' : 'ok');
      return team;
    }

    function distanceKm(a, b) {
      if (!a || !b) return null;
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
    }

    // UC.1.7 Evaluate Resource Suitability (S.1, STUB: rule-based matching) — SR.4 / N.4
    function evaluateResourceSuitability(incidentId) {
      var inc = state.incidents[incidentId];
      var zones = Structurer.ZONES;
      var evaluated = state.teams.map(function (t) {
        var reasons = [];
        if (!t.available) reasons.push('reported unavailable');
        var lacking = inc.requiredCapabilities.filter(function (c) { return t.capabilities.indexOf(c) === -1; });
        if (lacking.length) reasons.push('lacks ' + lacking.join(', '));
        if (t.statusIncomplete) reasons.push('status incomplete');
        return {
          teamId: t.id, name: t.name, available: t.available, capabilities: t.capabilities,
          zone: zones[t.zoneKey] ? zones[t.zoneKey].name : 'unknown',
          distanceKm: distanceKm(zones[t.zoneKey], inc.zone),
          reportedAt: t.reportedAt || null,
          suitable: reasons.length === 0, excludedBecause: reasons
        };
      });
      evaluated.sort(function (a, b) {
        if (a.suitable !== b.suitable) return a.suitable ? -1 : 1;
        return (a.distanceKm === null ? 999 : a.distanceKm) - (b.distanceKm === null ? 999 : b.distanceKm);
      });
      log('UC.1.7', 'RescuTech', evaluated.filter(function (e) { return e.suitable; }).length + ' of ' +
          evaluated.length + ' teams meet availability and capability conditions [stub rules].', ['SR.4']);
      return evaluated;
    }

    // UC.1.8 Present Dispatch Recommendation (S.1 -> Coordinator, Interface 3) — SR.4, SR.5 / N.4
    function presentDispatchRecommendation(incidentId) {
      var inc = state.incidents[incidentId];
      var evaluated = evaluateResourceSuitability(incidentId);
      var best = evaluated[0] && evaluated[0].suitable ? evaluated[0] : null;
      var id = nextId('REC');
      var rationale = best ? [
        best.name + ' reported available' + (best.reportedAt ? ' at ' + best.reportedAt.toTimeString().slice(0, 5) : ' (no timestamp)') + '.',
        'Has required capabilities: ' + (inc.requiredCapabilities.join(', ') || 'none identified') + '.',
        best.distanceKm !== null ? 'Closest suitable team: about ' + best.distanceKm + ' km from ' + inc.zone.name + ' (simulated grid).'
                                 : 'Distance unknown because the incident zone is missing.'
      ] : ['No team meets the availability and capability conditions. Coordinator must assign manually.'];
      var rec = { id: id, incidentId: incidentId, teamId: best ? best.teamId : null, teamName: best ? best.name : null,
                  rationale: rationale, alternatives: evaluated, status: 'PRESENTED' };
      state.recommendations[id] = rec;
      log('UC.1.8', 'RescuTech', best ? 'Recommendation ' + id + ': ' + best.name + ', with rationale.'
                                      : 'Recommendation ' + id + ': no suitable team found.', ['SR.4', 'SR.5', 'N.4'],
          best ? 'ok' : 'warn');
      return rec;
    }

    // UC.1.9 Review Dispatch Recommendation (X.2 Emergency Coordinator)
    function reviewDispatchRecommendation(recId) {
      log('UC.1.9', 'Coordinator', 'Recommendation ' + recId + ' opened for review.', ['N.4']);
      return state.recommendations[recId];
    }

    // UC.1.10 Approve Resource Assignment (X.2) — SR.6 / N.5
    function approveResourceAssignment(recId, coordinatorName) {
      var rec = state.recommendations[recId];
      if (!rec || !rec.teamId) throw new GuardError('SR.6', 'There is no recommended team to approve.');
      var id = nextId('AP');
      var approval = { id: id, recId: recId, incidentId: rec.incidentId, teamId: rec.teamId,
                       by: coordinatorName || 'Emergency Coordinator', at: now() };
      state.approvals[recId] = approval;
      rec.status = 'APPROVED';
      log('UC.1.10', 'Coordinator', approval.by + ' approved ' + rec.teamName + ' for ' + rec.incidentId + ' (' + id + ').', ['SR.6', 'N.5']);
      return approval;
    }

    // UC.1.11 Issue Dispatch Order (S.1 -> Rescue Team, Interface 4) — SR.6, SR.8 / N.5, N.7
    // GUARD: an order is issued only after the coordinator approved THIS assignment.
    function issueDispatchOrder(recId) {
      var rec = state.recommendations[recId];
      var approval = state.approvals[recId];
      if (!approval || approval.teamId !== rec.teamId) {
        log('UC.1.11', 'RescuTech', 'Blocked: dispatch order for ' + recId + ' has no coordinator approval.', ['SR.6', 'N.5'], 'block');
        throw new GuardError('SR.6', 'Dispatch blocked. The Emergency Coordinator has not approved this assignment (SR.6).');
      }
      var inc = state.incidents[rec.incidentId];
      var id = nextId('DO');
      var order = {
        id: id, recId: recId, incidentId: inc.id, teamId: rec.teamId, teamName: rec.teamName,
        location: inc.location, task: inc.assistanceNeeded || 'Assess on arrival',
        urgency: inc.urgency, approvalId: approval.id, issuedAt: now(), acknowledgedAt: null
      };
      state.orders[id] = order;
      log('UC.1.11', 'RescuTech', 'Dispatch order ' + id + ' sent to ' + order.teamName + ' (location and task included).', ['SR.6', 'SR.8', 'N.7']);
      return order;
    }

    // UC.1.12 Acknowledge Dispatch Order (X.3) -> UC.1.13 Record Dispatch Acknowledgment (S.1) — SR.9 / N.6
    function acknowledgeDispatchOrder(orderId, teamId) {
      var order = state.orders[orderId];
      if (!order) throw new GuardError('SR.9', 'Unknown dispatch order ' + orderId + '.');
      if (order.teamId !== teamId) {
        log('UC.1.12', 'Rescue Team', 'Rejected: acknowledgment from ' + teamId + ' does not match the assigned team.', ['SR.9'], 'block');
        throw new GuardError('SR.9', 'This order is assigned to a different team.');
      }
      log('UC.1.12', 'Rescue Team', order.teamName + ' acknowledged receipt of ' + orderId + '.', ['SR.9', 'N.6']);
      return recordDispatchAcknowledgment(orderId);
    }

    function recordDispatchAcknowledgment(orderId) {
      var order = state.orders[orderId];
      order.acknowledgedAt = now();
      log('UC.1.13', 'RescuTech', 'Acknowledgment recorded against ' + orderId + '.', ['SR.9']);
      return order;
    }

    // UC.1.14 Present Dispatch Status (S.1 -> Coordinator) -> UC.1.15 Review Dispatch Status — SR.7 / N.6
    // Status is derived only from recorded events, so "Acknowledged" never appears early.
    function presentDispatchStatus(orderId) {
      var order = state.orders[orderId];
      if (!order) return { code: 'NO_ORDER', label: 'No order issued' };
      return order.acknowledgedAt
        ? { code: 'ACKNOWLEDGED', label: 'Acknowledged by ' + order.teamName }
        : { code: 'AWAITING_ACK', label: 'Issued, awaiting acknowledgment' };
    }

    function reviewDispatchStatus(orderId) {
      var s = presentDispatchStatus(orderId);
      log('UC.1.14', 'RescuTech', 'Status for ' + orderId + ' shown to coordinator: ' + s.label + '.', ['SR.7']);
      log('UC.1.15', 'Coordinator', 'Coordinator reviewed status of ' + orderId + '.', ['SR.7', 'N.6']);
      return s;
    }

    return {
      state: state,
      submitDistressReport: submitDistressReport,
      structureIncidentInformation: structureIncidentInformation,
      requestResourceStatus: requestResourceStatus,
      provideResourceStatus: provideResourceStatus,
      evaluateResourceSuitability: evaluateResourceSuitability,
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
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RescuTechWorkflow = api;
})(this);
