/*
 * F.2.4 Recommend Resource Assignment (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.12 Structured Incident (from F.2.2); IO.13 Current Resource Availability (from F.2.3)
 *   Outputs: IO.5 Dispatch Recommendation (external, to F.3 Emergency Coordinator); IO.14 Proposed Assignment (internal, to F.2.5)
 *   Satisfies: 1.2.3, 1.3.2, 2.1.4, 2.3.2   UC.1 steps: UC.1.7, UC.1.8
 * Contract operation (contracts/api-v1.yaml):
 *   recommendResourceAssignment(RecommendationInput) -> 201 RecommendationResult
 * Works only on the two flows it receives; it does not read F.2.2's or F.2.3's internal state.
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Structurer = node ? require('../../incident-structuring-agent/agent.stub.js') : root.IncidentStructurerStub;

  function distanceKm(a, b) {
    if (!a || !b) return null;
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
  }

  function create(ctx) {
    var recommendations = {};

    // UC.1.7 Evaluate Resource Suitability (STUB: rule-based matching) — SR.4 / N.4
    function evaluate(inc, availability) {
      var zones = Structurer.ZONES;
      var evaluated = availability.teams.map(function (t) {
        var reasons = [];
        if (!t.available) reasons.push('reported unavailable');
        var lacking = inc.requiredCapabilities.filter(function (c) { return t.capabilities.indexOf(c) === -1; });
        if (lacking.length) reasons.push('lacks ' + lacking.join(', '));
        if (t.statusIncomplete) reasons.push('status incomplete');
        return {
          teamId: t.teamId, name: t.name, available: t.available, capabilities: t.capabilities,
          zone: zones[t.zoneKey] ? zones[t.zoneKey].name : 'unknown',
          distanceKm: distanceKm(zones[t.zoneKey], inc.zone),
          reportedAt: t.reportedAt,
          suitable: reasons.length === 0, excludedBecause: reasons
        };
      });
      evaluated.sort(function (a, b) {
        if (a.suitable !== b.suitable) return a.suitable ? -1 : 1;
        return (a.distanceKm === null ? 999 : a.distanceKm) - (b.distanceKm === null ? 999 : b.distanceKm);
      });
      ctx.log('UC.1.7', 'RescuTech', evaluated.filter(function (e) { return e.suitable; }).length + ' of ' +
              evaluated.length + ' teams meet availability and capability conditions [stub rules].', ['SR.4']);
      return evaluated;
    }

    // Contract: recommendResourceAssignment — IO.12 + IO.13 in; IO.5 (external) and IO.14 out.
    // UC.1.8 Present Dispatch Recommendation — SR.4, SR.5 / N.4; 2.3.2 (report time shown); 2.1.4 (no match)
    function recommendResourceAssignment(input) {
      var inc = input.structuredIncident;
      var evaluated = evaluate(inc, input.currentResourceAvailability);
      var best = evaluated[0] && evaluated[0].suitable ? evaluated[0] : null;
      var id = ctx.nextId('REC');
      var rationale = best ? [
        best.name + ' reported available' + (best.reportedAt ? ' at ' + new Date(best.reportedAt).toTimeString().slice(0, 5) : ' (no timestamp)') + '.',
        'Has required capabilities: ' + (inc.requiredCapabilities.join(', ') || 'none identified') + '.',
        best.distanceKm !== null ? 'Closest suitable team: about ' + best.distanceKm + ' km from ' + inc.zone.name + ' (simulated grid).'
                                 : 'Distance unknown because the incident zone is missing.'
      ] : ['No team meets the availability and capability conditions. Coordinator must assign manually.'];
      var rec = { id: id, incidentId: inc.incidentId, teamId: best ? best.teamId : null, teamName: best ? best.name : null,
                  rationale: rationale, alternatives: evaluated, status: 'PRESENTED' };
      recommendations[id] = rec;
      ctx.log('UC.1.8', 'RescuTech', best ? 'Recommendation ' + id + ': ' + best.name + ', with rationale.'
                                          : 'Recommendation ' + id + ': no suitable team found.', ['SR.4', 'SR.5', 'N.4'],
              best ? 'ok' : 'warn');
      var proposedAssignment = best ? {                               // IO.14
        recommendationId: id, incidentId: inc.incidentId, teamId: best.teamId, teamName: best.name,
        location: inc.location, task: inc.assistanceNeeded || 'Assess on arrival', urgency: inc.urgency
      } : null;
      return { status: 201, body: { dispatchRecommendation: rec, proposedAssignment: proposedAssignment } };
    }

    return { recommendations: recommendations, recommendResourceAssignment: recommendResourceAssignment };
  }

  var api = { id: 'F.2.4', create: create };
  if (node) module.exports = api;
  else root.RescuTechF24 = api;
})(this);
