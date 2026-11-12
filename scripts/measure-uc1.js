#!/usr/bin/env node
/*
 * Measured behavior for the Modeling and Simulation assignment (Lab Manual 10.4, Project Task 5).
 *
 * Runs the revised UC.1 scenario (phone + AI intake, pushed team status) end to end against the real
 * server N times (default 30) and records the time spent at every system participant boundary of the
 * UC.1 sequence diagram: S.1.1 Report Intake, S.1.2 Incident Structuring (incl. the Claude call),
 * S.1.3 Resource Status, S.1.4 Recommendation (incl. the Claude briefing) and S.1.5 Dispatch Management.
 * Human actions (the caller talking, the Coordinator reading, the team tapping "acknowledge") are driven
 * instantly by this script, so they are NOT measured; the report keeps their simulated durations.
 *
 *   node scripts/measure-uc1.js [runs]              # keyword stub if ANTHROPIC_API_KEY is not set
 *   ANTHROPIC_API_KEY=... node scripts/measure-uc1.js 30
 *
 * Writes measurements/uc1-runs.csv (one row per run and stage) and measurements/uc1-summary.md
 * (measured vs simulated table). Interpreting the divergence is left to the team (Lab Manual 10.4.3).
 */
'use strict';
var path = require('path');
var fs = require('fs');
var cp = require('child_process');

var RUNS = Number(process.argv[2]) || 30;
var PORT = Number(process.env.MEASURE_PORT) || 3099;
var BASE = 'http://127.0.0.1:' + PORT;
var ROOT = path.join(__dirname, '..');
var CALLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/distress-calls.json'), 'utf8'));

// Simulated durations in the Innoslate model (UC.1, revised 2026-11-11), seconds
var SIM = [
  { key: 'UC.1.2', label: 'UC.1.2 Answer and Transcribe Call (S.1.1)', dist: 'Normal(1, 0.3)', mean: 1, pick: { kind: 'route', uc: 'UC.1.2' } },
  { key: 'UC.1.4', label: 'UC.1.4 Structure Incident Information (S.1.2), total', dist: 'Normal(3, 1)', mean: 3, pick: { kind: 'route', uc: 'UC.1.4' } },
  { key: 'UC.1.4a', label: '  of which: Claude structuring call', dist: '(part of UC.1.4)', mean: null, pick: { kind: 'agent', uc: 'UC.1.4' } },
  { key: 'UC.1.5', label: 'UC.1.5 Retrieve Latest Team Status (S.1.3)', dist: 'Normal(0.3, 0.05)', mean: 0.3, pick: { kind: 'route', uc: 'UC.1.5' } },
  { key: 'UC.1.7', label: 'UC.1.7 Update Resource Availability (S.1.3)', dist: 'Normal(0.3, 0.05)', mean: 0.3, pick: { kind: 'contract', uc: 'UC.1.7' } },
  { key: 'UC.1.8', label: 'UC.1.8 Evaluate Resource Suitability (S.1.4)', dist: 'Normal(0.5, 0.1)', mean: 0.5, pick: { kind: 'contract', uc: 'UC.1.8' } },
  { key: 'UC.1.9', label: 'UC.1.9 Present Dispatch Recommendation: Claude briefing (S.1.4)', dist: 'Normal(2.5, 0.8)', mean: 2.5, pick: { kind: 'agent', uc: 'UC.1.9' } },
  { key: 'UC.1.12', label: 'UC.1.12 Issue Dispatch Order (S.1.5)', dist: 'Normal(0.5, 0.1)', mean: 0.5, pick: { kind: 'route', uc: 'UC.1.12' } },
  { key: 'UC.1.14', label: 'UC.1.14 Record Dispatch Acknowledgment (S.1.5)', dist: 'Normal(0.3, 0.05)', mean: 0.3, pick: { kind: 'route', uc: 'UC.1.14' } },
  { key: 'UC.1.15', label: 'UC.1.15 Present Dispatch Status (S.1.5)', dist: 'Normal(0.3, 0.05)', mean: 0.3, pick: { kind: 'route', uc: 'UC.1.15' } }
];

