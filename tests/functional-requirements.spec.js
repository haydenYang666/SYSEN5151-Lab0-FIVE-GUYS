/*
 * Functional requirement checks for the decomposed function F.2.5 Manage Dispatch Orders (PMC2).
 * One check per requirement, named by its ID: the S.1.5 Component Requirements Document (CRD) in Innoslate
 * project 584, plus the parent system requirements SR.6–SR.9. Each check names the second-level function and
 * module that satisfies it, so this file is the "test name" column of docs/traceability.md.
 *
 *   Node:    node tests/functional-requirements.spec.js            (all checks)
 *            node tests/functional-requirements.spec.js "CRD 1.4.1" (one check; used by the pytest harness)
 *   Python:  pytest tests/test_functional_requirements.py           (same checks, one pytest test per requirement)
 *   CI:      .github/workflows/tests.yml runs both on every push.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Routes = require('../rescutech-orchestrator/routes.js');

var ROOT = path.join(__dirname, '..');
var SAMPLE = { location: '412 Fall Creek Dr, Fall Creek, Ithaca',
               description: 'Our car is stuck on a snow-blocked road. Two adults inside, one is shivering badly and may have hypothermia.' };

function ok(cond, msg) { if (!cond) throw new Error(msg); }

// Drives UC.1 through the public REST routes up to the recommendation (IO.14 has reached F.2.5).
function toRecommendation(api, report) {
  var r = api.handle('POST', '/api/distress-reports', report || SAMPLE).body;
  var inc = api.handle('POST', '/api/distress-reports/' + r.report.id + '/incident').body;
  api.handle('POST', '/api/incidents/' + inc.id + '/status-requests');
  api.handle('GET', '/api/teams').body.forEach(function (t) {
    api.handle('PUT', '/api/incidents/' + inc.id + '/team-status/' + t.id, { available: t.available, zoneKey: t.zoneKey, capabilities: t.capabilities });
  });
  return api.handle('POST', '/api/incidents/' + inc.id + '/recommendation').body;
}
function approve(api, rec) { return api.handle('POST', '/api/recommendations/' + rec.id + '/approval', { by: 'tester' }); }
function dispatch(api, rec) { return api.handle('POST', '/api/recommendations/' + rec.id + '/dispatch-order'); }
function ack(api, order, teamId) { return api.handle('POST', '/api/dispatch-orders/' + order.id + '/acknowledgment', { teamId: teamId }); }
function status(api, order) { return api.handle('GET', '/api/dispatch-orders/' + order.id + '/status').body; }
function recording() { var calls = []; return { calls: calls, api: Routes.createApi({ onContractCall: function (c) { calls.push(c); } }) }; }

var CHECKS = [
  // ---- F.2.5.1 Compile Authorized Dispatch Order · S.1.5.1 Dispatch Authorization Module
  { id: 'CRD 1.1.1', fn: 'F.2.5.1', name: 'Accepts the Proposed Assignment (IO.14) from the Recommendation Subsystem', run: function () {
    var t = recording(); toRecommendation(t.api);
    var held = t.calls.filter(function (c) { return c.operationId === 'acceptProposedAssignment'; })[0];
    ok(held && held.response.status === 202 && held.response.body.held === true, 'IO.14 was not accepted and held');
  } },
  { id: 'CRD 1.1.2', fn: 'F.2.5.1', name: 'Accepts the Dispatch Approval (IO.6) from the Emergency Coordinator', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api), r = approve(api, rec);
    ok(r.status === 201 && r.body.teamId === rec.teamId, 'approval not recorded for the recommended team');
  } },
  { id: 'CRD 1.4.1', fn: 'F.2.5.1', name: 'Compiles the authorized dispatch order (IO.15) only from a matching approval', run: function () {
    var t = recording(), rec = toRecommendation(t.api);
    ok(dispatch(t.api, rec).status === 409, 'order compiled without approval');
    approve(t.api, rec); dispatch(t.api, rec);
    var c = t.calls.filter(function (x) { return x.operationId === 'compileAuthorizedDispatchOrder' && x.response.status === 201; })[0];
    ok(c && c.response.body.teamId === rec.teamId && c.response.body.approvalId, 'IO.15 missing or not bound to the approval');
  } },
  { id: 'CRD 2.1.1', fn: 'F.2.5.1', name: 'Matches each dispatch order to its approved resource assignment', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api), ap = approve(api, rec).body, o = dispatch(api, rec).body;
    ok(o.approvalId === ap.id && o.teamId === ap.teamId && o.incidentId === ap.incidentId, 'order does not match its approval');
  } },
  { id: 'SR.6', fn: 'F.2.5.1', name: 'No dispatch order is issued before the coordinator approves the assignment', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api), r = dispatch(api, rec);
    ok(r.status === 409 && r.body.rule === 'SR.6', 'unapproved order was not blocked by SR.6');
  } },
  // ---- F.2.5.2 Issue Dispatch Order · S.1.5.2 Order Transmission Module
  { id: 'CRD 1.2.1', fn: 'F.2.5.2', name: 'Provides the Dispatch Order (IO.7) to the assigned Rescue Team', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body;
    ok(o.teamId === rec.teamId && o.location && o.task, 'order lacks the assigned team, location or task');
  } },
  { id: 'CRD 1.4.2', fn: 'F.2.5.2', name: 'Issues exactly one dispatch order per authorization', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    ok(dispatch(api, rec).status === 201, 'first order not issued');
    var again = dispatch(api, rec);
    ok(again.status === 409 && again.body.rule === '1.4.2', 'a duplicate order was issued');
  } },
  { id: 'SR.8', fn: 'F.2.5.2', name: 'The dispatch order identifies the incident location and the assigned task', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body;
    ok(o.location === SAMPLE.location && /snow|medical/i.test(o.task), 'location or task missing from the order');
  } },
  // ---- F.2.5.3 Verify Dispatch Acknowledgment · S.1.5.3 Acknowledgment Verification Module
  { id: 'CRD 1.1.3', fn: 'F.2.5.3', name: 'Accepts the Dispatch Acknowledgment (IO.8) from the Rescue Team', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body, r = ack(api, o, o.teamId);
    ok(r.status === 200 && r.body.acknowledgedAt, 'acknowledgment not accepted');
  } },
  { id: 'CRD 1.4.3', fn: 'F.2.5.3', name: 'Verifies the acknowledgment against the issued-order record (IO.16) and passes IO.17', run: function () {
    var t = recording(), rec = toRecommendation(t.api); approve(t.api, rec);
    var o = dispatch(t.api, rec).body; ack(t.api, o, o.teamId);
    var c = t.calls.filter(function (x) { return x.operationId === 'verifyDispatchAcknowledgment'; })[0];
    ok(c && c.request.issuedOrderRecord.orderId === o.id && c.response.body.orderId === o.id, 'IO.8 was not checked against IO.16');
  } },
  { id: 'CRD 2.4.1', fn: 'F.2.5.3', name: 'Records each acknowledgment against its identified dispatch order', run: function () {
    var api = Routes.createApi();
    var r1 = toRecommendation(api); approve(api, r1); var o1 = dispatch(api, r1).body;
    var r2 = toRecommendation(api, { location: 'Collegetown', description: 'Two people trapped by snow in a car' }); approve(api, r2);
    var o2 = dispatch(api, r2).body;
    ack(api, o1, o1.teamId);
    ok(status(api, o1).code === 'ACKNOWLEDGED' && status(api, o2).code === 'AWAITING_ACK', 'acknowledgment recorded on the wrong order');
  } },
  { id: 'CRD 2.4.2', fn: 'F.2.5.3', name: 'Rejects acknowledgments from rescue teams not assigned to the order', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body, other = o.teamId === 'RT-A' ? 'RT-B' : 'RT-A', r = ack(api, o, other);
    ok(r.status === 409 && r.body.rule === '2.4.2', 'acknowledgment from a non-assigned team was accepted');
    ok(status(api, o).code === 'AWAITING_ACK', 'status changed after a rejected acknowledgment');
  } },
  { id: 'SR.9', fn: 'F.2.5.3', name: 'The assigned Rescue Team can acknowledge receipt of a dispatch order', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body;
    ok(ack(api, o, o.teamId).status === 200, 'assigned team could not acknowledge');
  } },
  // ---- F.2.5.4 Report Dispatch Status · S.1.5.4 Status Reporting Module
  { id: 'CRD 1.2.2', fn: 'F.2.5.4', name: 'Provides the Dispatch Status (IO.9) to the Emergency Coordinator', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var s = status(api, dispatch(api, rec).body);
    ok(s.code && s.label, 'no dispatch status provided');
  } },
  { id: 'CRD 1.4.4', fn: 'F.2.5.4', name: 'Reports dispatch status from the verified acknowledgment (IO.17) only', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body;
    ok(status(api, o).code === 'AWAITING_ACK', 'status not awaiting before acknowledgment');
    ack(api, o, o.teamId);
    ok(status(api, o).code === 'ACKNOWLEDGED', 'status not acknowledged after verified acknowledgment');
  } },
  { id: 'SR.7', fn: 'F.2.5.4', name: 'The coordinator can see whether the assigned team acknowledged the order', run: function () {
    var api = Routes.createApi(), rec = toRecommendation(api); approve(api, rec);
    var o = dispatch(api, rec).body; ack(api, o, o.teamId);
    ok(/Acknowledged by/.test(status(api, o).label), 'acknowledgment not visible to the coordinator');
  } },
  // ---- F.2.5 as a whole · S.1.5 Dispatch Management Subsystem
  { id: 'CRD 2.3.1', fn: 'F.2.5', name: 'Issues dispatch orders without invoking the language model (inspection of the S.1.5 modules)', run: function () {
    var dir = path.join(ROOT, 'rescutech-orchestrator', 'functions');
    fs.readdirSync(dir).filter(function (n) { return /^f2-5/.test(n); }).forEach(function (n) {
      var src = fs.readFileSync(path.join(dir, n), 'utf8');
      ok(!/incident-structuring-agent|IncidentStructurer|fetch\(|https?:\/\//.test(src), n + ' references a model or network call');
    });
  } }
];

function runOne(c) {
  try { c.run(); return { id: c.id, fn: c.fn, name: c.name, pass: true }; }
  catch (e) { return { id: c.id, fn: c.fn, name: c.name, pass: false, error: e.message }; }
}

if (require.main === module) {
  var only = process.argv[2];
  var list = only ? CHECKS.filter(function (c) { return c.id === only; }) : CHECKS;
  if (!list.length) { console.log('No check named ' + only); process.exit(2); }
  var results = list.map(runOne), failed = results.filter(function (r) { return !r.pass; }).length;
  results.forEach(function (r) { console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.id + ' [' + r.fn + '] ' + r.name + (r.pass ? '' : '\n      ' + r.error)); });
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
module.exports = { CHECKS: CHECKS, runOne: runOne };
