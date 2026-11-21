/*
 * F.2.2 Structure Incident Information (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.10 Registered Report (internal, from F.2.1)
 *   Outputs: IO.11 Incident Resource Needs (to F.2.3); IO.12 Structured Incident (to F.2.4)
 *   Satisfies: 2.3.1, 2.3.3   UC.1 step: UC.1.4   Mitigates: TR.1 (docs/risks.md)
 * Contract operation (contracts/api-v1.yaml): structureIncident(RegisteredReport) -> 201 StructuringResult | 422 Error
 * Mechanism S.1.2: the Claude agent (incident-structuring-agent/agent.js) when the server has an API key, otherwise the
 * keyword stub. The agent runs before this call (it is asynchronous) and its output is validated here exactly like the stub's.
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Structurer = node ? require('../../incident-structuring-agent/agent.stub.js') : root.IncidentStructurerStub;

  var CAPABILITIES = ['snow-access', 'medical', 'water-rescue'];

  // Schema check on the structurer's (future language-model) output — 2.3.1 / 2.3.3, SPEC.md §3.
  function invalidReason(s) {
    if (!s || typeof s !== 'object') return 'no structured output';
    if (!Array.isArray(s.requiredCapabilities)) return 'requiredCapabilities is not a list';
    var bad = s.requiredCapabilities.filter(function (c) { return CAPABILITIES.indexOf(c) === -1; });
    if (bad.length) return 'unknown capability ' + bad.join(', ');
    if (s.urgency !== 'High' && s.urgency !== 'Standard') return 'urgency is not High or Standard';
    if (!Array.isArray(s.missing)) return 'missing is not a list';
    return null;
  }

  // TR.1 guardrail: Claude output can pass the schema and still be wrong. Two cross-checks against the caller's
  // own words; on a mismatch the incident goes to manual handling (same path as invalid output, 2.3.3).
  // Only applied to agent output: the keyword stub derives zone and urgency from this same text.
  // The cues follow the agent's own definition of High urgency (agent.js STRUCTURE_TOOL). A negated mention
  // ("no one is injured") also matches; that errs on the side of a human looking at the call.
  var HIGH_CUES = /\b(injur\w*|hurt|bleeding|hypotherm\w*|frostbite|very cold|freezing|unconscious|unresponsive|not breathing|child|children|kids?|infant|baby|toddler|elderly|oxygen|dialysis|ventilator|wheelchair)\b/i;

  function inconsistencyReason(s, report) {
    var stated = Structurer.findZone(report.location);
    if (stated && s.zone && s.zone.name !== stated.name) {
      return 'zone ' + s.zone.name + ' does not match the stated location (' + stated.name + ')';
    }
    var cue = (report.description || '').match(HIGH_CUES);
    if (cue && s.urgency !== 'High') {
      return 'urgency ' + s.urgency + ' but the report mentions "' + cue[0] + '"';
    }
    return null;
  }

  function create(ctx) {
    var incidents = {};

    // Contract: structureIncident — IO.10 in; IO.11 and IO.12 out
    // agentOutput (optional): what the Claude agent returned for this report; { invalid: reason } if the call failed.
    function structureIncident(registeredReport, agentOutput) {
      var structured = agentOutput || Structurer.structure({ location: registeredReport.location, description: registeredReport.description });
      var id = ctx.nextId('I');
      var reason = structured && structured.invalid ? structured.invalid : invalidReason(structured);
      var mismatch = !reason && agentOutput ? inconsistencyReason(structured, registeredReport) : null;
      if (mismatch) {
        incidents[id] = { id: id, reportId: registeredReport.reportId, status: 'MANUAL_HANDLING', missing: ['model output inconsistent with report'] };
        ctx.log('UC.1.4', 'RescuTech', 'Incident ' + id + ' needs manual handling: ' + mismatch + '.', ['TR.1', '2.3.3'], 'warn');
        return { status: 422, body: { error: 'Model output inconsistent with report: ' + mismatch, rule: 'TR.1' } };
      }
      if (reason) {
        incidents[id] = { id: id, reportId: registeredReport.reportId, status: 'MANUAL_HANDLING', missing: ['model output invalid'] };
        ctx.log('UC.1.4', 'RescuTech', 'Incident ' + id + ' needs manual handling: model output invalid (' + reason + ').', ['2.3.1', '2.3.3'], 'warn');
        return { status: 422, body: { error: 'Model output invalid: ' + reason, rule: '2.3.1' } };
      }
      var incident = Object.assign({ id: id, reportId: registeredReport.reportId, status: 'STRUCTURED' }, structured);
      incidents[id] = incident;
      var missingNote = incident.missing.length ? ' Missing fields flagged: ' + incident.missing.join(', ') + '.' : '';
      ctx.log('UC.1.4', 'RescuTech', 'Incident ' + id + ' structured from ' + registeredReport.reportId + (agentOutput ? ' [' + (structured.source || 'agent') + '].' : ' [stub].') + missingNote,
              ['SR.3', 'N.3'], incident.missing.length ? 'warn' : 'ok');
      return {
        status: 201,
        body: {
          structuredIncident: {                                   // IO.12
            incidentId: id, reportId: registeredReport.reportId, location: incident.location, zone: incident.zone,
            assistanceNeeded: incident.assistanceNeeded, requiredCapabilities: incident.requiredCapabilities.slice(),
            urgency: incident.urgency, peopleCount: incident.peopleCount, missing: incident.missing.slice()
          },
          incidentResourceNeeds: {                                // IO.11
            incidentId: id, zone: incident.zone, requiredCapabilities: incident.requiredCapabilities.slice()
          }
        }
      };
    }

    return { incidents: incidents, structureIncident: structureIncident };
  }

  var api = { id: 'F.2.2', create: create };
  if (node) module.exports = api;
  else root.RescuTechF22 = api;
})(this);
