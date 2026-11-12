/*
 * RescuTech REST API (service layer of S.1).
 * Each route carries one message of the UC.1 Sequence Diagram (Innoslate project 584).
 * The same table is served over HTTP by server.js and called in-process by the front end
 * when no server is running, so both paths execute identical code.
 *
 * handleAsync() is used by server.js only. When the server has a Claude agent (opts.agent, see
 * incident-structuring-agent/agent.js) it runs the agent before UC.1.4 and adds the AI briefing after UC.1.9.
 * Without an agent, handleAsync() gives exactly the same result as handle().
 */
(function (root) {
  'use strict';
  var Workflow = (typeof module !== 'undefined' && module.exports)
    ? require('./workflow.js') : root.RescuTechWorkflow;

  function createApi(opts) {
    opts = opts || {};
    // Instrumentation (Lab Manual 10.4): entry/exit time at every participant boundary of the UC.1 sequence diagram.
    var hr = function () { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
    var spans = [];
    var CONTRACT_STAGE = {
      structureIncident: ['UC.1.4', 'S.1.2 Incident Structuring', 'validate structured incident'],
      retrieveLatestTeamStatus: ['UC.1.5', 'S.1.3 Resource Status', 'retrieve latest team status'],
      getCurrentResourceAvailability: ['UC.1.7', 'S.1.3 Resource Status', 'update resource availability'],
      recommendResourceAssignment: ['UC.1.8', 'S.1.4 Recommendation', 'evaluate resource suitability']
    };
    function span(kind, name, uc, participant, start, end, extra) {
      var s = { kind: kind, name: name, uc: uc, participant: participant, start: start, end: end, ms: Math.round((end - start) * 1000) / 1000 };
      if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
      spans.push(s);
      if (spans.length > 5000) spans.shift();
    }
    var userOnSpan = opts.onSpan;
    opts.onSpan = function (c) {
      var st = CONTRACT_STAGE[c.operationId];
      if (st) span('contract', st[2], st[0], st[1], c.start, c.end, { operationId: c.operationId });
      if (userOnSpan) userOnSpan(c);
    };
    var wf = Workflow.createWorkflow(opts);
    var agent = opts.agent && opts.agent.enabled() ? opts.agent : null;

    function guard(fn) {
      try { return fn(); } catch (e) {
        if (e && e.name === 'GuardError') return { status: 409, body: { error: e.message, rule: e.rule } };
        return { status: 500, body: { error: String(e && e.message || e) } };
      }
    }

    // [method, pattern, model messages, handler(params, body)]
    var ROUTES = [
      ['GET', '/api/health', [], function () { return { status: 200, body: { ok: true, service: 'RescuTech orchestrator (S.1)' } }; }],
      ['POST', '/api/reset', [], function () { wf = Workflow.createWorkflow(opts); return { status: 200, body: { ok: true } }; }],
      ['GET', '/api/teams', [], function () { return { status: 200, body: wf.state.teams }; }],
      ['GET', '/api/log', [], function () { return { status: 200, body: wf.state.log }; }],
      ['GET', '/api/timings', [], function () { return { status: 200, body: spans }; }],
      ['POST', '/api/timings/reset', [], function () { spans = []; return { status: 200, body: { ok: true } }; }],
      ['GET', '/api/agent', [], function () {
        return { status: 200, body: agent ? agent.status() : { enabled: false, provider: 'keyword stub', model: null } };
      }],

      ['POST', '/api/distress-reports', ['UC.1.1', 'UC.1.2', 'UC.1.3'], function (p, b) {
        var r = wf.submitDistressReport(b || {});
        return r.ok ? { status: 201, body: r } : { status: 422, body: { error: r.error, rule: 'SR.1' } };
      }],
      ['POST', '/api/distress-reports/:id/incident', ['UC.1.4'], function (p, b, agentOutput) {
        if (!wf.state.reports[p.id]) return { status: 404, body: { error: 'Unknown report ' + p.id } };
        var inc = wf.structureIncidentInformation(p.id, agentOutput);
        return inc.error ? { status: 422, body: inc } : { status: 201, body: inc };
      }],
      // UC.1.6 Push Status Update: a Rescue Team pushes its status whenever it changes (IO.4, optional flow)
      ['PUT', '/api/teams/:teamId/status', ['UC.1.6'], function (p, b) {
        var t = wf.pushStatusUpdate(p.teamId, b || {});
        return t ? { status: 200, body: t } : { status: 404, body: { error: 'Unknown team ' + p.teamId } };
      }],
      // UC.1.5 Retrieve Latest Team Status; IO.3 Status Refresh Request goes only to stale teams
      ['POST', '/api/incidents/:id/status-requests', ['UC.1.5'], function (p) {
        return guard(function () { return { status: 202, body: wf.retrieveLatestTeamStatus(p.id) }; });
      }],
      // UC.1.6 for one incident: a stale team answering the Status Refresh Request (same push)
      ['PUT', '/api/incidents/:id/team-status/:teamId', ['UC.1.6'], function (p, b) {
        return { status: 200, body: wf.provideResourceStatus(p.id, p.teamId, b || {}) };
      }],
      ['POST', '/api/incidents/:id/recommendation', ['UC.1.7', 'UC.1.8', 'UC.1.9', 'UC.1.10'], function (p) {
        return guard(function () {
          var rec = wf.presentDispatchRecommendation(p.id);
          wf.reviewDispatchRecommendation(rec.id);
          return { status: 201, body: rec };
        });
      }],
      ['POST', '/api/recommendations/:id/approval', ['UC.1.11'], function (p, b) {
        return guard(function () { return { status: 201, body: wf.approveResourceAssignment(p.id, (b && b.by) || 'Emergency Coordinator') }; });
      }],
      ['POST', '/api/recommendations/:id/dispatch-order', ['UC.1.12'], function (p) {
        return guard(function () { return { status: 201, body: wf.issueDispatchOrder(p.id) }; });
      }],
      ['POST', '/api/dispatch-orders/:id/acknowledgment', ['UC.1.13', 'UC.1.14'], function (p, b) {
        return guard(function () { return { status: 200, body: wf.acknowledgeDispatchOrder(p.id, b && b.teamId) }; });
      }],
      ['GET', '/api/dispatch-orders/:id/status', ['UC.1.15', 'UC.1.16'], function (p) {
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

    function find(method, path) {
      for (var i = 0; i < ROUTES.length; i++) {
        var r = ROUTES[i];
        if (r[0] !== method) continue;
        var params = match(r[1], path);
        if (params) return { route: r, params: params };
      }
      return null;
    }

    // Route -> UC.1 step and participant on the sequence diagram (system side only; human steps are not timed)
    var ROUTE_STAGE = {
      'POST /api/distress-reports': ['UC.1.2', 'S.1.1 Report Intake', 'answer, transcribe and register report'],
      'POST /api/distress-reports/:id/incident': ['UC.1.4', 'S.1.2 Incident Structuring', 'structure incident (route total)'],
      'POST /api/incidents/:id/status-requests': ['UC.1.5', 'S.1.3 Resource Status', 'retrieve latest team status (route total)'],
      'PUT /api/teams/:teamId/status': ['UC.1.6', 'X.3 Rescue Team -> S.1.3', 'push status update'],
      'POST /api/incidents/:id/recommendation': ['UC.1.7-UC.1.9', 'S.1.3 / S.1.4', 'availability, evaluation and recommendation (route total)'],
      'POST /api/recommendations/:id/approval': ['UC.1.11', 'X.2 Coordinator -> S.1.5', 'record approval'],
      'POST /api/recommendations/:id/dispatch-order': ['UC.1.12', 'S.1.5 Dispatch Management', 'issue dispatch order'],
      'POST /api/dispatch-orders/:id/acknowledgment': ['UC.1.14', 'S.1.5 Dispatch Management', 'record dispatch acknowledgment'],
      'GET /api/dispatch-orders/:id/status': ['UC.1.15', 'S.1.5 Dispatch Management', 'present dispatch status']
    };
    function run(hit, body, extra, t0) {
      var start = t0 === undefined ? hr() : t0;
      var res = hit.route[3](hit.params, body, extra);
      res.route = hit.route[0] + ' ' + hit.route[1];
      res.messages = hit.route[2];
      var st = ROUTE_STAGE[res.route];
      if (st) span('route', st[2], st[0], st[1], start, hr(), { status: res.status });
      return res;
    }

    function handle(method, path, body) {
      var hit = find(method, path);
      return hit ? run(hit, body) : { status: 404, body: { error: 'No route for ' + method + ' ' + path } };
    }

    function agentLog(uc, text, kind) { wf.state.log.push({ time: new Date(), uc: uc, actor: 'RescuTech', text: text, refs: ['2.3.1', '2.3.3', '2.5.1'], kind: kind || 'warn' }); }

    // Server path: same routes, with the Claude agent around UC.1.4 and UC.1.9.
    function handleAsync(method, path, body) {
      var hit = find(method, path);
      if (!hit) return Promise.resolve({ status: 404, body: { error: 'No route for ' + method + ' ' + path } });
      var pattern = hit.route[1];
      var t0 = hr();
      if (agent && pattern === '/api/distress-reports/:id/incident' && wf.state.reports[hit.params.id]) {
        var rr = wf.registeredReport(hit.params.id);
        return agent.structure({ location: rr.location, description: rr.description }).then(function (out) {
          span('agent', 'Claude structuring call', 'UC.1.4', 'S.1.2 Incident Structuring', t0, hr(),
               { outcome: out && out.unavailable ? 'unavailable' : (out && out.invalid ? 'invalid' : 'ok') });
          if (out && out.unavailable) {
            agentLog('UC.1.4', 'Claude agent unavailable (' + out.unavailable + '); keyword rules used instead.');
            return run(hit, body, undefined, t0);
          }
          return run(hit, body, out, t0);
        });
      }
      var res = run(hit, body, undefined, t0);
      if (agent && pattern === '/api/incidents/:id/recommendation' && res.status === 201 && res.body.teamId) {
        var rec = res.body, inc = wf.state.incidents[rec.incidentId];
        var tb = hr();
        return agent.explain(rec, inc).then(function (out) {
          span('agent', 'Claude briefing call', 'UC.1.9', 'S.1.4 Recommendation', tb, hr(), { outcome: out.briefing ? 'ok' : 'withheld' });
          if (out.briefing) { rec.briefing = out.briefing; rec.briefingSource = agent.status().model; }
          else agentLog('UC.1.9', 'AI briefing withheld (' + out.error + '); rule-based rationale shown only.');
          var last = spans[spans.length - 2];
          if (last && last.kind === 'route' && last.uc === 'UC.1.7-UC.1.9') { last.end = hr(); last.ms = Math.round((last.end - last.start) * 1000) / 1000; }
          return res;
        });
      }
      return Promise.resolve(res);
    }

    return { handle: handle, handleAsync: handleAsync, routes: ROUTES.map(function (r) { return { method: r[0], path: r[1], messages: r[2] }; }),
             workflow: function () { return wf; } };
  }

  var api = { createApi: createApi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RescuTechRoutes = api;
})(this);
