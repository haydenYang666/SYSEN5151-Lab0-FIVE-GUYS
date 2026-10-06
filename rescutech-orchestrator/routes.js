/*
 * RescuTech REST API (service layer of S.1).
 * Each route carries one message of the UC.1 Sequence Diagram (Innoslate project 584).
 * The same table is served over HTTP by server.js and called in-process by the front end
 * when no server is running, so both paths execute identical code.
 */
(function (root) {
  'use strict';
  var Workflow = (typeof module !== 'undefined' && module.exports)
    ? require('./workflow.js') : root.RescuTechWorkflow;

  function createApi() {
    var wf = Workflow.createWorkflow();

    function guard(fn) {
      try { return fn(); } catch (e) {
        if (e && e.name === 'GuardError') return { status: 409, body: { error: e.message, rule: e.rule } };
        return { status: 500, body: { error: String(e && e.message || e) } };
      }
    }

    // [method, pattern, model messages, handler(params, body)]
    var ROUTES = [
      ['GET', '/api/health', [], function () { return { status: 200, body: { ok: true, service: 'RescuTech orchestrator (S.1)' } }; }],
      ['POST', '/api/reset', [], function () { wf = Workflow.createWorkflow(); return { status: 200, body: { ok: true } }; }],
      ['GET', '/api/teams', [], function () { return { status: 200, body: wf.state.teams }; }],
      ['GET', '/api/log', [], function () { return { status: 200, body: wf.state.log }; }],

      ['POST', '/api/distress-reports', ['UC.1.1', 'UC.1.2', 'UC.1.3'], function (p, b) {
        var r = wf.submitDistressReport(b || {});
        return r.ok ? { status: 201, body: r } : { status: 422, body: { error: r.error, rule: 'SR.1' } };
      }],
      ['POST', '/api/distress-reports/:id/incident', ['UC.1.4'], function (p) {
        if (!wf.state.reports[p.id]) return { status: 404, body: { error: 'Unknown report ' + p.id } };
        return { status: 201, body: wf.structureIncidentInformation(p.id) };
      }],
      ['POST', '/api/incidents/:id/status-requests', ['UC.1.5'], function (p) {
        return { status: 202, body: wf.requestResourceStatus(p.id) };
      }],
      ['PUT', '/api/incidents/:id/team-status/:teamId', ['UC.1.6'], function (p, b) {
        return { status: 200, body: wf.provideResourceStatus(p.id, p.teamId, b || {}) };
      }],
      ['POST', '/api/incidents/:id/recommendation', ['UC.1.7', 'UC.1.8', 'UC.1.9'], function (p) {
        var rec = wf.presentDispatchRecommendation(p.id);
        wf.reviewDispatchRecommendation(rec.id);
        return { status: 201, body: rec };
      }],
      ['POST', '/api/recommendations/:id/approval', ['UC.1.10'], function (p, b) {
        return guard(function () { return { status: 201, body: wf.approveResourceAssignment(p.id, (b && b.by) || 'Emergency Coordinator') }; });
      }],
      ['POST', '/api/recommendations/:id/dispatch-order', ['UC.1.11'], function (p) {
        return guard(function () { return { status: 201, body: wf.issueDispatchOrder(p.id) }; });
      }],
      ['POST', '/api/dispatch-orders/:id/acknowledgment', ['UC.1.12', 'UC.1.13'], function (p, b) {
        return guard(function () { return { status: 200, body: wf.acknowledgeDispatchOrder(p.id, b && b.teamId) }; });
      }],
      ['GET', '/api/dispatch-orders/:id/status', ['UC.1.14', 'UC.1.15'], function (p) {
        return { status: 200, body: wf.reviewDispatchStatus(p.id) };
      }]
    ];

    function match(pattern, path) {
      var a = pattern.split('/'), b = path.split('/');
      if (a.length !== b.length) return null;
      var params = {};
      for (var i = 0; i < a.length; i++) {
        if (a[i].charAt(0) === ':') params[a[i].slice(1)] = decodeURIComponent(b[i]);
        else if (a[i] !== b[i]) return null;
      }
      return params;
    }

    function handle(method, path, body) {
      for (var i = 0; i < ROUTES.length; i++) {
        var r = ROUTES[i];
        if (r[0] !== method) continue;
        var params = match(r[1], path);
        if (params) {
          var res = r[3](params, body);
          res.route = r[0] + ' ' + r[1];
          res.messages = r[2];
          return res;
        }
      }
      return { status: 404, body: { error: 'No route for ' + method + ' ' + path } };
    }

    return { handle: handle, routes: ROUTES.map(function (r) { return { method: r[0], path: r[1], messages: r[2] }; }),
             workflow: function () { return wf; } };
  }

  var api = { createApi: createApi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RescuTechRoutes = api;
})(this);
