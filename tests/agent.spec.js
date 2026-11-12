/*
 * Checks for the Claude rescue agent (incident-structuring-agent/agent.js) with a mocked Anthropic API.
 * No network and no API key are needed. Run: node tests/agent.spec.js
 *   A.1  Valid tool output becomes a STRUCTURED incident tagged with the Claude source (SR.3)
 *   A.2  Output outside the schema is withheld and the incident goes to manual handling (SyRD 2.3.1, 2.3.3)
 *   A.3  An unreachable agent falls back to the keyword stub instead of blocking intake
 *   A.4  Calls stop when the monthly budget is used up (SyRD 2.5.1)
 *   A.5  A briefing that does not name the recommended team is withheld; the team choice never changes
 *   A.6  Instrumentation records the Claude calls at the S.1.2 and S.1.4 boundaries (Lab Manual 10.4)
 *   A.7  Dispatch (F.2.5) never calls the agent (CRD 2.3.1)
 */
'use strict';
var Agent = require('../incident-structuring-agent/agent.js');
var Routes = require('../rescutech-orchestrator/routes.js');

var results = [];
function check(id, name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([id, name, true]); },
    function (e) { results.push([id, name, false, e && e.message || e]); });
}
function ok(c, m) { if (!c) throw new Error(m); }

function mockFetch(handler) {
  var calls = [];
  var f = function (url, o) {
    var body = JSON.parse(o.body);
    calls.push(body);
    return Promise.resolve(handler(body)).then(function (out) {
      if (out instanceof Error) throw out;
      return { status: out.status || 200, json: function () { return Promise.resolve(out.body); } };
    });
  };
  f.calls = calls;
  return f;
}
function toolReply(name, input) {
  return { body: { content: [{ type: 'tool_use', name: name, input: input }], usage: { input_tokens: 800, output_tokens: 120 } } };
}
var GOOD = { location: 'Fall Creek, Linn Street', zoneKey: 'fall creek', assistanceNeeded: 'Car stuck in snow; one person very cold',
             requiredCapabilities: ['snow-access', 'medical'], urgency: 'High', peopleCount: 2, missing: [] };
function happy(body) {
  if (body.tools[0].name === 'record_incident') return toolReply('record_incident', GOOD);
  var facts = JSON.parse(body.messages[0].content);
  return toolReply('write_briefing', { briefing: facts.recommendedTeam + ' is available and closest. The coordinator decides.' });
}
function api(fetchImpl, extra) {
  var agent = Agent.createAgent(Object.assign({ apiKey: 'test-key', fetch: fetchImpl, env: {} }, extra || {}));
  return { agent: agent, api: Routes.createApi({ agent: agent }) };
}
function runToRecommendation(a) {
  var r = a.handle('POST', '/api/distress-reports', { location: GOOD.location, transcript: 'Our car is stuck, two of us, my friend is shivering', channel: 'voice' }).body;
  return a.handleAsync('POST', '/api/distress-reports/' + r.report.id + '/incident').then(function (inc) {
    if (inc.status !== 201) return { inc: inc };
    a.handle('POST', '/api/incidents/' + inc.body.id + '/status-requests');
    return a.handleAsync('POST', '/api/incidents/' + inc.body.id + '/recommendation').then(function (rec) { return { inc: inc, rec: rec }; });
  });
}

