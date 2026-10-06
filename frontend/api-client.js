/*
 * Front-end transport to the RescuTech service layer.
 * HTTP when served by `npm start`; otherwise the same route table runs in the page
 * (used when index.html is opened from disk or hosted as a static page).
 */
(function (root) {
  'use strict';
  function create(onCall) {
    var local = root.RescuTechRoutes.createApi();
    var mode = 'local';

    function detect() {
      if (!/^https?:/.test(location.protocol) || !root.fetch) return Promise.resolve(mode);
      return fetch('/api/health').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.ok) mode = 'http'; return mode; })
        .catch(function () { return mode; });
    }

    function call(method, path, body) {
      var started = Date.now();
      var p = mode === 'http'
        ? fetch(path, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
            .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        : Promise.resolve(local.handle(method, path, body ? JSON.parse(JSON.stringify(body)) : null));
      return p.then(function (res) {
        if (onCall) onCall({ method: method, path: path, status: res.status, ms: Date.now() - started, mode: mode });
        return res;
      });
    }

    function log() {
      return mode === 'http' ? fetch('/api/log').then(function (r) { return r.json(); }).then(function (b) { return b.map(function (e) { e.time = new Date(e.time); return e; }); })
                             : Promise.resolve(local.workflow().state.log);
    }

    return { detect: detect, call: call, log: log, mode: function () { return mode; } };
  }
  root.RescuTechApiClient = { create: create };
})(this);
