/*
 * RescuTech walking skeleton — front end (Interfaces 1, 3 and 4).
 * Every action calls the S.1 REST API (rescutech-orchestrator/routes.js), which carries one
 * message of the UC.1 Sequence Diagram. No business rules live here.
 */
(function () {
  'use strict';

  var ACTOR = {
    cit: { name: 'Citizen', id: 'X.1', iface: 'Interface 1 · phone', ab: 'X.1' },
    sys: { name: 'RescuTech', id: 'S.1', iface: 'System of Interest · intake', ab: 'S.1' },
    coord: { name: 'Emergency Coordinator', id: 'X.2', iface: 'Interface 3 · console', ab: 'X.2' },
    team: { name: 'Rescue Team', id: 'X.3', iface: 'Interface 4 · tablet', ab: 'X.3' }
  };
  var STEPS = [
    { key: 'report', title: 'Report', range: 'UC.1.1', actor: 'cit', srs: ['SR.1'],
      say: 'A resident caught in the storm reports in plain words from a phone browser.' },
    { key: 'receipt', title: 'Receipt', range: 'UC.1.2–1.3', actor: 'cit', srs: ['SR.2'],
      say: 'RescuTech registers the report and says exactly what that means, <b>and what it does not</b>.' },
    { key: 'structure', title: 'Structure', range: 'UC.1.4–1.5', actor: 'sys', srs: ['SR.3'],
      say: 'The free text becomes a structured incident. Anything the system cannot determine is <b>flagged, never guessed</b>.' },
    { key: 'status', title: 'Team status', range: 'UC.1.6', actor: 'team', srs: ['SR.10'],
      say: 'Rescue teams answer the status request. Switch a team off to watch the recommendation change.' },
    { key: 'decide', title: 'Approve', range: 'UC.1.7–1.11', actor: 'coord', srs: ['SR.4', 'SR.5', 'SR.6'],
      say: 'One recommended team, with reasons. <b>Try sending without approval first</b>: SR.6 blocks it.' },
    { key: 'ack', title: 'Acknowledge', range: 'UC.1.12–1.13', actor: 'team', srs: ['SR.8', 'SR.9'],
      say: 'The assigned team gets the approved order with location and task, and confirms receipt.' },
    { key: 'done', title: 'Status', range: 'UC.1.14–1.15', actor: 'coord', srs: ['SR.7'],
      say: 'Status comes only from recorded events, so “acknowledged” can never appear early.' }
  ];
  var ACTIONS = {
    'UC.1.1': 'Submit Distress Report', 'UC.1.2': 'Register Distress Report', 'UC.1.3': 'Receive Report Receipt',
    'UC.1.4': 'Structure Incident Information', 'UC.1.5': 'Request Resource Status', 'UC.1.6': 'Provide Resource Status',
    'UC.1.7': 'Evaluate Resource Suitability', 'UC.1.8': 'Present Dispatch Recommendation', 'UC.1.9': 'Review Dispatch Recommendation',
    'UC.1.10': 'Approve Resource Assignment', 'UC.1.11': 'Issue Dispatch Order', 'UC.1.12': 'Acknowledge Dispatch Order',
    'UC.1.13': 'Record Dispatch Acknowledgment', 'UC.1.14': 'Present Dispatch Status', 'UC.1.15': 'Review Dispatch Status'
  };
  // Sequence Diagram messages: [from lifeline, to lifeline, label]. Lifelines in Innoslate order.
  var LIFE = [['RescuTech', 'S.1', 'sys'], ['Citizen', 'X.1', 'cit'], ['Emergency Coordinator', 'X.2', 'coord'], ['Rescue Team', 'X.3', 'team']];
  var MSG = {
    'UC.1.1': [1, 0], 'UC.1.2': [0, 0], 'UC.1.3': [0, 1], 'UC.1.4': [0, 0], 'UC.1.5': [0, 3], 'UC.1.6': [3, 0], 'UC.1.7': [0, 0],
    'UC.1.8': [0, 2], 'UC.1.9': [2, 2], 'UC.1.10': [2, 0], 'UC.1.11': [0, 3], 'UC.1.12': [3, 0], 'UC.1.13': [0, 0], 'UC.1.14': [0, 2], 'UC.1.15': [2, 2]
  };
  var SAMPLE = {
    location: '412 Fall Creek Dr, Fall Creek, Ithaca',
    description: 'Our car is stuck on a snow-blocked road. Two adults inside, one is shivering badly and may have hypothermia.'
  };
  var CAP = { 'snow-access': 'Snow access', 'medical': 'Medical', 'water-rescue': 'Water rescue' };

  var $ = function (id) { return document.getElementById(id); };
  var client, run, cur, view, focus, reqs, logCache = [], checkResults = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hm(d) { return d ? new Date(d).toTimeString().slice(0, 8) : ''; }
  function vars(a) { return '--actor:var(--c-' + a + ');--actor-soft:var(--c-' + a + '-soft)'; }
  function trace(sr) { return window.RESCUTECH_TRACE.filter(function (t) { return t.sr === sr; })[0]; }
  function api(method, path, body) { return client.call(method, path, body).then(function (r) { return r; }); }

  // ---------------- header pieces ----------------
  function renderStats() {
    var res = checkResults || window.RescuTechAcceptance.runAll();
    checkResults = res;
    var pass = res.filter(function (r) { return r.pass; }).length;
    $('stats').innerHTML =
      '<li><b>UC.1</b> 15 actions</li><li><b>4</b> actors, 3 interfaces</li><li><b>10</b> needs → <b>12</b> requirements</li>' +
      '<li class="' + (pass === res.length ? 'pass' : '') + '"><b>' + pass + '/' + res.length + '</b> acceptance checks pass</li>';
  }

  function renderStepper() {
    $('stepper').innerHTML = STEPS.map(function (s, i) {
      var st = i === view ? 'current' : (i < cur ? 'done' : 'todo');
      return '<li data-s="' + st + '" style="' + vars(s.actor) + '"><button type="button" data-step="' + i + '"' + (i > cur ? ' disabled' : '') + '>' +
        '<span class="n"><i></i>' + (i + 1) + ' · ' + s.range + '</span><span class="t">' + esc(s.title) + '</span>' +
        '<span class="w">' + ACTOR[s.actor].name + '</span></button></li>';
    }).join('');
  }

  function renderStageHead(s) {
    var a = ACTOR[s.actor];
    var el = $('stage-head');
    el.setAttribute('style', vars(s.actor));
    el.innerHTML = '<span class="avatar">' + a.ab + '</span><div class="who"><b>' + a.name + '</b><span>' + a.id + ' · ' + a.iface + '</span></div>' +
      '<span class="uc">' + s.range + '</span>';
    $('stage').setAttribute('style', vars(s.actor));
  }

  // ---------------- side panels ----------------
  function renderLink() {
    var srs = STEPS[view].srs;
    if (srs.indexOf(focus) === -1) focus = srs[0];
    var t = trace(focus);
    $('link').innerHTML = (srs.length > 1 ? '<div class="seg" role="tablist">' + srs.map(function (sr) {
      return '<button type="button" role="tab" data-focus="' + sr + '" aria-selected="' + (sr === focus) + '">' + sr + '</button>';
    }).join('') + '</div>' : '') +
      '<ol class="chain">' +
      '<li><span class="k">N</span><div><div class="id">' + t.need + ' · stakeholder need</div><div class="tx">' + esc(t.needText) + '</div></div></li>' +
      '<li><span class="k">SR</span><div><div class="id">' + t.sr + ' · requirement</div><div class="tx">' + esc(t.srText) + '</div></div></li>' +
      '<li><span class="k">UC</span><div><div class="id">Action Diagram</div><div class="tx">' + t.uc.map(function (u) { return '<b class="mono">' + u + '</b> ' + ACTIONS[u]; }).join('<br>') + '</div></div></li>' +
      '<li><span class="k">&lt;/&gt;</span><div><div class="id">Code · ' + (t.stub ? '<span class="tag stub">STUB</span>' : '<span class="tag real">REAL</span>') + '</div>' +
      '<div class="tx"><code>' + esc(t.api) + '</code><br><code>' + esc(t.code) + '</code></div></div></li></ol>';
  }

  function renderReqs() {
    $('req-mode').textContent = client.mode() === 'http' ? 'HTTP · ' + location.host : 'in-page transport (no server running)';
    $('reqs').innerHTML = reqs.length ? reqs.slice().reverse().map(function (r) {
      return '<li><span class="m">' + r.method + '</span><span class="p" title="' + esc(r.path) + '">' + esc(r.path) + '</span>' +
        '<span class="s ' + (r.status < 400 ? 'ok' : 'bad') + '">' + r.status + '</span></li>';
    }).join('') : '<li class="empty">No requests yet.</li>';
  }

  function seqMessages(log) {
    var out = [];
    log.forEach(function (e) {
      var m = MSG[e.uc]; if (!m) return;
      var prev = out[out.length - 1];
      if (prev && prev.uc === e.uc && e.uc === 'UC.1.6') { prev.n += 1; return; }
      out.push({ uc: e.uc, from: m[0], to: m[1], blocked: e.kind === 'block', n: 1 });
    });
    return out;
  }

  function renderSeq() {
    var msgs = seqMessages(logCache);
    var W = 730, X = [86, 254, 422, 600], top = 70, row = 38;
    var H = Math.max(top + 30 + msgs.length * row + 20, 240);
    var s = '';
    LIFE.forEach(function (l, i) {
      s += '<line class="life" x1="' + X[i] + '" y1="50" x2="' + X[i] + '" y2="' + (H - 6) + '"/>';
      s += '<g class="lh"><rect x="' + (X[i] - 76) + '" y="8" width="152" height="42" rx="9" style="fill:var(--c-' + l[2] + '-soft);stroke:var(--c-' + l[2] + ')"/>' +
        '<text x="' + X[i] + '" y="27" text-anchor="middle">' + l[0] + '</text><text class="sub" x="' + X[i] + '" y="42" text-anchor="middle">' + l[1] + '</text></g>';
    });
    if (!msgs.length) s += '<text class="empty" x="' + W / 2 + '" y="' + (top + 40) + '" text-anchor="middle">Messages appear here as you run the use case.</text>';
    msgs.forEach(function (m, i) {
      var y = top + 24 + i * row, cls = 'msg' + (m.blocked ? ' blocked' : '') + (i === msgs.length - 1 ? ' last' : '');
      var label = '<tspan class="uc">' + m.uc + '</tspan> ' + esc(ACTIONS[m.uc]) + (m.n > 1 ? ' ×' + m.n : '') + (m.blocked ? ' · blocked (SR.6)' : '');
      if (m.from === m.to) {
        var x = X[m.from];
        s += '<g class="' + cls + '"><path d="M' + x + ' ' + (y - 8) + ' h22 v14 h-18"/><polygon points="' + (x + 2) + ',' + (y + 6) + ' ' + (x + 9) + ',' + (y + 2) + ' ' + (x + 9) + ',' + (y + 10) + '"/>' +
          '<text x="' + (x + 28) + '" y="' + (y + 2) + '">' + label + '</text></g>';
      } else {
        var x1 = X[m.from], x2 = X[m.to], dir = x2 > x1 ? 1 : -1;
        var tip = x2 - dir * 2;
        s += '<g class="' + cls + '"><line pathLength="1" x1="' + x1 + '" y1="' + y + '" x2="' + (tip - dir * 6) + '" y2="' + y + '"/>' +
          '<polygon points="' + tip + ',' + y + ' ' + (tip - dir * 8) + ',' + (y - 4) + ' ' + (tip - dir * 8) + ',' + (y + 4) + '"/>' +
          (m.blocked ? '<path d="M' + ((x1 + x2) / 2 - 6) + ' ' + (y - 6) + ' l12 12 M' + ((x1 + x2) / 2 + 6) + ' ' + (y - 6) + ' l-12 12" style="stroke-width:2.4"/>' : '') +
          '<text x="' + Math.min(x1, x2) + '" dx="6" y="' + (y - 6) + '">' + label + '</text></g>';
      }
    });
    var svg = $('seq');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = s;
    var wrap = $('seq-wrap'); wrap.scrollTop = wrap.scrollHeight;
  }

  function refreshSide() {
    return client.log().then(function (l) { logCache = l; renderSeq(); renderReqs(); renderLink(); });
  }

  // ---------------- screens ----------------
  function kv(inc) {
    function v(x) { return x ? esc(x) : '<span class="miss">Missing</span>'; }
    return '<dl class="kv"><dt>Location</dt><dd>' + v(inc.location) + '</dd><dt>Area</dt><dd>' + v(inc.zone && inc.zone.name) + '</dd>' +
      '<dt>Assistance</dt><dd>' + v(inc.assistanceNeeded) + '</dd><dt>Needs</dt><dd>' +
      (inc.requiredCapabilities.map(function (c) { return '<span class="chip">' + CAP[c] + '</span>'; }).join(' ') || '<span class="miss">Missing</span>') +
      '</dd><dt>People</dt><dd>' + v(inc.peopleCount) + '</dd><dt>Urgency</dt><dd>' + esc(inc.urgency) + '</dd></dl>';
  }
  function phone(inner) {
    return '<div class="phone"><div class="scr"><div class="sb"><span>9:41</span><span class="isl"></span><span>5G</span></div><div class="body">' + inner + '</div></div></div>';
  }
  function windowFrame(title, sub, right, inner) {
    return '<div class="window"><div class="chrome"><span class="dots"><i></i><i></i><i></i></span><span class="ttl"><b>' + title + '</b>' + sub + '</span><span class="rt">' + right + '</span></div><div class="wbody">' + inner + '</div></div>';
  }
  var live = function () { return view === cur; };

  var SCREENS = {
    report: function () {
      var lock = !!run.report;
      return phone('<div class="app-h"><span class="ic"></span><b>Request emergency help</b></div>' +
        '<form id="report-form" class="body" style="padding:0" novalidate>' +
        '<div class="field"><label for="f-loc">Where are you?</label><input id="f-loc" type="text" autocomplete="off" value="' + esc(lock ? run.report.location : SAMPLE.location) + '"' + (lock ? ' disabled' : '') + '><small>Street, landmark, or area</small></div>' +
        '<div class="field"><label for="f-desc">What help do you need?</label><textarea id="f-desc"' + (lock ? ' disabled' : '') + '>' + esc(lock ? run.report.description : SAMPLE.description) + '</textarea><small>Your own words are fine</small></div>' +
        '<div id="form-err" class="note warn" hidden></div>' +
        (lock ? '<div class="note ok"><b>Sent</b>Report ' + run.report.id + '</div>' : '<button type="submit" class="btn cit block">Send report</button>') + '</form>');
    },
    receipt: function () {
      return phone('<div class="receipt"><span class="tick"></span><b style="font-size:18px">Report registered</b><span class="rid">' + run.report.id + '</span></div>' +
        '<div class="note ok">' + esc(run.receipt.message) + '</div>') +
        (live() ? '<button type="button" class="btn primary" data-act="structure">Continue · RescuTech structures the report</button>' : '');
    },
    structure: function () {
      var inc = run.incident;
      return windowFrame('RescuTech', 'incident intake', inc.id + ' ← ' + inc.reportId,
        '<div class="cols"><div class="panel"><span class="cap">Citizen report, as received</span><p style="margin:0">“' + esc(run.report.description) + '”</p><p class="muted" style="margin:0;font-size:13px">' + esc(run.report.location) + '</p></div>' +
        '<div class="panel"><h3>Structured incident <span class="tag stub">STUB · incident-structuring-agent</span></h3>' + kv(inc) + '</div></div>' +
        (inc.missing.length ? '<div class="note warn"><b>Flagged as missing</b>' + esc(inc.missing.join(', ')) + '</div>' : '<div class="note ok"><b>All fields determined</b>No guesses were needed for this report.</div>')) +
        (live() ? '<button type="button" class="btn primary" data-act="request">Request status from rescue teams · UC.1.5</button>' : '');
    },
    status: function () {
      var lock = cur > 3;
      return '<div class="tablet"><div class="scr"><div class="tab-h"><b>Resource status request</b><span class="tag stub">STUB · resource-status-source</span><span class="rt mono muted" style="font-size:12px">' + run.incident.id + '</span></div>' +
        '<div class="teams">' + run.teams.map(function (t) {
          return '<div class="team"><span class="ini">' + t.name.split(' ').pop().charAt(0) + '</span><div><div class="nm">' + esc(t.name) + ' <span class="mono muted" style="font-size:11.5px">' + t.id + '</span></div>' +
            '<div class="ar">' + esc(window.IncidentStructurerStub.ZONES[t.zoneKey].name) + '</div><div class="chips">' + t.capabilities.map(function (c) { return '<span class="chip">' + CAP[c] + '</span>'; }).join('') + '</div></div>' +
            '<label class="switch"><input type="checkbox" id="av-' + t.id + '"' + (t.available ? ' checked' : '') + (lock ? ' disabled' : '') + '><span class="tr"></span><span>Available</span></label></div>';
        }).join('') + '</div>' +
        (lock ? '<div class="note ok"><b>Status sent</b>All ' + run.teams.length + ' teams responded.</div>' : '<button type="button" class="btn team block" data-act="status">Send status responses</button>') + '</div></div>';
    },
    decide: function () {
      var rec = run.rec, inc = run.incident, others = rec.alternatives.filter(function (a) { return a.teamId !== rec.teamId; });
      return windowFrame('RescuTech', 'coordinator console', inc.id + ' · urgency ' + esc(inc.urgency),
        '<div class="cols"><div class="panel"><h3>Incident</h3>' + kv(inc) + '</div>' +
        '<div class="reco"><span class="cap">Recommended team <span class="tag stub">STUB · rule-based</span></span>' +
        '<p class="nm">' + esc(rec.teamName || 'No suitable team') + '</p><ul>' + rec.rationale.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
        '<details class="why"><summary>Why not the other ' + others.length + ' teams</summary><table><tbody>' +
        others.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td class="x">' + esc(a.excludedBecause.join('; ') || 'farther away') + '</td></tr>'; }).join('') +
        '</tbody></table></details></div></div>' +
        (run.guard ? '<div class="note bad"><b>409 · blocked by SR.6</b>' + esc(run.guard) + '</div>' : '') +
        (run.approval && !run.order ? '<div class="note ok"><b>Approved · ' + run.approval.id + '</b>' + esc(rec.teamName) + ' approved for ' + inc.id + '.</div>' : '') +
        (live() && rec.teamId ? '<div class="acts">' + (!run.approval
          ? '<button type="button" class="btn danger" data-act="unapproved">Send order without approval</button><button type="button" class="btn coord" data-act="approve">Approve ' + esc(rec.teamName) + '</button>'
          : '<button type="button" class="btn coord" data-act="issue">Send dispatch order</button>') + '</div>' : ''));
    },
    ack: function () {
      var o = run.order;
      return '<div class="tablet"><div class="scr"><div class="tab-h"><b>' + esc(o.teamName) + '</b><span class="rt mono muted" style="font-size:12px">Interface 4</span></div>' +
        '<div class="order"><div class="top"><span>DISPATCH ORDER ' + o.id + '</span><span>' + esc(o.urgency).toUpperCase() + '</span></div><div class="bd">' +
        '<span class="cap">Go to</span><p class="loc">' + esc(o.location) + '</p><span class="cap">Task</span><p class="task">' + esc(o.task) + '</p>' +
        '<dl class="kv"><dt>Approved</dt><dd>' + o.approvalId + ' by the coordinator</dd><dt>Sent</dt><dd>' + hm(o.issuedAt) + '</dd></dl></div></div>' +
        (run.ackd ? '<div class="note ok"><b>Receipt confirmed</b>Acknowledged at ' + hm(run.ackd.acknowledgedAt) + '.</div>'
                  : '<button type="button" class="btn team block" data-act="ack">Acknowledge receipt</button>') + '</div></div>';
    },
    done: function () {
      var o = run.ackd || run.order, st = run.status;
      var used = {}; logCache.forEach(function (e) { e.refs.forEach(function (r) { used[r] = true; }); });
      var ops = window.RESCUTECH_TRACE.filter(function (t) { return t.lane !== 'delivery'; });
      var n = ops.filter(function (t) { return used[t.sr]; }).length;
      function tl(on, what, ref, when) { return '<li class="' + (on ? 'on' : '') + '"><span class="pt"></span><div><b>' + what + '</b><small>' + esc(ref) + '</small></div><span class="when">' + hm(when) + '</span></li>'; }
      return windowFrame('RescuTech', 'coordinator console', o.id,
        '<div class="cols"><div class="panel"><h3>Dispatch status <span class="pill ' + st.code + '">' + (st.code === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Awaiting acknowledgment') + '</span></h3><ol class="tl">' +
        tl(true, 'Report registered', run.report.id, run.report.registeredAt) + tl(true, 'Assignment approved', run.approval.id, run.approval.at) +
        tl(true, 'Order issued', o.id + ' → ' + o.teamName, o.issuedAt) + tl(!!o.acknowledgedAt, 'Receipt acknowledged', o.teamName, o.acknowledgedAt) +
        '</ol><p class="muted" style="margin:0;font-size:12.5px">Acknowledged means the order was received. Arrival and rescue are outside the system boundary.</p></div>' +
        '<div class="panel donebox"><span class="cap">Run complete</span><span class="big">' + n + '/' + ops.length + '</span><span>operational requirements exercised in this run, including the blocked dispatch attempt.</span>' +
        '<div class="acts"><button type="button" class="btn primary" data-act="open-trace">Open traceability</button><button type="button" class="btn" data-act="restart">Run again</button></div></div></div>');
    }
  };

  function render() {
    var s = STEPS[view];
    renderStepper();
    renderStageHead(s);
    $('stage').innerHTML = '<p class="say">' + s.say + '</p>' + SCREENS[s.key]();
    var form = $('report-form');
    if (form && !run.report) form.addEventListener('submit', onSubmit);
    return refreshSide();
  }
  function go(i, f) { cur = Math.max(cur, i); view = i; focus = f || STEPS[i].srs[0]; return render(); }

  // ---------------- actions (each = one API call = one sequence message group) ----------------
  function onSubmit(ev) {
    ev.preventDefault();
    api('POST', '/api/distress-reports', { location: $('f-loc').value, description: $('f-desc').value }).then(function (r) {
      if (r.status !== 201) { $('form-err').textContent = r.body.error; $('form-err').hidden = false; return refreshSide(); }
      run.report = r.body.report; run.receipt = r.body.receipt;
      return go(1);
    });
  }
  var ACTS = {
    structure: function () {
      return api('POST', '/api/distress-reports/' + run.report.id + '/incident').then(function (r) { run.incident = r.body; return go(2); });
    },
    request: function () {
      return api('POST', '/api/incidents/' + run.incident.id + '/status-requests')
        .then(function () { return api('GET', '/api/teams'); })
        .then(function (r) { run.teams = r.body; return go(3); });
    },
    status: function () {
      var calls = run.teams.map(function (t) {
        return function () { return api('PUT', '/api/incidents/' + run.incident.id + '/team-status/' + t.id, { available: $('av-' + t.id).checked, zoneKey: t.zoneKey, capabilities: t.capabilities }); };
      });
      var seqP = calls.reduce(function (p, f) { return p.then(f); }, Promise.resolve());
      return seqP.then(function () { return api('GET', '/api/teams'); }).then(function (r) { run.teams = r.body; })
        .then(function () { return api('POST', '/api/incidents/' + run.incident.id + '/recommendation'); })
        .then(function (r) { run.rec = r.body; return go(4); });
    },
    unapproved: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/dispatch-order').then(function (r) {
        run.guard = r.status === 409 ? r.body.error + ' No order was sent.' : null;
        focus = 'SR.6'; return render();
      });
    },
    approve: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/approval', { by: 'Coordinator on duty' }).then(function (r) {
        run.approval = r.body; run.guard = null; focus = 'SR.6'; return render();
      });
    },
    issue: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/dispatch-order').then(function (r) {
        run.order = r.body; return api('GET', '/api/dispatch-orders/' + run.order.id + '/status');
      }).then(function () { return go(5, 'SR.8'); });
    },
    ack: function () {
      return api('POST', '/api/dispatch-orders/' + run.order.id + '/acknowledgment', { teamId: run.order.teamId }).then(function (r) {
        run.ackd = r.body; return api('GET', '/api/dispatch-orders/' + run.order.id + '/status');
      }).then(function (r) { run.status = r.body; return go(6); });
    },
    'open-trace': function () { showView('trace'); },
    restart: restart
  };

  // ---------------- architecture + traceability views ----------------
  function renderContext() {
    var s = '';
    function box(x, y, w, h, cls, style) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="14" class="' + cls + '"' + (style ? ' style="' + style + '"' : '') + '/>'; }
    function actor(x, y, a, title, sub, lines) {
      var g = box(x, y, 230, 100, 'bx', 'stroke:var(--c-' + a + ');stroke-width:2;fill:var(--c-' + a + '-soft)') +
        '<text class="t1" x="' + (x + 16) + '" y="' + (y + 30) + '">' + title + '</text><text class="t2" x="' + (x + 16) + '" y="' + (y + 49) + '">' + sub + '</text>';
      lines.forEach(function (l, i) { g += '<text class="t3" x="' + (x + 16) + '" y="' + (y + 70 + i * 16) + '">' + l + '</text>'; });
      return g;
    }
    s += '<rect x="380" y="24" width="420" height="474" rx="22" class="bnd"/><text class="t2" x="398" y="46">SYSTEM BOUNDARY</text>';
    s += box(400, 58, 380, 424, 'soi');
    s += '<text class="t1" x="420" y="92">S.1 RescuTech</text><text class="t2" x="420" y="110">Disaster Response Agent Orchestrator</text>';
    var mods = [
      ['Service layer · REST API', 'rescutech-orchestrator/', 'real'],
      ['Incident Structuring Agent', 'incident-structuring-agent/ · model participant', 'stub'],
      ['Suitability + recommendation', 'workflow.js · rule-based for now', 'stub'],
      ['Dispatch authority guard · SR.6', 'issueDispatchOrder()', 'real'],
      ['Status from recorded events · SR.7', 'presentDispatchStatus()', 'real']
    ];
    mods.forEach(function (m, i) {
      var y = 130 + i * 68;
      s += '<rect x="420" y="' + y + '" width="340" height="56" rx="10" class="mod-' + m[2] + '"/>' +
        '<text class="t3" x="436" y="' + (y + 24) + '" style="font-weight:600;fill:var(--ink)">' + m[0] + '</text>' +
        '<text class="t2" x="436" y="' + (y + 43) + '">' + m[1] + '</text>' +
        '<text class="labb" x="746" y="' + (y + 24) + '" text-anchor="end" style="fill:var(--' + (m[2] === 'stub' ? 'stub' : 'ok') + ')">' + m[2].toUpperCase() + '</text>';
    });
    s += actor(20, 210, 'cit', 'X.1 Citizen', 'Interface 1 · phone browser', ['Reports a distress situation']);
    s += actor(910, 64, 'coord', 'X.2 Coordinator', 'Interface 3 · console', ['Reviews and approves dispatch']);
    s += actor(910, 330, 'team', 'X.3 Rescue Team', 'Interface 4 · tablet', ['Reports status, acknowledges', 'Physical rescue: outside S.1']);
    function link(x1, x2, y, a, above, below) {
      var g = '<path class="lnk" d="M' + x1 + ' ' + y + ' H' + x2 + '" style="stroke:var(--c-' + a + ')"/>';
      above.forEach(function (t, i) { g += '<text class="lab" x="' + ((x1 + x2) / 2) + '" y="' + (y - 10 - (above.length - 1 - i) * 15) + '" text-anchor="middle">' + t + '</text>'; });
      below.forEach(function (t, i) { g += '<text class="lab" x="' + ((x1 + x2) / 2) + '" y="' + (y + 20 + i * 15) + '" text-anchor="middle">' + t + '</text>'; });
      return g;
    }
    s += link(250, 380, 260, 'cit', ['Distress Report →'], ['← Report Receipt']);
    s += link(800, 910, 114, 'coord', ['← Recommendation'], ['Approval →', '← Dispatch Status']);
    s += link(800, 910, 380, 'team', ['← Status Request', 'Resource Status →'], ['← Dispatch Order', 'Acknowledgment →']);
    $('ctx').innerHTML = s;

    var rows = [
      ['sys', 'S.1 RescuTech', 'Service layer: UC.1 actions, REST routes, server', 'rescutech-orchestrator/', 'real'],
      ['sys', 'Incident Structuring Agent (in S.1)', 'Model participant; keyword stub with the final response schema', 'incident-structuring-agent/', 'stub'],
      ['team', 'X.3 Rescue Team · resource status', 'Data participant; five simulated teams', 'resource-status-source/', 'stub'],
      ['cit', 'X.1 Citizen · Interface 1', 'Phone report form and receipt', 'frontend/ (Citizen view)', 'real'],
      ['coord', 'X.2 Emergency Coordinator · Interface 3', 'Console: recommendation, approval, status', 'frontend/ (Coordinator view)', 'real'],
      ['team', 'X.3 Rescue Team · Interface 4', 'Tablet: status response, order, acknowledgment', 'frontend/ (Rescue Team view)', 'real']
    ];
    $('boundary').innerHTML = '<thead><tr><th>Model element</th><th>Role in the skeleton</th><th>Directory</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><span class="dot" style="background:var(--c-' + r[0] + ')"></span><b>' + r[1] + '</b></td><td>' + r[2] + '</td><td><code>' + r[3] + '</code></td><td><span class="tag ' + r[4] + '">' + r[4].toUpperCase() + '</span></td></tr>';
      }).join('') + '</tbody>';
  }

  function renderTrace() {
    var bySr = {};
    (checkResults || []).forEach(function (r) { (bySr[r.sr] = bySr[r.sr] || []).push(r); });
    var used = {}; logCache.forEach(function (e) { e.refs.forEach(function (r) { used[r] = true; }); });
    var ops = window.RESCUTECH_TRACE.filter(function (t) { return t.lane !== 'delivery'; });
    var exercised = ops.filter(function (t) { return used[t.sr]; }).length;
    var pass = (checkResults || []).filter(function (r) { return r.pass; }).length, total = (checkResults || []).length;
    function cov(v, of, label) { var pct = of ? Math.round(v / of * 100) : 0; return '<div class="cov"><b>' + v + '/' + of + '</b><span>' + label + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>'; }
    $('coverage').innerHTML = cov(12, 12, 'requirements traced to a model step or deliverable') + cov(pass, total, 'acceptance checks passing') + cov(exercised, ops.length, 'operational requirements exercised in this demo run');
    $('trace').innerHTML = '<thead><tr><th>Need</th><th>Requirement</th><th>Model step</th><th>API · code</th><th>Check</th></tr></thead><tbody>' +
      window.RESCUTECH_TRACE.map(function (t) {
        var rs = bySr[t.sr], res;
        if (t.sr === 'SR.11') res = '<span class="res none">README review</span>';
        else if (t.sr === 'SR.12') res = '<span class="res ' + (pass === total ? 'pass' : 'fail') + '">CI · ' + pass + '/' + total + '</span>';
        else if (!rs) res = '<span class="res none">—</span>';
        else { var ok = rs.every(function (r) { return r.pass; }); res = '<span class="res ' + (ok ? 'pass' : 'fail') + '">' + (ok ? 'PASS' : 'FAIL') + ' · ' + rs.length + '</span>'; }
        return '<tr><td class="id">' + t.need + '</td><td><div class="id">' + t.sr + ' ' + (t.stub ? '<span class="tag stub">STUB</span>' : '') + '</div>' + esc(t.srText) + '</td>' +
          '<td class="id">' + (t.uc.join('<br>') || 'Delivery') + '</td><td><code>' + esc(t.api) + '</code><div style="margin-top:6px"><code>' + esc(t.code) + '</code></div></td><td>' + res + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function showView(v) {
    ['demo', 'arch', 'trace'].forEach(function (k) {
      $('view-' + k).hidden = k !== v;
      $('tab-' + k).setAttribute('aria-selected', String(k === v));
    });
    if (v === 'trace') renderTrace();
    if (v === 'arch') renderContext();
    window.scrollTo({ top: 0 });
  }

  function restart() {
    run = {}; cur = 0; view = 0; focus = 'SR.1'; reqs = [];
    return api('POST', '/api/reset').then(function () { reqs = []; showView('demo'); return render(); });
  }

  // ---------------- wiring ----------------
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var a = t.closest('[data-act]'); if (a && ACTS[a.getAttribute('data-act')]) { a.disabled = true; ACTS[a.getAttribute('data-act')](); return; }
    var st = t.closest('[data-step]'); if (st) { view = +st.getAttribute('data-step'); focus = STEPS[view].srs[0]; render(); return; }
    var f = t.closest('[data-focus]'); if (f) { focus = f.getAttribute('data-focus'); renderLink(); return; }
    var v = t.closest('[data-view]'); if (v) showView(v.getAttribute('data-view'));
  });
  $('btn-restart').addEventListener('click', function () { restart(); });
  $('btn-checks').addEventListener('click', function () { checkResults = window.RescuTechAcceptance.runAll(); renderStats(); renderTrace(); });

  client = window.RescuTechApiClient.create(function (r) { reqs.push(r); });
  reqs = [];
  renderStats();
  client.detect().then(function (mode) {
    var t = $('transport');
    t.className = 'transport ' + mode;
    t.querySelector('span').textContent = mode === 'http' ? 'API · ' + location.host : 'In-page API transport';
    return restart();
  });
})();