function req(method, p, body) {
  var t0 = process.hrtime.bigint();
  return fetch(BASE + p, { method: method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j, clientMs: Number(process.hrtime.bigint() - t0) / 1e6 }; }); });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function startServer() {
  // A local measurement makes ~60 Claude calls in under a minute, so lift the public-deployment rate limit here.
  var env = Object.assign({}, process.env, { PORT: String(PORT), RESCUTECH_MAX_CALLS_PER_MIN: process.env.RESCUTECH_MAX_CALLS_PER_MIN || '1000' });
  var child = cp.spawn(process.execPath, [path.join(ROOT, 'rescutech-orchestrator/server.js')], { env: env, stdio: ['ignore', 'pipe', 'inherit'] });
  var banner = '';
  child.stdout.on('data', function (d) { banner += d; });
  function wait(n) {
    return fetch(BASE + '/api/health').then(function (r) { return r.ok; }).catch(function () { return false; })
      .then(function (ok) { if (ok) return { child: child, banner: function () { return banner.trim(); } }; if (n <= 0) throw new Error('server did not start'); return sleep(200).then(function () { return wait(n - 1); }); });
  }
  return wait(50);
}

async function oneRun(i) {
  var call = CALLS[i % CALLS.length];
  await req('POST', '/api/reset');
  await req('POST', '/api/timings/reset');
  var client = {};
  var r = await req('POST', '/api/distress-reports', { location: call.location, transcript: call.transcript, channel: 'voice' }); client['UC.1.2'] = r.clientMs;
  if (r.status !== 201) throw new Error('intake failed: ' + JSON.stringify(r.body));
  var inc = await req('POST', '/api/distress-reports/' + r.body.report.id + '/incident'); client['UC.1.4'] = inc.clientMs;
  if (inc.status !== 201) return { run: i + 1, outcome: 'manual handling: ' + (inc.body.error || inc.status), spans: (await req('GET', '/api/timings')).body, client: client };
  var st = await req('POST', '/api/incidents/' + inc.body.id + '/status-requests'); client['UC.1.5'] = st.clientMs;
  var rec = await req('POST', '/api/incidents/' + inc.body.id + '/recommendation'); client['UC.1.7-UC.1.9'] = rec.clientMs;
  var outcome = 'dispatched';
  if (rec.body.teamId) {
    await req('POST', '/api/recommendations/' + rec.body.id + '/approval', { by: 'measurement script' });
    var o = await req('POST', '/api/recommendations/' + rec.body.id + '/dispatch-order'); client['UC.1.12'] = o.clientMs;
    var a = await req('POST', '/api/dispatch-orders/' + o.body.id + '/acknowledgment', { teamId: o.body.teamId }); client['UC.1.14'] = a.clientMs;
    var s = await req('GET', '/api/dispatch-orders/' + o.body.id + '/status'); client['UC.1.15'] = s.clientMs;
  } else outcome = 'no suitable team';
  return { run: i + 1, outcome: outcome, spans: (await req('GET', '/api/timings')).body, client: client, briefing: !!rec.body.briefing };
}

