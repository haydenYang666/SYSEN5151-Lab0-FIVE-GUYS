/*
 * Need-linked acceptance checks (SR.12). Each check runs through the REST route table, so it
 * exercises the same path as the front end. Names carry the UN.1 need and SRD.1 requirement IDs.
 *   Node:    npm test
 *   Browser: "Run acceptance checks" on the Traceability tab
 */
(function (root) {
  'use strict';
  var Routes = (typeof module !== 'undefined' && module.exports)
    ? require('../rescutech-orchestrator/routes.js') : root.RescuTechRoutes;

  var SAMPLE = {
    location: '412 Fall Creek Dr, Fall Creek, Ithaca',
    description: 'Our car is stuck on a snow-blocked road. Two adults inside, one is shivering badly and may have hypothermia.'
  };
  function ok(cond, msg) { if (!cond) throw new Error(msg); }

  function toRecommendation(api, input) {
    var r = api.handle('POST', '/api/distress-reports', input || SAMPLE).body;
    var inc = api.handle('POST', '/api/distress-reports/' + r.report.id + '/incident').body;
    api.handle('POST', '/api/incidents/' + inc.id + '/status-requests');
    api.handle('GET', '/api/teams').body.forEach(function (t) {
      api.handle('PUT', '/api/incidents/' + inc.id + '/team-status/' + t.id, { available: t.available, zoneKey: t.zoneKey, capabilities: t.capabilities });
    });
    return { inc: inc, rec: api.handle('POST', '/api/incidents/' + inc.id + '/recommendation').body };
  }
  function toOrder(api) {
    var rec = toRecommendation(api).rec;
    api.handle('POST', '/api/recommendations/' + rec.id + '/approval', { by: 'tester' });
    return api.handle('POST', '/api/recommendations/' + rec.id + '/dispatch-order').body;
  }

  var CHECKS = [
    { need: 'N.1', sr: 'SR.1', name: 'A report with location and assistance description is registered unchanged', run: function (api) {
      var res = api.handle('POST', '/api/distress-reports', SAMPLE);
      ok(res.status === 201, 'expected 201, got ' + res.status);
      ok(res.body.report.location === SAMPLE.location && res.body.report.description === SAMPLE.description, 'fields changed');
    } },
    { need: 'N.1', sr: 'SR.1', name: 'A report missing the location is rejected with guidance', run: function (api) {
      var res = api.handle('POST', '/api/distress-reports', { location: '', description: 'Need help' });
      ok(res.status === 422, 'expected 422, got ' + res.status);
    } },
    { need: 'N.2', sr: 'SR.2', name: 'Receipt confirms registration and does not claim dispatch', run: function (api) {
      var m = api.handle('POST', '/api/distress-reports', SAMPLE).body.receipt.message;
      ok(/registered/i.test(m) && /does not mean a team has been assigned or dispatched/i.test(m), 'receipt wording');
    } },
    { need: 'N.3', sr: 'SR.3', name: 'Undetermined incident fields are flagged as missing, not guessed', run: function (api) {
      var r = api.handle('POST', '/api/distress-reports', { location: 'somewhere near the hill', description: 'Please help us' }).body;
      var inc = api.handle('POST', '/api/distress-reports/' + r.report.id + '/incident').body;
      ok(inc.missing.length >= 2 && inc.assistanceNeeded === null, 'missing fields not flagged');
    } },
    { need: 'N.4', sr: 'SR.4', name: 'No unavailable or capability-mismatched team is recommended', run: function (api) {
      var out = toRecommendation(api);
      var team = api.handle('GET', '/api/teams').body.filter(function (t) { return t.id === out.rec.teamId; })[0];
      ok(team && team.available, 'recommended team unavailable');
      out.inc.requiredCapabilities.forEach(function (c) { ok(team.capabilities.indexOf(c) !== -1, 'lacks ' + c); });
    } },
    { need: 'N.4', sr: 'SR.5', name: 'Every recommendation carries a rationale', run: function (api) {
      ok(toRecommendation(api).rec.rationale.length >= 2, 'rationale missing');
    } },
    { need: 'N.5', sr: 'SR.6', name: 'No dispatch order without coordinator approval', run: function (api) {
      var rec = toRecommendation(api).rec;
      var res = api.handle('POST', '/api/recommendations/' + rec.id + '/dispatch-order');
      ok(res.status === 409 && res.body.rule === 'SR.6', 'expected 409 SR.6, got ' + res.status);
      ok(Object.keys(api.workflow().state.orders).length === 0, 'an order was created');
    } },
    { need: 'N.5', sr: 'SR.6', name: 'Order is issued after approval of the same assignment', run: function (api) {
      var o = toOrder(api);
      ok(o && o.id && o.approvalId, 'order not issued after approval');
    } },
    { need: 'N.7', sr: 'SR.8', name: 'Dispatch order carries incident location and task', run: function (api) {
      var o = toOrder(api);
      ok(o.location === SAMPLE.location && o.task && o.task.length > 0, 'order content');
    } },
    { need: 'N.6', sr: 'SR.7', name: 'Status is not "acknowledged" before the team acknowledges', run: function (api) {
      var o = toOrder(api);
      ok(api.handle('GET', '/api/dispatch-orders/' + o.id + '/status').body.code === 'AWAITING_ACK', 'premature status');
      api.handle('POST', '/api/dispatch-orders/' + o.id + '/acknowledgment', { teamId: o.teamId });
      ok(api.handle('GET', '/api/dispatch-orders/' + o.id + '/status').body.code === 'ACKNOWLEDGED', 'status not updated');
    } },
    { need: 'N.6', sr: 'SR.9', name: 'Acknowledgment from a different team is rejected', run: function (api) {
      var o = toOrder(api);
      var res = api.handle('POST', '/api/dispatch-orders/' + o.id + '/acknowledgment', { teamId: 'RT-X' });
      ok(res.status === 409, 'expected 409, got ' + res.status);
    } },
    { need: 'N.8', sr: 'SR.10', name: 'Incomplete team status is flagged and the team is excluded', run: function (api) {
      var r = api.handle('POST', '/api/distress-reports', SAMPLE).body;
      var inc = api.handle('POST', '/api/distress-reports/' + r.report.id + '/incident').body;
      api.handle('POST', '/api/incidents/' + inc.id + '/status-requests');
      var t = api.handle('PUT', '/api/incidents/' + inc.id + '/team-status/RT-D', { available: true }).body;
      ok(t.statusIncomplete === true, 'not flagged');
      var rec = api.handle('POST', '/api/incidents/' + inc.id + '/recommendation').body;
      ok(rec.teamId !== 'RT-D', 'incomplete team recommended');
    } }
  ];

  function runAll() {
    return CHECKS.map(function (c) {
      try { c.run(Routes.createApi()); return { need: c.need, sr: c.sr, name: c.name, pass: true }; }
      catch (e) { return { need: c.need, sr: c.sr, name: c.name, pass: false, error: e.message }; }
    });
  }

  var api = { CHECKS: CHECKS, runAll: runAll };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module) {
      var res = runAll(), failed = 0;
      res.forEach(function (r) {
        console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.need + ' / ' + r.sr + ' — ' + r.name + (r.pass ? '' : '\n      ' + r.error));
        if (!r.pass) failed += 1;
      });
      console.log('\n' + (res.length - failed) + ' passed, ' + failed + ' failed');
      process.exit(failed ? 1 : 0);
    }
  } else root.RescuTechAcceptance = api;
})(this);
