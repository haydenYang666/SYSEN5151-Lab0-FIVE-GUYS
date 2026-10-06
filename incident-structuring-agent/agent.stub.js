/*
 * STUB — Incident structuring (stands in for the language-model agent).
 *
 * Model link : UC.1.4 Structure Incident Information (performed by S.1 RescuTech)
 * Requirement: SR.3 — present location and assistance needs in a structured form;
 *              undetermined fields are marked as missing.
 * Why a stub : the language-model call and its response contract are scheduled for a
 *              later increment (Lab Manual Ch. 8). This keyword version returns the same
 *              output schema so the end-to-end path can run now.
 */
(function (root) {
  'use strict';

  // Simulated zones for the Tompkins County snowstorm scenario (km grid, not real GIS).
  var ZONES = {
    'downtown': { name: 'Downtown Ithaca', x: 0, y: 0 },
    'collegetown': { name: 'Collegetown', x: 1.5, y: -0.8 },
    'fall creek': { name: 'Fall Creek', x: 0.6, y: 1.4 },
    'route 13': { name: 'Route 13 corridor', x: -3.2, y: 2.6 },
    'lansing': { name: 'Lansing', x: 1.0, y: 11.5 },
    'dryden': { name: 'Dryden', x: 14.0, y: 1.5 }
  };

  var NEED_RULES = [
    { pattern: /(trapped|stuck|snowed in|blocked|cannot leave|can't leave|stranded)/i,
      capability: 'snow-access', label: 'Access through snow and evacuation' },
    { pattern: /(hypotherm|injur|bleed|unconscious|breath|chest pain|medical|frostbite)/i,
      capability: 'medical', label: 'Medical care on scene' },
    { pattern: /(flood|water rising|water entering)/i,
      capability: 'water-rescue', label: 'Water rescue' }
  ];

  var URGENT = /(hypotherm|unconscious|not breathing|chest pain|bleeding|child|infant|elderly|oxygen)/i;

  function findZone(text) {
    var t = (text || '').toLowerCase();
    for (var key in ZONES) {
      if (t.indexOf(key) !== -1) return ZONES[key];
    }
    return null;
  }

  function countPeople(text) {
    var words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    var m = (text || '').toLowerCase().match(/\b(\d+|one|two|three|four|five|six)\s+(people|persons|adults|residents|children|kids|of us)\b/);
    if (!m) return null;
    return words[m[1]] || parseInt(m[1], 10);
  }

  /**
   * structure(report) -> structured incident record (same schema the LLM agent will return)
   * { location, zone, assistanceNeeded, requiredCapabilities[], urgency, peopleCount, missing[] }
   */
  function structure(report) {
    var missing = [];
    var zone = findZone(report.location) || findZone(report.description);
    if (!report.location || !report.location.trim()) missing.push('location');
    else if (!zone) missing.push('zone (location not matched to a known area)');

    var caps = [];
    var labels = [];
    NEED_RULES.forEach(function (r) {
      if (r.pattern.test(report.description || '')) { caps.push(r.capability); labels.push(r.label); }
    });
    if (caps.length === 0) missing.push('assistance type');

    var people = countPeople(report.description);
    if (people === null) missing.push('number of people');

    return {
      location: (report.location || '').trim() || null,
      zone: zone,
      assistanceNeeded: labels.length ? labels.join('; ') : null,
      requiredCapabilities: caps,
      urgency: URGENT.test(report.description || '') ? 'High' : 'Standard',
      peopleCount: people,
      missing: missing,
      source: 'stub: keyword rules (language-model agent pending)'
    };
  }

  var api = { structure: structure, ZONES: ZONES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IncidentStructurerStub = api;
})(this);