function stats(xs) {
  if (!xs.length) return null;
  var n = xs.length, m = xs.reduce(function (a, b) { return a + b; }, 0) / n;
  var sd = n > 1 ? Math.sqrt(xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (n - 1)) : 0;
  return { n: n, mean: m, sd: sd, min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
}
function f(x, d) { return x === null || x === undefined ? '–' : x.toFixed(d === undefined ? 3 : d); }

(async function main() {
  var srv = await startServer();
  var agent = (await req('GET', '/api/agent')).body;
  console.log(srv.banner());
  console.log('Running UC.1 ' + RUNS + ' times (' + (agent.enabled ? 'Claude agent ' + agent.model : 'keyword stub, no API key') + ') ...');
  if (agent.enabled && !agent.keyLooksValid) console.log('WARNING: ANTHROPIC_API_KEY does not look like an API key (expected it to start with sk-ant-api). Check for a doubled "sk-ant-" prefix.');
  var results = [], agentAfter = null;
  try {
    for (var i = 0; i < RUNS; i++) {
      var res = await oneRun(i);
      results.push(res);
      process.stdout.write('.');
    }
    agentAfter = (await req('GET', '/api/agent')).body;
  } finally { srv.child.kill(); }
  console.log('');

  var outDir = path.join(ROOT, 'measurements');
  fs.mkdirSync(outDir, { recursive: true });
  var rows = ['run,outcome,kind,uc,participant,name,server_ms,client_ms'];
  results.forEach(function (r) {
    r.spans.forEach(function (s) {
      var c = s.kind === 'route' && r.client[s.uc] !== undefined ? r.client[s.uc].toFixed(3) : '';
      rows.push([r.run, '"' + r.outcome + '"', s.kind, s.uc, '"' + s.participant + '"', '"' + s.name + '"', s.ms.toFixed(3), c].join(','));
    });
  });
  fs.writeFileSync(path.join(outDir, 'uc1-runs.csv'), rows.join('\n') + '\n');

  var lines = [];
  lines.push('# UC.1 measured vs simulated (Modeling and Simulation, Lab Manual 10.4)');
  lines.push('');
  lines.push('- Date: ' + new Date().toISOString());
  lines.push('- Runs: ' + RUNS + ' (outcomes: ' + Object.entries(results.reduce(function (m, r) { m[r.outcome] = (m[r.outcome] || 0) + 1; return m; }, {})).map(function (e) { return e[0] + ' ' + e[1]; }).join(', ') + ')');
  lines.push('- Structuring and briefing: ' + (agent.enabled ? 'Claude agent, model ' + agent.model : 'keyword stub (no ANTHROPIC_API_KEY set), so the two model-inference stages are not represented'));
  if (agentAfter && agentAfter.enabled) {
    lines.push('- Claude usage for these runs: ' + agentAfter.calls + ' calls, ' + agentAfter.failures + ' failures, about $' + agentAfter.spentUsd);
    if (agentAfter.failures) {
      lines.push('- **WARNING: ' + agentAfter.failures + ' Claude calls failed (' + agentAfter.lastError + '). Those runs fell back to the keyword stub, so the model-inference stages below are NOT real Claude timings. Fix the key or credit and run again.**');
      console.log('WARNING: ' + agentAfter.failures + ' of ' + agentAfter.calls + ' Claude calls failed: ' + agentAfter.lastError);
    }
  }
  lines.push('- Input: ' + CALLS.length + ' scripted call transcripts (tests/fixtures/distress-calls.json), voice channel, cycled');
  lines.push('- Server time = entry to exit inside the server at the participant boundary; client time = HTTP round trip from this script (same machine).');
  lines.push('- Human actions (UC.1.1, UC.1.3, UC.1.6, UC.1.10, UC.1.11, UC.1.13, UC.1.16) are driven instantly by the script and are not measured.');
  lines.push('');
  lines.push('| Stage | Simulated (s) | Sim. mean (ms) | n | Measured mean (ms) | SD (ms) | Min (ms) | Max (ms) | Client round trip mean (ms) |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  SIM.forEach(function (s) {
    var xs = [], cs = [];
    results.forEach(function (r) {
      var hits = r.spans.filter(function (sp) { return sp.kind === s.pick.kind && sp.uc === s.pick.uc; });
      hits.forEach(function (h) { xs.push(h.ms); });
      if (s.pick.kind === 'route' && r.client[s.pick.uc] !== undefined) cs.push(r.client[s.pick.uc]);
    });
    var m = stats(xs), c = stats(cs);
    lines.push('| ' + s.label + ' | ' + s.dist + ' | ' + (s.mean === null ? '–' : f(s.mean * 1000, 0)) + ' | ' + (m ? m.n : 0) + ' | ' + (m ? f(m.mean, 2) : '–') + ' | ' + (m ? f(m.sd, 2) : '–') + ' | ' +
               (m ? f(m.min, 2) : '–') + ' | ' + (m ? f(m.max, 2) : '–') + ' | ' + (c ? f(c.mean, 2) : '–') + ' |');
  });
  lines.push('');
  lines.push('Divergence explanation and the decision (update simulation parameters, architecture, or neither): to be written by the team after checking the data.');
  fs.writeFileSync(path.join(outDir, 'uc1-summary.md'), lines.join('\n') + '\n');
  console.log('Wrote measurements/uc1-runs.csv and measurements/uc1-summary.md');
})().catch(function (e) { console.error(e); process.exit(1); });
