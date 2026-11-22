/*
 * Checks for the hosted speech-to-text element S.1.1.A2 (speech-intake/transcriber.js, ADR 0006) with a mocked API.
 * No network and no API key are needed. Run: node tests/transcriber.spec.js
 *   S.1  A transcript from the provider is returned by POST /api/transcriptions and registers as a voice report (SR.1, UC.1.2)
 *   S.2  A provider error answers 503 with the typed fallback and is logged (SR.1 text fallback)
 *   S.3  An unreachable provider answers 503 with the typed fallback
 *   S.4  Calls stop at the S.1.1 monthly budget (SyRD 2.5.1, USD 5 apportioned in ADR 0006)
 *   S.5  Without a key the route answers 503 (typed fallback) on both the server and the in-page path
 *   S.6  The key is sent only to the provider and never appears in a response or in the status
 *   S.7  Missing or over-long audio is refused with 422 without calling the provider
 */
'use strict';
var Transcriber = require('../speech-intake/transcriber.js');
var Routes = require('../rescutech-orchestrator/routes.js');

var KEY = 'test-key-not-real';
var AUDIO = Buffer.from('fake webm audio bytes').toString('base64');
var results = [];
function check(id, name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([id, name, true]); },
    function (e) { results.push([id, name, false, e && e.message || e]); });
}
function ok(c, m) { if (!c) throw new Error(m); }
function mockFetch(handler) {
  var calls = [];
  var f = function (url, o) {
    calls.push({ url: url, headers: o.headers });
    return Promise.resolve(handler(url, o)).then(function (r) {
      if (r instanceof Error) throw r;
      return { status: r.status || 200, json: function () { return Promise.resolve(r.body); } };
    });
  };
  f.calls = calls; return f;
}
function api(fetchImpl, extra) {
  var t = Transcriber.createTranscriber(Object.assign({ apiKey: KEY, fetch: fetchImpl, env: {} }, extra || {}));
  return { t: t, api: Routes.createApi({ transcriber: t }) };
}
var SAID = 'I am at Fall Creek, Linn Street. Our car is stuck in the snow and my friend is shivering.';

Promise.resolve()
  .then(function () { return check('S.1', 'Provider transcript is returned and registers as a voice report', function () {
    var x = api(mockFetch(function () { return { body: { text: SAID } }; }));
    return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, mimeType: 'audio/webm', seconds: 8 }).then(function (r) {
      ok(r.status === 200 && r.body.transcript === SAID, 'got ' + r.status + ' ' + JSON.stringify(r.body));
      var reg = x.api.handle('POST', '/api/distress-reports', { location: 'Fall Creek, Linn Street', transcript: r.body.transcript, channel: 'voice' });
      ok(reg.status === 201, 'registration ' + reg.status);
    });
  }); })
  .then(function () { return check('S.2', 'Provider error gives 503 with typed fallback and a log entry', function () {
    var x = api(mockFetch(function () { return { status: 500, body: { error: { message: 'server error' } } }; }));
    return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 8 }).then(function (r) {
      ok(r.status === 503 && r.body.fallback === 'typed', 'got ' + r.status);
      ok(x.api.workflow().state.log.some(function (e) { return e.uc === 'UC.1.2' && /type the report/.test(e.text); }), 'fallback not logged');
    });
  }); })
  .then(function () { return check('S.3', 'Unreachable provider gives 503 with typed fallback', function () {
    var x = api(mockFetch(function () { return new Error('ECONNREFUSED'); }));
    return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 8 }).then(function (r) {
      ok(r.status === 503 && r.body.fallback === 'typed', 'got ' + r.status);
    });
  }); })
  .then(function () { return check('S.4', 'Calls stop at the S.1.1 monthly budget', function () {
    var f = mockFetch(function () { return { body: { text: SAID } }; });
    var x = api(f, { budgetUsd: 0.001 });   // 0.0045 $/min: one 10-s call costs 0.00075 $
    return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 10 }).then(function (r1) {
      ok(r1.status === 200, 'first call ' + r1.status);
      return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 10 });
    }).then(function (r2) {
      ok(r2.status === 503 && /budget/.test(r2.body.error), 'expected budget refusal, got ' + JSON.stringify(r2.body));
      ok(f.calls.length === 1, 'provider called ' + f.calls.length + ' times');
    });
  }); })
  .then(function () { return check('S.5', 'Without a key the route answers 503 on both paths', function () {
    var t = Transcriber.createTranscriber({ env: {}, fetch: mockFetch(function () { return { body: { text: 'x' } }; }) });
    ok(!t.enabled(), 'transcriber should be disabled without a key');
    var a = Routes.createApi({ transcriber: t });
    var inPage = a.handle('POST', '/api/transcriptions', { audio: AUDIO, seconds: 5 });
    ok(inPage.status === 503 && inPage.body.fallback === 'typed', 'in-page ' + inPage.status);
    return a.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 5 }).then(function (r) {
      ok(r.status === 503 && r.body.fallback === 'typed', 'server path ' + r.status);
      ok(a.handle('GET', '/api/transcriber').body.enabled === false, 'status should say disabled');
    });
  }); })
  .then(function () { return check('S.6', 'Key goes only to the provider and never into a response', function () {
    var f = mockFetch(function () { return { body: { text: SAID } }; });
    var x = api(f);
    return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: 6 }).then(function (r) {
      ok(f.calls.length === 1 && /^https:\/\/api\.openai\.com\//.test(f.calls[0].url), 'unexpected destination');
      ok(f.calls[0].headers.Authorization === 'Bearer ' + KEY, 'key not sent to provider');
      var exposed = JSON.stringify(r.body) + JSON.stringify(x.api.handle('GET', '/api/transcriber').body) + JSON.stringify(x.api.workflow().state.log);
      ok(exposed.indexOf(KEY) === -1, 'key appears in a response, the status or the log');
    });
  }); })
  .then(function () { return check('S.7', 'Missing or over-long audio is refused without calling the provider', function () {
    var f = mockFetch(function () { return { body: { text: SAID } }; });
    var x = api(f);
    return x.api.handleAsync('POST', '/api/transcriptions', { seconds: 5 }).then(function (r1) {
      ok(r1.status === 422, 'no audio: ' + r1.status);
      return x.api.handleAsync('POST', '/api/transcriptions', { audio: AUDIO, seconds: Transcriber.MAX_SECONDS + 1 });
    }).then(function (r2) {
      ok(r2.status === 422, 'too long: ' + r2.status);
      ok(f.calls.length === 0, 'provider was called');
    });
  }); })
  .then(function () {
    var failed = 0;
    results.forEach(function (r) { if (!r[2]) failed++; console.log((r[2] ? 'PASS  ' : 'FAIL  ') + r[0] + ' ' + r[1] + (r[2] ? '' : ' — ' + r[3])); });
    console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  });