Promise.resolve()
  .then(function () { return check('A.1', 'Valid tool output becomes a structured incident from Claude', function () {
    var x = api(mockFetch(happy));
    return runToRecommendation(x.api).then(function (o) {
      ok(o.inc.status === 201, 'status ' + o.inc.status);
      ok(/Claude agent/.test(o.inc.body.source), 'source ' + o.inc.body.source);
      ok(o.inc.body.requiredCapabilities.join() === 'snow-access,medical', 'capabilities');
    });
  }); })
  .then(function () { return check('A.2', 'Invalid output is withheld and goes to manual handling', function () {
    var bad = mockFetch(function () { return toolReply('record_incident', Object.assign({}, GOOD, { requiredCapabilities: ['helicopter'] })); });
    var x = api(bad);
    return runToRecommendation(x.api).then(function (o) {
      ok(o.inc.status === 422, 'expected 422, got ' + o.inc.status);
      var inc = x.api.workflow().state.incidents['I-0001'];
      ok(inc && inc.status === 'MANUAL_HANDLING', 'incident not in manual handling');
    });
  }); })
  .then(function () { return check('A.3', 'Unreachable agent falls back to keyword rules', function () {
    var x = api(mockFetch(function () { return new Error('ECONNREFUSED'); }));
    return runToRecommendation(x.api).then(function (o) {
      ok(o.inc.status === 201, 'status ' + o.inc.status);
      ok(!/Claude/.test(o.inc.body.source || ''), 'should be stub output');
      ok(x.api.workflow().state.log.some(function (e) { return /unavailable/.test(e.text); }), 'fallback not logged');
    });
  }); })
  .then(function () { return check('A.4', 'Calls stop at the monthly budget', function () {
    var f = mockFetch(happy);
    var agent = Agent.createAgent({ apiKey: 'k', fetch: f, env: {}, budgetUsd: 0.000001 });
    return agent.structure({ location: 'x', description: 'y' }).then(function () {
      return agent.structure({ location: 'x', description: 'y' });
    }).then(function (out) {
      ok(out.unavailable && /budget/.test(out.unavailable), 'expected budget refusal, got ' + JSON.stringify(out));
      ok(f.calls.length === 1, 'API called ' + f.calls.length + ' times');
    });
  }); })
  .then(function () { return check('A.5', 'Briefing must name the recommended team; the choice never changes', function () {
    var f = mockFetch(function (body) {
      if (body.tools[0].name === 'record_incident') return toolReply('record_incident', GOOD);
      return toolReply('write_briefing', { briefing: 'Send Rescue Team Zulu instead.' });
    });
    var x = api(f);
    return runToRecommendation(x.api).then(function (o) {
      ok(o.rec.status === 201 && o.rec.body.teamId, 'no recommendation');
      ok(!o.rec.body.briefing, 'off-script briefing was shown');
      ok(o.rec.body.teamName !== 'Rescue Team Zulu', 'team changed');
    });
  }); })
  .then(function () { return check('A.6', 'Instrumentation records the Claude calls at S.1.2 and S.1.4', function () {
    var slow = mockFetch(function (b) { return new Promise(function (r) { setTimeout(function () { r(happy(b)); }, 20); }); });
    var x = api(slow);
    return runToRecommendation(x.api).then(function () {
      var spans = x.api.handle('GET', '/api/timings').body;
      var s = spans.filter(function (p) { return p.kind === 'agent' && p.uc === 'UC.1.4'; })[0];
      var b = spans.filter(function (p) { return p.kind === 'agent' && p.uc === 'UC.1.9'; })[0];
      ok(s && s.ms >= 15, 'structuring span missing or too short');
      ok(b && b.ms >= 15, 'briefing span missing or too short');
      ok(spans.some(function (p) { return p.kind === 'route' && p.uc === 'UC.1.2'; }), 'intake span missing');
    });
  }); })
  .then(function () { return check('A.7', 'Dispatch modules never reference the agent', function () {
    var fs = require('fs'), path = require('path');
    var dir = path.join(__dirname, '../rescutech-orchestrator/functions');
    fs.readdirSync(dir).filter(function (n) { return /^f2-5/.test(n); }).forEach(function (n) {
      ok(!/incident-structuring-agent|createAgent|anthropic/i.test(fs.readFileSync(path.join(dir, n), 'utf8')), n + ' references the agent');
    });
  }); })
  .then(function () {
    var failed = 0;
    results.forEach(function (r) { if (!r[2]) failed++; console.log((r[2] ? 'PASS  ' : 'FAIL  ') + r[0] + ' ' + r[1] + (r[2] ? '' : ' — ' + r[3])); });
    console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  });
