/*
 * Speech-to-text trade study (D.1), prototype spike: test calls and scoring.
 * Used by frontend/stt-spike.html (browser) and scripts/stt-spike/hosted.js (Node).
 *
 * C2 Key-field accuracy: a transcript counts as correct when the keyword structurer used by F.2.2
 * extracts the same zone and the same capabilities from it as from the original script.
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Stub = node ? require('../../incident-structuring-agent/agent.stub.js') : root.IncidentStructurerStub;
  var CALLS = node ? require('../../tests/fixtures/distress-calls.json') : null;

  // What the caller reads aloud: location first, then the description, as on a real call.
  function scriptOf(call) { return 'I am at ' + call.location + '. ' + call.transcript; }

  function keyFields(text) {
    var s = Stub.structure({ location: text, description: text });
    return { zone: s.zone ? s.zone.name : null, caps: s.requiredCapabilities.slice().sort().join(',') };
  }

  function words(t) { return (t || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean); }

  // Word error rate (for information; C2 is the key-field check).
  function wer(ref, hyp) {
    var r = words(ref), h = words(hyp), d = [];
    for (var i = 0; i <= r.length; i++) { d[i] = [i]; }
    for (var j = 0; j <= h.length; j++) { d[0][j] = j; }
    for (i = 1; i <= r.length; i++) for (j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    return r.length ? d[r.length][h.length] / r.length : 0;
  }

  function score(call, transcript) {
    var want = keyFields(scriptOf(call)), got = keyFields(transcript);
    return { zoneOk: want.zone === got.zone, capsOk: want.caps === got.caps,
             correct: want.zone === got.zone && want.caps === got.caps,
             wer: Math.round(wer(scriptOf(call), transcript) * 1000) / 1000, expected: want, got: got };
  }

  function median(xs) {
    var a = xs.filter(function (x) { return typeof x === 'number'; }).sort(function (p, q) { return p - q; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  var api = { scriptOf: scriptOf, score: score, wer: wer, median: median, CALLS: CALLS };
  if (node) module.exports = api;
  else root.SttSpike = api;
})(this);
