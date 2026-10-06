/*
 * Model-to-product trace table. Single source used by the UI "Trace" panel and
 * mirrored in docs/TRACEABILITY.md. IDs match Innoslate project 584
 * (UN.1 needs, SRD.1 requirements, UC.1 Action Diagram).
 */
(function (root) {
  'use strict';
  var TRACE = [
    { need: 'N.1', needText: 'Citizens need to communicate their location and assistance needs without unnecessary reporting effort.',
      sr: 'SR.1', srText: 'RescuTech shall enable a Citizen to submit a distress report containing the incident location and a description of the assistance needed.',
      uc: ['UC.1.1'], code: 'submitDistressReport()', stub: false, lane: 'citizen' },
    { need: 'N.2', needText: 'Citizens need to understand whether their distress report has been registered.',
      sr: 'SR.2', srText: 'RescuTech shall provide the Citizen with confirmation when their distress report has been registered.',
      uc: ['UC.1.2', 'UC.1.3'], code: 'registerDistressReport()', stub: false, lane: 'citizen' },
    { need: 'N.3', needText: 'Emergency Coordinators need to understand the reported location and assistance needs when assessing an incident.',
      sr: 'SR.3', srText: 'RescuTech shall present the reported incident location and assistance needs to the Emergency Coordinator in a structured form.',
      uc: ['UC.1.4'], code: 'structureIncidentInformation() → incident-structuring-agent', stub: true, lane: 'system' },
    { need: 'N.4', needText: 'Emergency Coordinators need to assess the suitability of recommended resources using the available resource information and the recommendation rationale.',
      sr: 'SR.4', srText: 'RescuTech shall provide the Emergency Coordinator with a resource-assignment recommendation based on the reported assistance needs and available resource availability, location, and capability information.',
      uc: ['UC.1.7', 'UC.1.8'], code: 'evaluateResourceSuitability(), presentDispatchRecommendation()', stub: true, lane: 'system' },
    { need: 'N.4', needText: 'Emergency Coordinators need to assess the suitability of recommended resources using the available resource information and the recommendation rationale.',
      sr: 'SR.5', srText: 'RescuTech shall present the rationale supporting each resource-assignment recommendation to the Emergency Coordinator.',
      uc: ['UC.1.8', 'UC.1.9'], code: 'presentDispatchRecommendation() → rec.rationale', stub: false, lane: 'coordinator' },
    { need: 'N.5', needText: 'Emergency Coordinators need to retain final authority over resource dispatch decisions.',
      sr: 'SR.6', srText: 'RescuTech shall issue a dispatch order only after the Emergency Coordinator has approved the corresponding resource assignment.',
      uc: ['UC.1.10', 'UC.1.11'], code: 'approveResourceAssignment(), issueDispatchOrder() guard', stub: false, lane: 'coordinator' },
    { need: 'N.6', needText: 'Emergency Coordinators need to know whether the assigned Rescue Team has acknowledged receipt of a dispatch order.',
      sr: 'SR.7', srText: 'RescuTech shall enable the Emergency Coordinator to view whether the assigned Rescue Team has acknowledged receipt of the corresponding dispatch order.',
      uc: ['UC.1.14', 'UC.1.15'], code: 'presentDispatchStatus(), reviewDispatchStatus()', stub: false, lane: 'coordinator' },
    { need: 'N.7', needText: 'Rescue Teams need to understand the incident location and assigned assistance task communicated in a dispatch order.',
      sr: 'SR.8', srText: 'RescuTech shall provide the assigned Rescue Team with a dispatch order identifying the incident location and assigned assistance task.',
      uc: ['UC.1.11'], code: 'issueDispatchOrder() → order.location, order.task', stub: false, lane: 'team' },
    { need: 'N.6', needText: 'Emergency Coordinators need to know whether the assigned Rescue Team has acknowledged receipt of a dispatch order.',
      sr: 'SR.9', srText: 'RescuTech shall enable the Rescue Team to acknowledge receipt of a dispatch order.',
      uc: ['UC.1.12', 'UC.1.13'], code: 'acknowledgeDispatchOrder(), recordDispatchAcknowledgment()', stub: false, lane: 'team' },
    { need: 'N.8', needText: 'Rescue Teams need to communicate their availability, location, and capabilities without unnecessary reporting effort.',
      sr: 'SR.10', srText: 'RescuTech shall enable the Rescue Team to provide its availability, location, and capability information in response to a resource-status request.',
      uc: ['UC.1.5', 'UC.1.6'], code: 'requestResourceStatus(), provideResourceStatus() → resource-status-source', stub: true, lane: 'team' },
    { need: 'N.9', needText: 'Municipal Emergency Management Agencies need to assess the system’s suitability for intended use using clear information about its capabilities, limitations, and operating responsibilities.',
      sr: 'SR.11', srText: 'The RescuTech prototype delivery shall include documentation describing its intended use, supported capabilities, known limitations, and allocation of operating responsibilities for assessment by the Municipal Emergency Management Agency.',
      uc: [], code: 'README.md (Intended use, Limitations, Responsibilities)', stub: false, lane: 'delivery' },
    { need: 'N.10', needText: 'System Maintainers need to determine whether maintenance changes preserve the expected behavior of the core dispatch workflow.',
      sr: 'SR.12', srText: 'The RescuTech prototype delivery shall include repeatable checks with documented expected outcomes that enable System Maintainers to assess whether a change preserves the core dispatch workflow.',
      uc: [], code: 'tests/acceptance.spec.js + .github/workflows/ci.yml', stub: false, lane: 'delivery' }
  ];
  var API = {
    'SR.1': 'POST /api/distress-reports', 'SR.2': 'POST /api/distress-reports',
    'SR.3': 'POST /api/distress-reports/:id/incident', 'SR.4': 'POST /api/incidents/:id/recommendation',
    'SR.5': 'POST /api/incidents/:id/recommendation', 'SR.6': 'POST /api/recommendations/:id/dispatch-order',
    'SR.7': 'GET /api/dispatch-orders/:id/status', 'SR.8': 'POST /api/recommendations/:id/dispatch-order',
    'SR.9': 'POST /api/dispatch-orders/:id/acknowledgment', 'SR.10': 'PUT /api/incidents/:id/team-status/:teamId',
    'SR.11': '—', 'SR.12': 'npm test'
  };
  TRACE.forEach(function (t) { t.api = API[t.sr]; });
  if (typeof module !== 'undefined' && module.exports) module.exports = TRACE;
  else root.RESCUTECH_TRACE = TRACE;
})(this);
