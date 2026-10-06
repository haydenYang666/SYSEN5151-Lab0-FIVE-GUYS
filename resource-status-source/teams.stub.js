/*
 * STUB — Rescue Team status source (simulated teams).
 *
 * Model link : X.3 Rescue Team, Interface 4; UC.1.6 Provide Resource Status
 * Requirement: SR.10 — the Rescue Team provides availability, location, and capability
 *              in response to a resource-status request.
 * Why a stub : real field units are outside the system boundary. These simulated teams
 *              answer the status request so the end-to-end path can run. All names are
 *              fictional; no real agency is represented.
 */
(function (root) {
  'use strict';

  function initialTeams() {
    return [
      { id: 'RT-A', name: 'Rescue Team Alpha', zoneKey: 'downtown', available: true, capabilities: ['snow-access'] },
      { id: 'RT-B', name: 'Rescue Team Bravo', zoneKey: 'collegetown', available: true, capabilities: ['medical'] },
      { id: 'RT-C', name: 'Rescue Team Charlie', zoneKey: 'route 13', available: false, capabilities: ['snow-access', 'medical'] },
      { id: 'RT-D', name: 'Rescue Team Delta', zoneKey: 'lansing', available: true, capabilities: ['snow-access', 'medical'] },
      { id: 'RT-E', name: 'Rescue Team Echo', zoneKey: 'dryden', available: true, capabilities: ['water-rescue', 'medical'] }
    ];
  }

  var api = { initialTeams: initialTeams };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResourceRegistryStub = api;
})(this);
