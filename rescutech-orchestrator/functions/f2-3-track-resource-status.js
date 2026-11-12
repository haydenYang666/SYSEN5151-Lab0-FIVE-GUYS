/*
 * F.2.3 Track Resource Status (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.11 Incident Resource Needs (internal, from F.2.2); IO.4 Resource Status (external, pushed by F.4 Rescue Team)
 *   Outputs: IO.3 Status Refresh Request (external, to F.4, stale teams only); IO.13 Current Resource Availability (internal, to F.2.4)
 *   Satisfies: 1.1.2, 1.2.2, 1.3.3, 2.1.3   UC.1 steps: UC.1.5, UC.1.6, UC.1.7
 *   Mechanism: S.1.3 Resource Status Subsystem
 * Contract operations (contracts/api-v1.yaml):
 *   retrieveLatestTeamStatus(IncidentResourceNeeds) -> 202 StatusRetrieval
 *   getCurrentResourceAvailability(IncidentRef)      -> 200 CurrentResourceAvailability | 404 Error
 *
 * Revised Nov 2026 with UC.1 after the Modeling and Simulation study: Rescue Teams push status whenever it
 * changes (UC.1.6 Push Status Update), so an incident no longer waits for every team to answer a poll.
 * UC.1.5 reads the latest pushed status and sends IO.3 only to teams whose status is stale. In the Innoslate
 * action diagram IO.3 and IO.4 are optional (non-trigger) flows; here that means nothing blocks on them.
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Common = node ? require('./common.js') : root.RescuTechCommon;
  var Registry = node ? require('../../resource-status-source/teams.stub.js') : root.ResourceRegistryStub;

  var DEFAULT_STALE_MS = 10 * 60 * 1000;   // status older than 10 min is refreshed (assumption, see docs/decisions/0005)

  function create(ctx) {
    var staleMs = ctx.statusStaleMs || DEFAULT_STALE_MS;
    var teams = Registry.initialTeams();
    var started = ctx.now();
    // The simulated teams have already pushed their status when the scenario starts.
    teams.forEach(function (t) { t.reportedAt = started; t.statusIncomplete = false; });
    var statusRequests = {};

    function isStale(t, now) { return !t.reportedAt || (now - t.reportedAt) > staleMs || t.statusIncomplete; }

    // UC.1.6 Push Status Update (X.3 Rescue Team, IO.4) — any time, independent of incidents. SR.10 / N.8, 2.1.3
    function pushStatusUpdate(teamId, status) {
      var team = teams.filter(function (t) { return t.id === teamId; })[0];
      if (!team) return null;
      status = status || {};
      var partial = typeof status.available !== 'boolean' || !status.zoneKey || !Array.isArray(status.capabilities);
      if (typeof status.available === 'boolean') team.available = status.available;
      if (status.zoneKey) team.zoneKey = status.zoneKey;
      if (Array.isArray(status.capabilities)) team.capabilities = status.capabilities.slice();
      team.statusIncomplete = partial;
      team.reportedAt = ctx.now();
      Object.keys(statusRequests).forEach(function (id) {
        var req = statusRequests[id];
        if (req.staleTeamIds.indexOf(teamId) !== -1) req.responses[teamId] = true;
      });
      ctx.log('UC.1.6', 'Rescue Team', team.name + ' pushed status: ' + (team.available ? 'available' : 'unavailable') +
              (partial ? ' (incomplete status flagged)' : '') + '.', ['SR.10', 'N.8'], partial ? 'warn' : 'ok');
      return team;
    }

    // Kept for the per-incident route: a stale team answering a Status Refresh Request is the same push.
    function provideResourceStatus(incidentId, teamId, status) { return pushStatusUpdate(teamId, status); }

    // Contract: retrieveLatestTeamStatus — IO.11 in. UC.1.5 Retrieve Latest Team Status.
    function retrieveLatestTeamStatus(needs) {
      var now = ctx.now();
      var stale = teams.filter(function (t) { return isStale(t, now); }).map(function (t) { return t.id; });
      statusRequests[needs.incidentId] = { incidentId: needs.incidentId, needs: needs, requestedAt: now, staleTeamIds: stale, responses: {} };
      ctx.log('UC.1.5', 'RescuTech', 'Latest pushed status retrieved for ' + teams.length + ' teams' +
              (stale.length ? '; Status Refresh Request (IO.3) sent to ' + stale.join(', ') + '.' : '; none stale, no refresh needed.'), ['SR.10']);
      return { status: 202, body: { incidentId: needs.incidentId, retrievedAt: Common.iso(now),
                                    teamIds: teams.map(function (t) { return t.id; }), staleTeamIds: stale } };
    }

    // Contract: getCurrentResourceAvailability — IO.13 out.
    // UC.1.7 Update Resource Availability — uses the latest status already held; it does not wait for refresh replies.
    function getCurrentResourceAvailability(ref) {
      if (!statusRequests[ref.incidentId]) {
        return { status: 404, body: { error: 'Latest team status has not been retrieved for ' + ref.incidentId, rule: null } };
      }
      ctx.log('UC.1.7', 'RescuTech', 'Current resource availability built from the latest status of ' + teams.length + ' teams.', ['SR.10']);
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

    return { teams: teams, statusRequests: statusRequests, retrieveLatestTeamStatus: retrieveLatestTeamStatus,
             pushStatusUpdate: pushStatusUpdate, provideResourceStatus: provideResourceStatus,
             getCurrentResourceAvailability: getCurrentResourceAvailability };
  }

  var api = { id: 'F.2.3', create: create };
  if (node) module.exports = api;
  else root.RescuTechF23 = api;
})(this);
