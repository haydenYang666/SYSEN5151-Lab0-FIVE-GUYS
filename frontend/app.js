/*
 * RescuTech front end (Interfaces 1, 3 and 4). Every action calls the S.1 REST API in
 * rescutech-orchestrator/routes.js; no business rules live here.
 *   Operate       — dispatch-console layout: guided UC.1 lane on top (grouped by function F.2.x / asset S.1.x),
 *                   rescue teams on the left, incident map in the centre, the current action and the
 *                   model link / event log on the right.
 *   Architecture  — level-1 IDEF0 (F.2 with mechanisms S.1.1–S.1.5), level-2 IDEF0 (F.2.5 with S.1.5.1–S.1.5.4)
 *                   and the S.1 asset hierarchy; each element links to its code and to the step where it runs.
 *   Traceability  — SRD.1 and S.1.5 CRD requirements to model step, code and checks.
 */
(function () {
  'use strict';

  var A = window.RESCUTECH_ARCH, EL = A.EL;
  var ACTOR = {
    cit: { name: 'Citizen', iface: '<span class="mdl">X.1 · Interface 1 · </span>phone', ab: 'X.1' },
    sys: { name: 'RescuTech', iface: '<span class="mdl">S.1 · </span>system of interest', ab: 'S.1' },
    coord: { name: 'Emergency Coordinator', iface: '<span class="mdl">X.2 · Interface 3 · </span>console', ab: 'X.2' },
    team: { name: 'Rescue Team', iface: '<span class="mdl">X.3 · Interface 4 · </span>tablet', ab: 'X.3' }
  };
  var LOG_ACTOR = { 'Citizen': 'cit', 'RescuTech': 'sys', 'Coordinator': 'coord', 'Rescue Team': 'team' };
  var STEPS = [
    { key: 'report', fn: 'F.2.1', actor: 'cit', title: 'Call', long: 'Call the emergency line' },
    { key: 'structure', fn: 'F.2.2', actor: 'sys', title: 'Structure', long: 'Structure the incident' },
    { key: 'status', fn: 'F.2.3', actor: 'team', title: 'Team status', long: 'Read latest team status' },
    { key: 'recommend', fn: 'F.2.4', actor: 'coord', title: 'Recommend', long: 'Recommend a team' },
    { key: 'approve', fn: 'F.2.5.1', actor: 'coord', title: 'Approve', long: 'Approve the assignment' },
    { key: 'order', fn: 'F.2.5.2', actor: 'team', title: 'Order + ack', long: 'Issue and acknowledge the order' },
    { key: 'final', fn: 'F.2.5.4', actor: 'coord', title: 'Status', long: 'Review dispatch status' }
  ];
  var SAMPLE = {
    location: '412 Fall Creek Dr, Fall Creek, Ithaca',
    description: 'Our car is stuck on a snow-blocked road. Two adults inside, one is shivering badly and may have hypothermia.'
  };
  var CAP = { 'snow-access': 'Snow access', 'medical': 'Medical', 'water-rescue': 'Water rescue' };
  var ZONES = window.IncidentStructurerStub.ZONES;

  var $ = function (id) { return document.getElementById(id); };
  var client, run, cur, view, reqs, logCache = [], checkResults = null;
  var agentInfo = { enabled: false };
  var archMode = 'l1', archSel = 'F.2.5', traceTab = 'sr', miniTab = 'link', modelOn = true;
  try { modelOn = localStorage.getItem('rt-model-view') !== 'off'; } catch (e) { /* storage unavailable */ }
  function applyModel() {
    document.body.classList.toggle('model-off', !modelOn);
    $('btn-model').setAttribute('aria-pressed', String(modelOn));
    if (!modelOn && miniTab === 'link') miniTab = 'log';
    if (modelOn && miniTab === 'log' && !logCache.length) miniTab = 'link';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hm(d) { return d ? new Date(d).toTimeString().slice(0, 8) : ''; }
  function vars(a) { return '--actor:var(--c-' + a + ');--actor-soft:var(--c-' + a + '-soft)'; }
  function api(method, path, body) { return client.call(method, path, body); }
  function toast(msg, kind) {
    $('toasts').innerHTML = ''; var t = document.createElement('div'); t.className = 'toast ' + (kind || 'ok'); t.textContent = msg;
    $('toasts').appendChild(t); setTimeout(function () { t.remove(); }, 2400);
  }

  // ---------------- function state (shared by lane and architecture) ----------------
  function stepFn(i) {
    if (STEPS[i].key === 'order') return run.order ? 'F.2.5.3' : 'F.2.5.2';
    return STEPS[i].fn;
  }
  var DONE = { 'F.2.1': function () { return run.done[0]; }, 'F.2.2': function () { return run.done[1]; }, 'F.2.3': function () { return run.done[2]; },
    'F.2.4': function () { return run.done[3]; }, 'F.2.5.1': function () { return run.done[4]; }, 'F.2.5.2': function () { return !!run.order; },
    'F.2.5.3': function () { return !!run.ackd; }, 'F.2.5.4': function () { return run.done[6]; }, 'F.2.5': function () { return run.done[6]; } };
  function fnState(id) {
    if (run.done[STEPS.length - 1]) return DONE[id] && DONE[id]() ? 'done' : '';
    var active = stepFn(view);
    if (active === id || active.indexOf(id + '.') === 0) return 'active';
    return DONE[id] && DONE[id]() ? 'done' : '';
  }

  // ---------------- guided lane ----------------
  function node(i, last) {
    var s = STEPS[i], st = i === view ? 'cur' : (run.done[i] ? 'done' : '');
    var fid = s.key === 'order' ? 'F.2.5.2–3' : s.fn, asset = s.key === 'order' ? 'S.1.5.2–3' : EL[s.fn].asset;
    return '<button type="button" class="node ' + st + (last ? ' last' : '') + '" data-step="' + i + '" style="' + vars(s.actor) + '"' + (i > cur ? ' disabled' : '') + '>' +
      '<span class="dot">' + (run.done[i] && i !== view ? '✓' : i + 1) + '</span><span class="lbl">' + esc(s.title) + '</span>' +
      '<span class="fn mdl">' + fid + ' · ' + asset + '</span></button>';
  }
  function renderLane() {
    $('lane').innerHTML = '<div class="solo">' + node(0) + '</div><div class="solo">' + node(1) + '</div><div class="solo">' + node(2) + '</div><div class="solo">' + node(3) + '</div>' +
      '<div class="grp" data-label="F.2.5 Manage Dispatch Orders · S.1.5 Dispatch Management Subsystem">' + node(4) + node(5) + node(6, true) + '</div>';
  }

  // ---------------- teams panel ----------------
  function teamsNow() {
    var base = run.teams || window.ResourceRegistryStub.initialTeams();
    return base.map(function (t) {
      var avail = run.avail && run.avail[t.id] !== undefined ? run.avail[t.id] : t.available;
      return { id: t.id, name: t.name, zoneKey: t.zoneKey, available: avail, capabilities: t.capabilities };
    });
  }
  function editable() { return STEPS[view].key === 'status' && !run.done[2]; }
  function renderUnits() {
    var teams = teamsNow(), rec = run.rec, ed = editable();
    var alt = {}; if (rec) rec.alternatives.forEach(function (a) { alt[a.teamId] = a; });
    $('units-panel').classList.toggle('editable', ed);
    $('units-sum').textContent = teams.filter(function (t) { return t.available; }).length + '/' + teams.length + ' available';
    $('units').innerHTML = teams.map(function (t) {
      var isRec = rec && rec.teamId === t.id, st;
      if (isRec && run.ackd) st = '<span class="st ack">ACKNOWLEDGED</span>';
      else if (isRec && run.order) st = '<span class="st disp">DISPATCHED</span>';
      else if (isRec) st = '<span class="st rec">RECOMMENDED</span>';
      else st = '<span class="st ' + (t.available ? 'av-on">AVAILABLE' : 'av-off">UNAVAILABLE') + '</span>';
      var a = alt[t.id], dist = a && a.distanceKm !== null ? ' · ' + a.distanceKm + ' km' : '';
      var why = a && !isRec && a.excludedBecause.length ? '<div class="why">' + esc(a.excludedBecause.join('; ')) + '</div>' : '';
      var ctl = ed ? '<div class="ctl"><span>Push status</span><label class="switch"><input type="checkbox" data-av="' + t.id + '"' + (t.available ? ' checked' : '') + '><span class="tr"></span></label></div>' : '';
      return '<div class="unit' + (t.available ? '' : ' off') + (isRec ? ' rec' : '') + '"><span class="av">' + t.id.slice(-1) + '</span>' +
        '<div class="nm"><span>' + esc(t.name.replace('Rescue Team ', 'Team ')) + '</span>' + st + '</div>' +
        '<div class="meta">' + esc(ZONES[t.zoneKey].name) + dist + ' · ' + t.capabilities.map(function (c) { return CAP[c]; }).join(', ') + '</div>' + why + ctl + '</div>';
    }).join('');
    $('units-foot').innerHTML = ed ? '<b style="color:var(--c-team)">Your turn:</b> switch teams on or off, then send the replies.' :
      '<span class="mdl">Status source: <code>resource-status-source/</code> <span class="tag stub">STUB</span></span><span class="nomdl">Latest status pushed by each team.</span>';
  }

  // ---------------- map ----------------
  function P(z) { return { x: 40 + (z.x + 5) * 26, y: 440 - (z.y + 3) * 26 }; }
  function renderMap() {
    var inc = run.incident, zoneHit = inc && inc.zone ? inc.zone.name : null;
    var s = '<rect class="m-land" x="-400" y="-300" width="1420" height="1070"/>';
    for (var gx = -360; gx < 1000; gx += 40) s += '<line class="m-grid" x1="' + gx + '" y1="-300" x2="' + gx + '" y2="770"/>';
    for (var gy = -280; gy < 770; gy += 40) s += '<line class="m-grid" x1="-400" y1="' + gy + '" x2="1020" y2="' + gy + '"/>';
    s += '<path class="m-county" d="M40 28 L590 36 L600 150 L592 300 L606 446 L360 452 L48 444 L34 260 Z"/>';
    s += '<path class="m-lake" d="M150 305 C140 280 128 230 132 180 C136 120 150 70 160 30 L182 30 C176 80 168 140 166 190 C164 240 170 280 160 305 Z"/>' +
      '<text class="m-lakelab" x="118" y="140" transform="rotate(-82 118 140)">Cayuga Lake</text>';
    s += '<path class="m-road" d="M36 236 Q120 318 170 362 T380 446"/><path class="m-road" d="M170 362 Q350 342 534 323 L600 316"/>' +
      '<path class="m-road" d="M186 326 Q204 200 196 63 L200 34"/>' +
      '<text class="m-roadlab" x="58" y="246">13</text><text class="m-roadlab" x="420" y="330">79</text><text class="m-roadlab" x="206" y="200">34</text>' +
      '<text class="m-town" x="62" y="420">TOMPKINS COUNTY</text>';
    Object.keys(ZONES).forEach(function (k) {
      var z = ZONES[k], p = P(z), hit = zoneHit === z.name;
      s += '<circle class="m-zone' + (hit ? ' hit' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="22"/>';
      var LP = { downtown: [-30, 22, 'end'], collegetown: [26, 26, 'start'], 'fall creek': [30, -2, 'start'] }[k] || [0, 38, 'middle'];
      s += '<text class="m-zlab" x="' + (p.x + LP[0]) + '" y="' + (p.y + LP[1]) + '" text-anchor="' + LP[2] + '">' + esc(z.name) + '</text>';
    });
    var teams = teamsNow(), rec = run.rec && run.rec.teamId, ip = inc && inc.zone ? P(inc.zone) : null;
    var OFF = { downtown: [-14, 6], collegetown: [12, 8], 'fall creek': [16, -16], 'route 13': [0, -10], lansing: [0, -10], dryden: [0, -10] };
    var pos = {};
    teams.forEach(function (t) { var p = P(ZONES[t.zoneKey]), o = OFF[t.zoneKey] || [0, 0]; pos[t.id] = { x: p.x + o[0], y: p.y + o[1] }; });
    if (ip && rec && run.order) {
      var a = pos[rec], mx = (a.x + ip.x) / 2 + 40, my = (a.y + ip.y) / 2;
      s += '<path class="m-route' + (run.ackd ? ' ack' : '') + '" d="M' + a.x + ' ' + a.y + ' Q' + mx + ' ' + my + ' ' + ip.x + ' ' + ip.y + '"/>';
    }
    if (ip) {
      s += '<circle class="m-pulse" cx="' + ip.x + '" cy="' + ip.y + '" r="26"/>' +
        '<g class="m-pin"><path d="M' + ip.x + ' ' + ip.y + ' c-11 -14 -14 -20 -14 -26 a14 14 0 0 1 28 0 c0 6 -3 12 -14 26z"/><circle cx="' + ip.x + '" cy="' + (ip.y - 26) + '" r="5" fill="#fff"/></g>';
    }
    teams.forEach(function (t) {
      var p = pos[t.id], col = t.available ? 'var(--c-team)' : '#a3adbb';
      if (rec === t.id && run.order && !run.ackd) col = 'var(--c-coord)';
      s += '<g class="m-team">' + (rec === t.id ? '<circle class="m-ring" cx="' + p.x + '" cy="' + p.y + '" r="19"/>' : '') +
        '<circle class="b" cx="' + p.x + '" cy="' + p.y + '" r="13" style="fill:' + col + '"/>' +
        '<text class="i" x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle">' + t.id.slice(-1) + '</text>' +
        (rec === t.id ? '<text class="lab" x="' + (p.x + 22) + '" y="' + (p.y + 4) + '">' + esc(t.name) + '</text>' : '') + '</g>';
    });
    $('map').innerHTML = s;

    var dist = run.rec && run.rec.teamId ? run.rec.alternatives.filter(function (x) { return x.teamId === run.rec.teamId; })[0].distanceKm : null;
    var disp = run.ackd ? ['Acknowledged', 'ok'] : run.order ? ['Order sent', ''] : run.approval ? ['Approved', ''] : run.rec ? (run.rec.teamId ? ['Awaiting approval', ''] : ['No match', 'hi']) : ['—', ''];
    function c(label, v, cls) { return '<div class="mchip"><span>' + label + '</span><b class="' + (cls || '') + '">' + v + '</b></div>'; }
    $('metrics').innerHTML =
      c('Incident', inc ? esc(inc.zone ? inc.zone.name : 'Area not determined') : (run.report ? 'Report received' : 'Waiting for report')) +
      c('Urgency', inc ? esc(inc.urgency) : '—', inc && inc.urgency === 'High' ? 'hi' : '') +
      c('People', inc && inc.peopleCount ? inc.peopleCount : '—') +
      c('Nearest suitable', dist !== null ? dist + ' km' : '—') +
      c('Dispatch', disp[0], disp[1]);
  }

  // ---------------- action card ----------------
  function kv(inc) {
    function v(x) { return x ? esc(x) : '<span class="miss">Missing</span>'; }
    return '<dl class="kv"><dt>Location</dt><dd>' + v(inc.location) + '</dd><dt>Area</dt><dd>' + v(inc.zone && inc.zone.name) + '</dd>' +
      '<dt>Assistance</dt><dd>' + v(inc.assistanceNeeded) + '</dd><dt>Needs</dt><dd>' +
      (inc.requiredCapabilities.map(function (c) { return '<span class="chip">' + CAP[c] + '</span>'; }).join('') || '<span class="miss">Missing</span>') +
      '</dd><dt>People</dt><dd>' + v(inc.peopleCount) + '</dd><dt>Urgency</dt><dd>' + esc(inc.urgency) + '</dd></dl>';
  }
  function btn(label, act, cls) { return '<button type="button" class="btn ' + (cls || 'go') + '" data-act="' + act + '">' + label + '</button>'; }
  function acts() { return '<div class="acts">' + [].slice.call(arguments).join('') + '</div>'; }
  var NEXT = function (l) { return acts(btn((l || 'Next step') + ' →', 'next', 'primary')); };

  // Each screen returns [body, footer]; the footer always holds the one primary action.
  var SCREENS = {
    report: function (done) {
      var r = run.report;
      return ['<p class="say">A resident caught in the storm calls the emergency line. The AI voice intake agent answers at once, so there is no call queue, and transcribes the call.' +
        '<span class="hint" style="display:block;margin-top:4px">Prototype: the call is entered as its transcript (no speech recognition yet).</span></p>' +
        '<div class="field"><label for="f-loc">Where are you? (from the call)</label><input id="f-loc" type="text" autocomplete="off" value="' + esc(r ? r.location : SAMPLE.location) + '"' + (done ? ' disabled' : '') + '></div>' +
        '<div class="field"><label for="f-desc">Call transcript: what help do you need?</label><textarea id="f-desc"' + (done ? ' disabled' : '') + '>' + esc(r ? r.description : SAMPLE.description) + '</textarea></div>' +
        '<div id="form-err" class="note warn" hidden></div>' +
        (done ? '<div class="note ok"><b>Report ' + r.id + ' registered and read back to the caller</b>' + esc(run.receipt.message) + '</div>' : ''),
        done ? NEXT() : acts(btn('Place call', 'submit'))];
    },
    structure: function (done) {
      var inc = run.incident;
      if (done && inc.manual) return ['<p class="quote">“' + esc(run.report.description) + '”</p>' +
        '<div class="note bad"><b>Manual handling<span class="mdl"> (SyRD 2.3.1, 2.3.3)</span></b>' + esc(inc.error) +
        '. The agent’s output was withheld, so the coordinator handles this report by hand.</div>',
        '<div class="note"><b>Nothing was dispatched</b>Restart to try another report.</div>'];
      var ai = inc && /Claude/.test(inc.source || '');
      return ['<p class="say">' + (agentInfo.enabled ? 'The <b>Claude rescue agent</b> reads the free text and fills a structured incident' : 'The free text becomes a structured incident') +
        '. Anything it cannot determine is <b>flagged, never guessed</b>.</p>' +
        '<p class="quote">“' + esc(run.report.description) + '”</p>' +
        (done ? '<div><span class="cap">Structured incident ' + (ai ? '<span class="tag ai">CLAUDE AGENT</span>' : '<span class="tag stub mdl">STUB</span>') + '</span>' + kv(inc) + '</div>' +
          (inc.missing.length ? '<div class="note warn"><b>Flagged as missing</b>' + esc(inc.missing.join(', ')) + '</div>' : '<div class="note ok"><b>All fields determined</b>No guesses were needed.</div>') : ''),
        done ? NEXT() : acts(btn('Structure incident', 'structure'))];
    },
    status: function (done) {
      var teams = teamsNow(), n = teams.filter(function (t) { return t.available; }).length;
      return ['<p class="say">Rescue teams push their status whenever it changes<span class="mdl"> (UC.1.6)</span>. RescuTech reads the latest status<span class="mdl"> (UC.1.5)</span> without waiting for replies, and asks only teams whose status is stale to refresh<span class="mdl"> (IO.3)</span>.</p>' +
        '<div class="big-num"><b>' + n + '/' + teams.length + '</b><span class="hint">teams currently report “available”</span></div>' +
        (done ? '<div class="note ok"><b>Latest status of ' + run.teams.length + ' teams used</b>' +
                (run.stale && run.stale.length ? 'Refresh requested from ' + esc(run.stale.join(', ')) + '; dispatch did not wait.' : 'No status was stale, so no refresh was needed.') + '</div>'
              : '<div class="note"><b>Try it</b>Switch a team off in the <span class="em">Rescue teams</span> list: that is the team pushing a new status.</div>'),
        done ? NEXT() : acts(btn('Read latest team status', 'status'))];
    },
    recommend: function (done) {
      var rec = run.rec;
      if (!done) return ['<p class="say">RescuTech matches the incident against availability, capability and distance, and explains its choice.</p>', acts(btn('Generate recommendation', 'recommend'))];
      return ['<p class="say">One recommended team, <b>with its reasons</b>. The coordinator decides.</p>' +
        '<div class="reco"><span class="cap">Recommended team <span class="tag stub mdl">' + (rec.briefing ? 'RULE-BASED CHOICE' : 'STUB · rule-based') + '</span></span><p class="nm">' + esc(rec.teamName || 'No suitable team') + '</p><ul>' +
        rec.rationale.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' +
        (rec.briefing ? '<div class="note ai"><b>AI briefing <span class="tag ai">CLAUDE</span></b>' + esc(rec.briefing) +
          '<span class="hint" style="display:block;margin-top:4px">The team is chosen by fixed rules; the agent only explains it.</span></div>' : '') +
        '<p class="hint" style="margin:0">Excluded teams show their reason in the teams list.</p>',
        rec.teamId ? NEXT('Go to approval') : '<div class="note warn"><b>No match</b>Restart and switch more teams on.</div>'];
    },
    approve: function (done) {
      var rec = run.rec;
      return ['<p class="say">' + '<b class="mdl">S.1.5.1 Dispatch Authorization Module</b><b class="nomdl">RescuTech</b> compiles an order only for an assignment the coordinator approved. Try sending without approval first.</p>' +
        '<div class="note"><b>' + esc(rec.teamName) + ' → ' + esc(run.incident.location) + '</b>' + esc(run.incident.assistanceNeeded || '') + '</div>' +
        (run.guard ? '<div class="note bad"><b>409 · blocked<span class="mdl"> (SR.6, CRD 2.1.1)</span></b>' + esc(run.guard).replace(/\s*\((SR\.\d+)\)/g, '<span class="mdl"> ($1)</span>') + '</div>' : '') +
        (done ? '<div class="note ok"><b>Approved · ' + run.approval.id + '</b>' + esc(rec.teamName) + ' approved at ' + hm(run.approval.at) + '.</div>' : ''),
        done ? NEXT() : acts(btn('Send without approval', 'unapproved', 'danger'), btn('Approve ' + esc(rec.teamName.replace('Rescue Team ', '')), 'approve'))];
    },
    order: function (done) {
      var o = run.order;
      if (!o) return ['<p class="say">' + '<b class="mdl">S.1.5.2 Order Transmission Module</b><b class="nomdl">RescuTech</b> sends the approved order to the assigned team and records it.</p>', acts(btn('Issue dispatch order', 'issue'))];
      return ['<p class="say">' + '<b class="mdl">S.1.5.3 Acknowledgment Verification Module</b><b class="nomdl">RescuTech</b> accepts the receipt only from the assigned team.</p>' +
        '<div class="order"><div class="top"><span>DISPATCH ORDER ' + o.id + '</span><span>' + esc(o.urgency).toUpperCase() + '</span></div><div class="bd">' +
        '<span class="cap">Go to</span><p class="loc">' + esc(o.location) + '</p><span class="cap">Task</span><p class="task">' + esc(o.task) + '</p>' +
        '<dl class="kv"><dt>Team</dt><dd>' + esc(o.teamName) + '</dd><dt>Approval</dt><dd>' + o.approvalId + ' · sent ' + hm(o.issuedAt) + '</dd></dl></div></div>' +
        (run.wrongAck ? '<div class="note bad"><b>409 · rejected<span class="mdl"> (CRD 2.4.2)</span></b>' + esc(run.wrongAck) + '</div>' : '') +
        (done ? '<div class="note ok"><b>Receipt confirmed</b>' + esc(o.teamName) + ' acknowledged at ' + hm(run.ackd.acknowledgedAt) + '.</div>' : ''),
        done ? NEXT('Show status') : acts(btn('Ack as another team', 'wrongack', 'danger'), btn('Acknowledge receipt', 'ack'))];
    },
    final: function () {
      var o = run.ackd || run.order, st = run.status || { code: 'AWAITING_ACK' };
      var used = {}; logCache.forEach(function (e) { e.refs.forEach(function (r) { used[r] = true; }); });
      var ops = window.RESCUTECH_TRACE.filter(function (t) { return t.lane !== 'delivery'; });
      var n = ops.filter(function (t) { return used[t.sr]; }).length;
      function tl(on, what, ref, when) { return '<li class="' + (on ? 'on' : '') + '"><span class="pt"></span><div><b>' + what + '</b><small>' + esc(ref) + '</small></div><span class="when">' + hm(when) + '</span></li>'; }
      return ['<p class="say">' + '<b class="mdl">S.1.5.4 Status Reporting Module</b><b class="nomdl">RescuTech</b>: status comes only from recorded events, so “acknowledged” never appears early.</p>' +
        '<div><span class="pill ' + st.code + '">' + (st.code === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Awaiting acknowledgment') + '</span></div>' +
        '<ol class="tl">' + tl(true, 'Report registered', run.report.id, run.report.registeredAt) + tl(true, 'Assignment approved', run.approval.id, run.approval.at) +
        tl(true, 'Order issued', o.id + ' → ' + o.teamName, o.issuedAt) + tl(!!o.acknowledgedAt, 'Receipt acknowledged', o.teamName, o.acknowledgedAt) + '</ol>' +
        '<div class="note"><b>' + n + '/' + ops.length + ' operational requirements exercised</b>Arrival and rescue are outside the system boundary.</div>',
        acts(btn('Run again', 'restart', ''), btn('Open traceability', 'open-trace', 'primary'))];
    }
  };

  function renderStep() {
    var s = STEPS[view], a = ACTOR[s.actor], out = SCREENS[s.key](!!run.done[view]);
    $('step-card').setAttribute('style', vars(s.actor));
    $('step-top').innerHTML = '<span class="role">' + a.ab + '</span><div class="who"><b>' + esc(s.long) + '</b><span>' + a.name + ' · ' + a.iface + '</span></div>' +
      '<span class="count">' + (view + 1) + ' / ' + STEPS.length + '</span>';
    $('stage').innerHTML = out[0];
    $('foot').innerHTML = out[1];
  }

  // ---------------- model link / log / API tabs ----------------
  function linkHtml() {
    var id = stepFn(view), e = EL[id], as = EL[e.asset], parent = id.length > 5 ? EL[id.slice(0, 5)] : null;
    var ucs = e.uc.replace(/–/g, '-').split('-'), from = +ucs[0].split('.')[2], to = ucs[1] ? +ucs[1].split('.')[2] : from, ucl = [];
    for (var n = from; n <= to; n++) ucl.push('<b class="id">UC.1.' + n + '</b>' + esc(A.UC_NAMES['UC.1.' + n]));
    return '<div class="link">' +
      '<div class="row"><span class="k">Function</span><div><b class="id">' + id + '</b>' + esc(e.name) + (parent ? '<div class="sub">within ' + parent.id + ' ' + esc(parent.name) + '</div>' : '') + '</div></div>' +
      '<div class="row"><span class="k">Performed by</span><div><b class="id" style="color:var(--c-sys)">' + as.id + '</b>' + esc(as.name) + '</div></div>' +
      '<div class="row"><span class="k">Use case</span><div>' + ucl.join('<br>') + '</div></div>' +
      '<div class="row"><span class="k">Requirements</span><div class="req-list">' + e.srs.map(function (r) { return '<span>' + r + '</span>'; }).join('') +
        (e.crd || []).map(function (r) { return '<span class="crd">CRD ' + r + '</span>'; }).join('') + '</div></div>' +
      '<div class="row"><span class="k">Code ' + (e.stub ? '<span class="tag stub">STUB</span>' : '<span class="tag real">REAL</span>') + '</span><div><code>' + esc(e.code) + '</code><div class="sub" style="margin-top:4px">' + esc(e.fns) + '</div><div class="sub mono">' + esc(e.api) + '</div></div></div>' +
      '<div class="row"><span class="k"></span><div><button type="button" class="btn sm" data-arch="' + id + '">Show ' + id + ' in the IDEF0 →</button></div></div></div>';
  }
  function logHtml() {
    if (!logCache.length) return '<ul class="feed"><li class="empty">Events appear here as the use case runs.</li></ul>';
    return '<ul class="feed">' + logCache.slice().reverse().map(function (e) {
      var a = LOG_ACTOR[e.actor] || 'sys', blk = e.kind === 'block';
      return '<li class="' + (blk ? 'block' : '') + '"><span class="t">' + hm(e.time) + '</span><span class="d" style="background:var(--c-' + a + ')"></span>' +
        '<div><span class="uc mdl">' + A.ucModel(e.uc) + '</span><span class="' + (blk ? 'x' : '') + '">' + esc(e.text) + '</span></div></li>';
    }).join('') + '</ul>';
  }
  function apiHtml() {
    return '<ol class="reqs">' + (reqs.length ? reqs.slice().reverse().map(function (r) {
      return '<li><span class="m">' + r.method + '</span><span class="p" title="' + esc(r.path) + '">' + esc(r.path) + '</span><span class="s ' + (r.status < 400 ? 'ok' : 'bad') + '">' + r.status + '</span></li>';
    }).join('') : '<li class="empty">No requests yet.</li>') + '</ol>';
  }
  function renderTabs() {
    $('n-log').textContent = logCache.length; $('n-api').textContent = reqs.length;
    [].forEach.call(document.querySelectorAll('#mtabs button'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-mt') === miniTab)); });
    $('tab-body').innerHTML = miniTab === 'log' ? logHtml() : miniTab === 'api' ? apiHtml() : linkHtml();
  }

  function render() {
    renderLane(); renderUnits(); renderMap(); renderStep(); renderTabs();
    return client.log().then(function (l) { logCache = l; renderTabs(); if (STEPS[view].key === 'final') renderStep(); });
  }
  function finish(msg) { run.done[view] = true; if (msg) toast(msg); return render(); }
  function goStep(i) {
    if (STEPS[i] && STEPS[i].key === 'final' && !run.status) {
      return api('GET', '/api/dispatch-orders/' + run.order.id + '/status').then(function (r) {
        run.status = r.body; run.done[i] = true; cur = Math.max(cur, i); view = i; return render();
      });
    }
    cur = Math.max(cur, i); view = i; return render();
  }

  // ---------------- actions (each = one API call = one sequence message group) ----------------
  var ACTS = {
    next: function () { return goStep(view + 1); },
    submit: function () {
      return api('POST', '/api/distress-reports', { location: $('f-loc').value, transcript: $('f-desc').value, channel: 'voice' }).then(function (r) {
        if (r.status !== 201) { $('form-err').textContent = r.body.error; $('form-err').hidden = false; renderStep(); renderTabs(); return; }
        run.report = r.body.report; run.receipt = r.body.receipt; return finish('Report ' + run.report.id + ' registered');
      });
    },
    structure: function () {
      return api('POST', '/api/distress-reports/' + run.report.id + '/incident').then(function (r) {
        if (r.status !== 201) { run.incident = { manual: true, error: r.body.error || 'Structuring failed' }; return finish('Sent to manual handling'); }
        run.incident = r.body; return finish('Incident ' + r.body.id + ' structured');
      });
    },
    status: function () {
      var teams = teamsNow();
      // UC.1.6: teams whose switch was changed push their new status; then UC.1.5 reads the latest status.
      return teams.reduce(function (p, t) {
        return p.then(function () { return api('PUT', '/api/teams/' + t.id + '/status', { available: t.available, zoneKey: t.zoneKey, capabilities: t.capabilities }); });
      }, Promise.resolve()).then(function () {
        return api('POST', '/api/incidents/' + run.incident.id + '/status-requests');
      }).then(function (r) { run.stale = (r.body && r.body.staleTeamIds) || []; return api('GET', '/api/teams'); })
        .then(function (r) { run.teams = r.body; run.avail = null; return finish('Latest status of ' + teams.length + ' teams read'); });
    },
    recommend: function () {
      return api('POST', '/api/incidents/' + run.incident.id + '/recommendation').then(function (r) { run.rec = r.body; return finish(r.body.teamId ? r.body.teamName + ' recommended' : 'No suitable team'); });
    },
    unapproved: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/dispatch-order').then(function (r) {
        run.guard = r.status === 409 ? r.body.error + ' No order was sent.' : null; toast('Blocked: no coordinator approval', 'bad'); return render();
      });
    },
    approve: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/approval', { by: 'Coordinator on duty' }).then(function (r) {
        run.approval = r.body; run.guard = null; return finish('Assignment approved · ' + r.body.id);
      });
    },
    issue: function () {
      return api('POST', '/api/recommendations/' + run.rec.id + '/dispatch-order').then(function (r) { run.order = r.body; toast('Order ' + r.body.id + ' sent to ' + r.body.teamName); return render(); });
    },
    wrongack: function () {
      var other = teamsNow().filter(function (t) { return t.id !== run.order.teamId; })[0];
      return api('POST', '/api/dispatch-orders/' + run.order.id + '/acknowledgment', { teamId: other.id }).then(function (r) {
        run.wrongAck = r.status >= 400 ? other.name + ': ' + r.body.error : null; toast('Rejected: not the assigned team', 'bad'); return render();
      });
    },
    ack: function () {
      return api('POST', '/api/dispatch-orders/' + run.order.id + '/acknowledgment', { teamId: run.order.teamId }).then(function (r) {
        run.ackd = r.body; run.wrongAck = null; return finish('Receipt acknowledged by ' + r.body.teamName);
      });
    },
    'open-trace': function () { showView('trace'); },
    restart: restart
  };

  // ---------------- architecture ----------------
  var MARK = '<defs>' + [['ahg', '#8a95a8'], ['ahc', '#6c4fd8'], ['ahm', '#e07a1f'], ['ahk', '#33415a']].map(function (m) {
    return '<marker id="' + m[0] + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="' + m[1] + '"/></marker>';
  }).join('') + '</defs>';
  function arrow(d, cls) { var mk = { ext: 'ahg', ctl: 'ahc', mech: 'ahm' }[cls] || 'ahk'; return '<path class="d-arrow ' + (cls || '') + '" d="' + d + '" marker-end="url(#' + mk + ')"/>'; }
  function lab(x, y, t, cls, anchor) { return '<text class="d-lab ' + (cls || '') + '" x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + t + '</text>'; }
  function wrap(t, max) {
    var lines = [''];
    t.split(' ').forEach(function (w) { var l = lines[lines.length - 1]; if ((l + ' ' + w).trim().length > max) lines.push(w); else lines[lines.length - 1] = (l + ' ' + w).trim(); });
    return lines;
  }
  function fbox(id, x, y, w, h) {
    var e = EL[id], st = fnState(id), lines = wrap(e.name, w > 190 ? 24 : 21);
    return '<g class="d-box' + (archSel === id ? ' sel' : '') + (st === 'done' ? ' done' : '') + '" data-sel="' + id + '"><rect class="b" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/>' +
      '<rect class="st" x="' + (x + w - 16) + '" y="' + (y + 8) + '" width="8" height="8" rx="4"/>' +
      '<text class="num" x="' + (x + 12) + '" y="' + (y + 20) + '">' + id + '</text>' +
      lines.map(function (l, i) { return '<text class="nm" x="' + (x + 12) + '" y="' + (y + 40 + i * 17) + '">' + esc(l) + '</text>'; }).join('') + '</g>';
  }
  function mech(id, x, y, w, h) {
    var a = EL[EL[id].asset], cx = x + w / 2;
    return arrow('M' + cx + ' ' + (y + h + 34) + ' V' + (y + h + 2), 'mech') +
      '<text class="d-mech" x="' + (cx + 6) + '" y="' + (y + h + 28) + '">' + a.id + '</text>' +
      '<text class="d-mech sm" x="' + cx + '" y="' + (y + h + 48) + '" text-anchor="middle">' + esc(a.name.replace(' Subsystem', '').replace(' Module', '')) + '</text>';
  }
  function diagL1() {
    var W = 170, H = 74, X = function (i) { return 100 + i * 194; }, Y = function (i) { return 52 + i * 88; };
    var s = MARK;
    function flow(i, j, yo, label) {
      var x1 = X(i) + W, y1 = Y(i) + yo, vx = X(j) - 12;
      return arrow('M' + x1 + ' ' + y1 + ' H' + vx + ' V' + (Y(j) + 30) + ' H' + (X(j) - 1)) + lab(x1 + 4, y1 - 5, label);
    }
    s += flow(0, 1, 30, 'IO.10') + flow(1, 2, 30, 'IO.11') + flow(2, 3, 30, 'IO.13') + flow(3, 4, 30, 'IO.14');
    s += arrow('M' + (X(1) + W) + ' ' + (Y(1) + 56) + ' H' + (X(3) - 5) + ' V' + (Y(3) + 56) + ' H' + (X(3) - 1)) + lab(X(2) + 60, Y(1) + 51, 'IO.12');
    s += arrow('M' + (X(0) - 70) + ' ' + (Y(0) + 52) + ' H' + (X(0) - 1), 'ext') + lab(X(0) - 70, Y(0) + 46, 'IO.1', 'ext');
    s += arrow('M' + (X(2) - 62) + ' ' + (Y(2) + 56) + ' H' + (X(2) - 1), 'ext') + lab(X(2) - 64, Y(2) + 70, 'IO.4', 'ext', 'start');
    s += arrow('M' + (X(4) - 62) + ' ' + (Y(4) + 58) + ' H' + (X(4) - 1), 'ext') + lab(X(4) - 64, Y(4) + 72, 'IO.8', 'ext', 'start');
    [[0, 'IO.2 → X.1'], [2, 'IO.3 → X.3'], [3, 'IO.5 → X.2']].forEach(function (o) {
      s += arrow('M' + (X(o[0]) + 40) + ' ' + Y(o[0]) + ' V' + (Y(o[0]) - 26), 'ext') + lab(X(o[0]) + 46, Y(o[0]) - 12, o[1], 'ext');
    });
    s += arrow('M' + (X(4) + 60) + ' ' + (Y(4) - 34) + ' V' + (Y(4) - 1), 'ctl') + lab(X(4) + 66, Y(4) - 22, 'IO.6 Dispatch Approval', 'ctl');
    s += arrow('M' + (X(4) + W) + ' ' + (Y(4) + 24) + ' H' + (X(4) + W + 46), 'ext') + lab(X(4) + W + 6, Y(4) + 18, 'IO.7 → X.3', 'ext');
    s += arrow('M' + (X(4) + W) + ' ' + (Y(4) + 54) + ' H' + (X(4) + W + 46), 'ext') + lab(X(4) + W + 6, Y(4) + 48, 'IO.9 → X.2', 'ext');
    ['F.2.1', 'F.2.2', 'F.2.3', 'F.2.4', 'F.2.5'].forEach(function (id, i) { s += fbox(id, X(i), Y(i), W, H) + mech(id, X(i), Y(i), W, H); });
    return { svg: s, vb: '20 10 1110 560', hint: 'Click a function for its asset, code and requirements' };
  }
  function diagL2() {
    var W = 210, H = 78, X = function (i) { return 110 + i * 232; }, Y = function (i) { return 66 + i * 98; };
    var s = MARK;
    function flow(i, j, label) {
      var x1 = X(i) + W, y1 = Y(i) + 30, vx = X(j) - 12;
      return arrow('M' + x1 + ' ' + y1 + ' H' + vx + ' V' + (Y(j) + 30) + ' H' + (X(j) - 1)) + lab(x1 + 4, y1 - 5, label);
    }
    s += flow(0, 1, 'IO.15') + flow(1, 2, 'IO.16') + flow(2, 3, 'IO.17');
    s += arrow('M' + (X(0) - 80) + ' ' + (Y(0) + 30) + ' H' + (X(0) - 1)) + lab(X(0) - 78, Y(0) + 24, 'IO.14', '') +
      '<text class="d-lab" x="' + (X(0) - 78) + '" y="' + (Y(0) + 46) + '" style="fill:#6b778c">from F.2.4</text>';
    s += arrow('M' + (X(0) + 70) + ' ' + (Y(0) - 40) + ' V' + (Y(0) - 1), 'ctl') + lab(X(0) + 76, Y(0) - 26, 'IO.6 Dispatch Approval (X.2)', 'ctl');
    s += arrow('M' + (X(2) - 70) + ' ' + (Y(2) + 58) + ' H' + (X(2) - 1), 'ext') + lab(X(2) - 72, Y(2) + 74, 'IO.8 (X.3)', 'ext', 'start');
    s += arrow('M' + (X(1) + 150) + ' ' + Y(1) + ' V' + (Y(1) - 30), 'ext') + lab(X(1) + 156, Y(1) - 16, 'IO.7 Dispatch Order → X.3', 'ext');
    s += arrow('M' + (X(3) + W) + ' ' + (Y(3) + 40) + ' H' + (X(3) + W + 50), 'ext') + lab(X(3) + W + 6, Y(3) + 34, 'IO.9 → X.2', 'ext');
    ['F.2.5.1', 'F.2.5.2', 'F.2.5.3', 'F.2.5.4'].forEach(function (id, i) { s += fbox(id, X(i), Y(i), W, H) + mech(id, X(i), Y(i), W, H); });
    return { svg: s, vb: '20 20 1090 500', hint: 'F.2.5 Manage Dispatch Orders · performed by S.1.5' };
  }
  function diagHier() {
    var s = '';
    function nd(id, x, y, w, cls) {
      var e = EL[id], lines = wrap(e.name, w > 200 ? 30 : 20);
      return '<g class="d-node ' + (cls || '') + (archSel === id ? ' sel' : '') + '" data-sel="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="62" rx="10"/>' +
        '<text class="num" x="' + (x + 12) + '" y="' + (y + 19) + '">' + id + '</text>' +
        lines.slice(0, 2).map(function (l, i) { return '<text class="nm" x="' + (x + 12) + '" y="' + (y + 37 + i * 15) + '">' + esc(l) + '</text>'; }).join('') + '</g>';
    }
    var l1 = ['S.1.1', 'S.1.2', 'S.1.3', 'S.1.4', 'S.1.5'], l2 = ['S.1.5.1', 'S.1.5.2', 'S.1.5.3', 'S.1.5.4'];
    var cx = function (i) { return 20 + i * 214; }, gx = function (i) { return 330 + i * 196; };
    s += '<path class="d-edge" d="M550 86 V112 H' + (cx(0) + 95) + ' M550 112 H' + (cx(4) + 95) + '"/>';
    l1.forEach(function (id, i) { s += '<path class="d-edge" d="M' + (cx(i) + 95) + ' 112 V130"/>'; });
    s += '<path class="d-edge" d="M' + (cx(4) + 95) + ' 192 V222 H' + (gx(0) + 90) + ' M' + (cx(4) + 95) + ' 222 H' + (gx(3) + 90) + '"/>';
    l2.forEach(function (id, i) { s += '<path class="d-edge" d="M' + (gx(i) + 90) + ' 222 V240"/>'; });
    s += nd('S.1', 410, 24, 280, 'l0');
    l1.forEach(function (id, i) { s += nd(id, cx(i), 130, 190, id === 'S.1.5' ? 'focus' : ''); });
    l2.forEach(function (id, i) { s += nd(id, gx(i), 240, 180, 'focus'); });
    return { svg: s, vb: '0 0 1100 320', hint: 'Three levels: S.1 → S.1.1–S.1.5 → S.1.5.1–S.1.5.4' };
  }
  function renderArch() {
    var d = archMode === 'l1' ? diagL1() : archMode === 'l2' ? diagL2() : diagHier();
    $('diag').setAttribute('viewBox', d.vb); $('diag').innerHTML = d.svg; $('diag-hint').textContent = d.hint;
    $('d-legend').innerHTML = archMode === 'hier' ? '<span>Highlighted: the S.1.5 branch decomposed to level 2</span>' :
      '<span><i style="border-color:#33415a"></i>Internal I/O</span><span><i style="border-color:#8a95a8;border-top-style:dashed"></i>External I/O</span>' +
      '<span><i style="border-color:#6c4fd8"></i>Control</span><span><i style="border-color:#e07a1f"></i>Mechanism (asset)</span><span><i style="border-color:#23945a;border-top-width:8px;width:8px;border-radius:4px"></i>Done in this run</span>';
    [].forEach.call(document.querySelectorAll('#arch-seg button'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-diag') === archMode)); });
    renderDetail();
  }
  function renderDetail() {
    var e = EL[archSel], isFn = e.kind === 'Function', other = EL[isFn ? e.asset : e.fn], f = isFn ? e : other;
    var rows = [];
    if (f.inputs) rows.push(['Inputs', esc(f.inputs)]);
    if (f.control) rows.push(['Control', esc(f.control)]);
    if (f.outputs) rows.push(['Outputs', esc(f.outputs)]);
    if (!isFn && e.conduits) rows.push(['Conduits', esc(e.conduits)]);
    if (f.uc) rows.push(['Use case', f.uc]);
    if (f.srs) rows.push(['Req.', '<div class="req-list">' + f.srs.map(function (r) { return '<span>' + r + '</span>'; }).join('') + (f.crd || []).map(function (r) { return '<span class="crd">CRD ' + r + '</span>'; }).join('') + '</div>']);
    if (f.code) rows.push(['Code', '<code>' + esc(f.code) + '</code><div class="hint" style="margin-top:4px">' + esc(f.fns) + '</div>']);
    if (f.api) rows.push(['API', '<span class="mono" style="font-size:12px">' + esc(f.api) + '</span>']);
    var kids = Object.keys(EL).filter(function (k) { return k.indexOf(archSel + '.') === 0 && k.split('.').length === archSel.split('.').length + 1; });
    $('detail').innerHTML = '<span class="kind">' + esc(e.kind) + '</span><h3><span class="mono" style="font-size:15px;color:var(--muted)">' + e.id + '</span><br>' + esc(e.name) + '</h3>' +
      '<p>' + esc(e.desc || '') + '</p>' +
      (other ? '<div class="pair"><span class="ic">' + (isFn ? 'S' : 'F') + '</span><div><span class="hint">' + (isFn ? 'Performed by' : 'Performs') + '</span><br><b class="mono" style="font-size:12.5px">' + other.id + '</b> ' + esc(other.name) + '</div></div>' : '') +
      (rows.length ? '<dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' : '') +
      (kids.length ? '<div><span class="cap">Decomposes into</span><div class="req-list">' + kids.map(function (k) { return '<span style="cursor:pointer" data-sel="' + k + '">' + k + '</span>'; }).join('') + '</div></div>' : '') +
      (f.step !== undefined ? '<button type="button" class="btn primary" data-runstep="' + f.step + '">See ' + f.id + ' run in the product →</button>' : '');
  }
  function openArch(id) {
    archSel = id;
    archMode = /^F\.2\.5\.|^S\.1\.5\./.test(id) ? 'l2' : 'l1';
    showView('arch');
  }

  // ---------------- traceability ----------------
  function renderTrace() {
    var bySr = {};
    (checkResults || []).forEach(function (r) { (bySr[r.sr] = bySr[r.sr] || []).push(r); });
    var pass = (checkResults || []).filter(function (r) { return r.pass; }).length, total = (checkResults || []).length;
    var shown = A.CRD.filter(function (c) { return A.CRD_PROTO[c[0]][0] === 'shown'; }).length;
    function cov(v, of, label) { var pct = of ? Math.round(v / of * 100) : 0; return '<div class="cov"><b>' + v + '/' + of + '</b><span>' + label + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>'; }
    $('coverage').innerHTML = cov(12, 12, 'system requirements traced to a UC step or deliverable') + cov(pass, total, 'acceptance checks passing') + cov(shown, A.CRD.length, 'S.1.5 CRD requirements shown in the prototype');
    [].forEach.call(document.querySelectorAll('#trace-seg button'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tt') === traceTab)); });
    if (traceTab === 'crd') {
      var LBL = { shown: ['pass', 'Shown'], partial: ['none', 'Partial'], planned: ['none', 'Planned'] };
      $('trace').innerHTML = '<thead><tr><th>CRD</th><th>Requirement</th><th>Allocated to</th><th>Verification</th><th>In this prototype</th></tr></thead><tbody>' +
        A.CRD.map(function (c) { var p = A.CRD_PROTO[c[0]];
          return '<tr><td class="id">' + c[0] + '</td><td>' + esc(c[1]) + '</td><td class="id">' + c[2] + '</td><td>' + c[3] + '</td><td><span class="res ' + LBL[p[0]][0] + '">' + LBL[p[0]][1] + '</span><div class="hint" style="margin-top:4px">' + esc(p[1]) + '</div></td></tr>';
        }).join('') + '</tbody>';
      return;
    }
    $('trace').innerHTML = '<thead><tr><th>Need</th><th>Requirement</th><th>UC step (Innoslate)</th><th>API · code</th><th>Check</th></tr></thead><tbody>' +
      window.RESCUTECH_TRACE.map(function (t) {
        var rs = bySr[t.sr], res;
        if (t.sr === 'SR.11') res = '<span class="res none">README review</span>';
        else if (t.sr === 'SR.12') res = '<span class="res ' + (pass === total ? 'pass' : 'fail') + '">CI · ' + pass + '/' + total + '</span>';
        else if (!rs) res = '<span class="res none">—</span>';
        else { var ok = rs.every(function (r) { return r.pass; }); res = '<span class="res ' + (ok ? 'pass' : 'fail') + '">' + (ok ? 'PASS' : 'FAIL') + ' · ' + rs.length + '</span>'; }
        return '<tr><td class="id">' + t.need + '</td><td><div class="id">' + t.sr + ' ' + (t.stub ? '<span class="tag stub">STUB</span>' : '') + '</div>' + esc(t.srText) + '</td>' +
          '<td class="id">' + (t.uc.map(A.ucModel).join('<br>') || 'Delivery') + '</td><td><code>' + esc(t.api) + '</code><div style="margin-top:6px"><code>' + esc(t.code) + '</code></div></td><td>' + res + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function showView(v) {
    ['demo', 'arch', 'trace'].forEach(function (k) {
      $('view-' + k).hidden = k !== v;
      $('tab-' + k).setAttribute('aria-selected', String(k === v));
    });
    $('main').className = v === 'demo' ? 'ops-main' : '';
    if (v === 'trace') renderTrace();
    if (v === 'arch') renderArch();
    window.scrollTo({ top: 0 });
  }

  function restart() {
    run = { done: {} }; cur = 0; view = 0; reqs = []; miniTab = modelOn ? 'link' : 'log';
    return api('POST', '/api/reset').then(function () { reqs = []; showView('demo'); return render(); });
  }

  // ---------------- wiring ----------------
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var a = t.closest('[data-act]'); if (a && ACTS[a.getAttribute('data-act')]) { a.disabled = true; ACTS[a.getAttribute('data-act')](); return; }
    var st = t.closest('[data-step]'); if (st) { view = +st.getAttribute('data-step'); render(); return; }
    var mt = t.closest('[data-mt]'); if (mt) { miniTab = mt.getAttribute('data-mt'); renderTabs(); return; }
    var ar = t.closest('[data-arch]'); if (ar) { openArch(ar.getAttribute('data-arch')); return; }
    var sl = t.closest('[data-sel]'); if (sl) { archSel = sl.getAttribute('data-sel'); if (/^F\.2\.5\./.test(archSel) && archMode === 'l1') archMode = 'l2'; renderArch(); return; }
    var dg = t.closest('[data-diag]'); if (dg) { archMode = dg.getAttribute('data-diag'); archSel = { l1: 'F.2.5', l2: 'F.2.5.1', hier: 'S.1.5' }[archMode]; renderArch(); return; }
    var rs = t.closest('[data-runstep]'); if (rs) { view = Math.min(+rs.getAttribute('data-runstep'), cur); showView('demo'); render(); return; }
    var tt = t.closest('[data-tt]'); if (tt) { traceTab = tt.getAttribute('data-tt'); renderTrace(); return; }
    var v = t.closest('[data-view]'); if (v) showView(v.getAttribute('data-view'));
  });
  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-av'); if (!id) return;
    run.avail = run.avail || {}; run.avail[id] = e.target.checked; renderUnits(); renderMap(); renderStep();
  });
  $('btn-restart').addEventListener('click', function () { restart(); });
  $('btn-model').addEventListener('click', function () {
    modelOn = !modelOn; miniTab = modelOn ? 'link' : 'log';
    try { localStorage.setItem('rt-model-view', modelOn ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    applyModel(); if (run) renderTabs();
  });
  applyModel();
  $('btn-checks').addEventListener('click', function () { checkResults = window.RescuTechAcceptance.runAll(); renderTrace(); });

  client = window.RescuTechApiClient.create(function (r) { reqs.push(r); });
  reqs = [];
  checkResults = window.RescuTechAcceptance.runAll();
  client.detect().then(function (mode) {
    var t = $('transport');
    t.className = 'transport ' + mode;
    t.querySelector('span').textContent = mode === 'http' ? 'API · ' + location.host : 'In-page API';
    return api('GET', '/api/agent').then(function (r) {
      agentInfo = r.body || agentInfo;
      var a = $('agent-badge');
      if (a) {
        a.className = 'transport ' + (agentInfo.enabled ? 'ai' : 'local');
        a.querySelector('span').textContent = agentInfo.enabled ? 'Claude agent · ' + agentInfo.model : 'Simulated agent (rules)';
        a.title = agentInfo.enabled ? 'Structuring and the recommendation briefing use Claude. Budget $' + agentInfo.budgetUsd + '/month (SyRD 2.5.1).'
                                    : 'No API key on this deployment: a keyword stub stands in for the language-model agent.';
      }
    }).then(restart, restart);
  });
})();
