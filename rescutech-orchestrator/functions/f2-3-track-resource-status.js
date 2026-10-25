/*
 * F.2.3 Track Resource Status (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.11 Incident Resource Needs (internal, from F.2.2); IO.4 Resource Status (external, from F.4 Rescue Team)
 *   Outputs: IO.3 Resource Status Request (external, to F.4); IO.13 Current Resource Availability (internal, to F.2.4)
 *   Satisfies: 1.1.2, 1.2.2, 1.3.3, 2.1.3   UC.1 steps: UC.1.5, UC.1.6
 * Contract operations (contracts/api-v1.yaml):
 *   requestResourceStatus(IncidentResourceNeeds) -> 202 StatusRequest
 *   getCurrentResourceAvailability(IncidentRef)  -> 200 CurrentResourceAvailability | 404 Error
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;
  var Registry = node ? require('../../resource-status-source/teams.stub.js') : root.ResourceRegistryStub;

  function create(ctx) {
    var teams = Registry.initialTeams();
    var statusRequests = {};

    // Contract: requestResourceStatus — IO.11 in; opens UC.1.5 Request Resource Status (IO.3 to every team)
    function requestResourceStatus(needs) {
      var req = { incidentId: needs.incidentId, needs: needs, requestedAt: ctx.now(), responses: {} };
      statusRequests[needs.incidentId] = req;
      ctx.log('UC.1.5', 'RescuTech', 'Resource status requested from ' + teams.length + ' teams.', ['SR.10']);
      return { status: 202, body: { incidentId: needs.incidentId, requestedTeamIds: teams.map(function (t) { return t.id; }),
                                    requestedAt: Common.iso(req.requestedAt) } };
    }

    // UC.1.6 Provide Resource Status (X.3 Rescue Team, IO.4) — SR.10 / N.8, 2.1.3
    function provideResourceStatus(incidentId, teamId, status) {
      var team = teams.filter(function (t) { return t.id === teamId; })[0];
      var req = statusRequests[incidentId];
      var partial = typeof status.available !== 'boolean' || !status.zoneKey || !Array.isArray(status.capabilities);
      if (typeof status.available === 'boolean') team.available = status.available;
      if (status.zoneKey) team.zoneKey = status.zoneKey;
      if (Array.isArray(status.capabilities)) team.capabilities = status.capabilities.slice();
      team.statusIncomplete = partial;
      team.reportedAt = ctx.now();
      req.responses[teamId] = true;
      ctx.log('UC.1.6', 'Rescue Team', team.name + ' reported ' + (team.available ? 'available' : 'unavailable') +
              (partial ? ' (incomplete status flagged)' : '') + '.', ['SR.10', 'N.8'], partial ? 'warn' : 'ok');
      return team;
    }

    // Contract: getCurrentResourceAvailability — IO.13 out
    function getCurrentResourceAvailability(ref) {
      if (!statusRequests[ref.incidentId]) {
        return { status: 404, body: { error: 'No resource-status request is open for ' + ref.incidentId, rule: null } };
      }
      return {
        status: 200,
        body: {
          incidentId: ref.incidentId,
          collectedAt: Common.iso(ctx.now()),
          teams: teams.map(function (t) {
            return { teamId: t.id, name: t.name, available: t.available, zoneKey: t.zoneKey || null,
                     capabilities: t.capabilities.slice(), statusIncomplete: !!t.statusIncomplete, reportedAt: Common.iso(t.reportedAt) };
          })
        }
      };
    }

    return { teams: teams, statusRequests: statusRequests, requestResourceStatus: requestResourceStatus,
             provideResourceStatus: provideResourceStatus, getCurrentResourceAvailability: getCurrentResourceAvailability };
  }

  var api = { id: 'F.2.3', create: create };
  if (node) module.exports = api;
  else root.RescuTechF23 = api;
})(this);
