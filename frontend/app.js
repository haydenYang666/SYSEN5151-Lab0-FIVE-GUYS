/*
 * RescuTech front end (Interfaces 1, 3 and 4). Every action calls the S.1 REST API in
 * rescutech-orchestrator/routes.js; no business rules live here.
 *   Dispatch      — CAD-style console: KPI strip; incident queue and activity log (left); map and unit
 *                   status board (centre); one incident card that grows as the call is worked, with the
 *                   next action at its foot (right). Model view adds the Innoslate IDs and the two tabs below.
 *   Architecture  — level-1 IDEF0 (F.2 with mechanisms S.1.1–S.1.5), level-2 IDEF0 (F.2.5 with S.1.5.1–S.1.5.4)
 *                   and the S.1 asset hierarchy; each element links to its code and to the step where it runs.
 *   Traceability  — SRD.1 and S.1.5 CRD requirements to model step, code and checks.
 */
(function () {
  'use strict';

  var A = window.RESCUTECH_ARCH, EL = A.EL;
  var ACTOR = {
    cit: { name: 'Caller', iface: '<span class="mdl">X.1 · Interface 1 · </span>phone call', ab: 'CALL' },
    sys: { name: 'RescuTech AI', iface: '<span class="mdl">S.1 · </span>automated', ab: 'AI' },
    coord: { name: 'Emergency Coordinator', iface: '<span class="mdl">X.2 · Interface 3 · </span>dispatch console', ab: 'COORD' },
    team: { name: 'Rescue Team', iface: '<span class="mdl">X.3 · Interface 4 · </span>field tablet', ab: 'UNIT' }
  };
  var LOG_ACTOR = { 'Citizen': 'cit', 'RescuTech': 'sys', 'Coordinator': 'coord', 'Rescue Team': 'team' };
  var STEPS = [
    { key: 'report', fn: 'F.2.1', actor: 'cit', title: 'Incoming call', long: 'Incoming emergency call', who: ['Caller', 'cit'] },
    { key: 'structure', fn: 'F.2.2', actor: 'sys', title: 'AI triage', long: 'AI triage of the call', who: ['AI agent', 'ai'] },
    { key: 'status', fn: 'F.2.3', actor: 'team', title: 'Unit status', long: 'Check live unit status', who: ['Units', 'team'] },
    { key: 'recommend', fn: 'F.2.4', actor: 'coord', title: 'Recommend', long: 'Recommend a unit', who: ['AI + rules', 'ai'] },
    { key: 'approve', fn: 'F.2.5.1', actor: 'coord', title: 'Approve', long: 'Coordinator approval', who: ['Coordinator', 'hu'] },
    { key: 'order', fn: 'F.2.5.2', actor: 'team', title: 'Dispatch', long: 'Dispatch and acknowledge', who: ['Unit', 'team'] },
    { key: 'final', fn: 'F.2.5.4', actor: 'coord', title: 'Confirmed', long: 'Dispatch confirmed', who: ['Coordinator', 'hu'] }
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
  var archMode = 'l1', archSel = 'F.2.5', traceTab = 'sr', miniTab = 'log', modelOn = false;
  try { modelOn = localStorage.getItem('rt-model-view') === 'on'; } catch (e) { /* storage unavailable */ }
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

  // ---------------- incident state (CAD-style status bar, queue and KPI strip) ----------------
  var LIFE = [
    ['Received', 'F.2.1', function () { return !!run.report; }],
    ['Triaged', 'F.2.2', function () { return !!(run.incident && !run.incident.manual); }],
    ['Units', 'F.2.3', function () { return !!run.done[2]; }],
    ['Recommend', 'F.2.4', function () { return !!(run.rec && run.rec.teamId); }],
    ['Approved', 'F.2.5.1', function () { return !!run.approval; }],
    ['Dispatched', 'F.2.5.2', function () { return !!run.order; }],
    ['Ack', 'F.2.5.3', function () { return !!run.ackd; }]
  ];
  function renderLane() {
    var curI = -1;
    $('lane').innerHTML = LIFE.map(function (s, i) {
      var d = s[2](); if (!d && curI < 0) curI = i;
      return '<li class="' + (d ? 'done' : curI === i ? 'cur' : '') + '"><i></i><span>' + s[0] + '</span><small class="mdl">' + s[1] + '</small></li>';
    }).join('');
  }
  function incState() {
    if (!run.report) return null;
    if (run.incident && run.incident.manual) return ['MANUAL', 'bad'];
    if (run.ackd) return ['ACKNOWLEDGED', 'ok'];
    if (run.order) return ['DISPATCHED', 'disp'];
    if (run.approval) return ['APPROVED', 'rec'];
    if (run.rec) return run.rec.teamId ? ['AWAITING APPROVAL', 'rec'] : ['NO UNIT', 'bad'];
    if (run.incident) return ['TRIAGED', 'info'];
    return ['PENDING', 'warn'];
  }
  function prio() { var u = run.incident && !run.incident.manual && run.incident.urgency; return u === 'High' ? ['P1', 'p1', 'High'] : u ? ['P2', 'p2', u] : ['P–', 'p0', 'Not triaged']; }
  function repLoc() { return run.report.location || 'Location from the call · pending triage'; }
  function incNo() { return (run.incident && run.incident.id) || run.report.id; }
  function nature() { return run.incident && !run.incident.manual ? (run.incident.assistanceNeeded || 'Assistance needed') : run.incident ? 'Manual handling' : 'Awaiting triage'; }
  function recDist() { var r = run.rec; if (!r || !r.teamId) return null; var a = r.alternatives.filter(function (x) { return x.teamId === r.teamId; })[0]; return a ? a.distanceKm : null; }
  function renderQueue() {
    var st = incState();
    $('q-sum').textContent = st ? '1 active' : 'Queue clear';
    if (!st) { $('queue').innerHTML = '<div class="q-empty"><b>No active incidents</b><span>Waiting for the next call…</span></div>'; return; }
    var p = prio();
    $('queue').innerHTML = '<div class="q-row sel"><span class="prio ' + p[1] + '" title="Priority: ' + esc(p[2]) + '">' + p[0] + '</span><div class="q-main">' +
      '<div class="q-top"><b class="mono">' + esc(incNo()) + '</b><span class="q-time mono" id="q-elapsed">--:--</span></div>' +
      '<div class="q-nat">' + esc(nature()) + '</div><div class="q-loc">' + esc(repLoc()) + '</div>' +
      '<span class="q-st ' + st[1] + '">' + st[0] + '</span></div></div>';
  }
  var ICON = {
    inc: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    unit: '<path d="M3 16V8h11v8M14 11h4l3 3v2h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    disp: '<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 4v16"/>'
  };
  function kpi(ic, label, value, sub, cls) {
    return '<div class="kpi ' + (cls || '') + '"><span class="k-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[ic] + '</svg></span>' +
      '<div><span class="k-l">' + label + '</span><b class="k-v">' + value + '</b><span class="k-s">' + sub + '</span></div></div>';
  }
  function ring(a, n) {
    var C = 2 * Math.PI * 15, f = n ? a / n : 0;
    return '<svg class="k-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>';
  }
  function renderKpis() {
    var teams = teamsNow(), av = teams.filter(function (t) { return t.available; }).length, st = incState(), d = recDist();
    $('kpis').innerHTML =
      kpi('inc', 'Active incidents', st ? '1' : '0', st ? (prio()[0] + ' · ' + esc(nature())) : 'Queue clear', st ? 'hot' : '') +
      '<div class="kpi">' + ring(av, teams.length) + '<div><span class="k-l">Units available</span><b class="k-v">' + av + '<small>/' + teams.length + '</small></b><span class="k-s">' + (teams.length - av) + ' out of service</span></div></div>' +
      kpi('time', 'Call timer', '<span id="k-timer">--:--</span>', run.ackd ? 'Call to acknowledgment' : st ? 'Since call registered' : 'No active call', st && !run.ackd ? 'warn' : '') +
      kpi('disp', 'Dispatch', st ? st[0].charAt(0) + st[0].slice(1).toLowerCase() : '—', d !== null ? 'Nearest suitable unit ' + d + ' km' : 'No unit assigned', run.ackd ? 'ok' : '');
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
  function unitCode(t) {
    var isRec = run.rec && run.rec.teamId === t.id;
    if (isRec && run.ackd) return ['ACK', 'ok', 'Order acknowledged'];
    if (isRec && run.order) return ['DISP', 'disp', 'Dispatched, awaiting acknowledgment'];
    if (isRec) return ['REC', 'rec', 'Recommended'];
    return t.available ? ['AVAIL', 'av', 'Available'] : ['OOS', 'oos', 'Out of service'];
  }
  function renderUnits() {
    var teams = teamsNow(), rec = run.rec, ed = editable();
    var alt = {}; if (rec) rec.alternatives.forEach(function (a) { alt[a.teamId] = a; });
    $('units-panel').classList.toggle('editable', ed);
    $('units-sum').textContent = teams.filter(function (t) { return t.available; }).length + '/' + teams.length + ' available';
    $('units-foot').innerHTML = ed ? '<b>Field update (simulated):</b> switch a unit to push its new status' :
      '<span class="mdl">Source <code>resource-status-source/</code> <span class="tag stub">STUB</span></span><span class="nomdl">Last status pushed by each unit</span>';
    $('units-head').innerHTML = '<tr><th>Unit</th><th>Status</th><th>Area</th><th>Capabilities</th><th>Dist.</th><th>Note</th>' + (ed ? '<th>In service</th>' : '') + '</tr>';
    $('units').innerHTML = teams.map(function (t) {
      var c = unitCode(t), a = alt[t.id], isRec = rec && rec.teamId === t.id;
      var note = a && !isRec && a.excludedBecause.length ? esc(a.excludedBecause.join('; ')) : isRec && run.incident ? 'Assigned to ' + esc(run.incident.id) : '';
      return '<tr class="' + (isRec ? 'rec' : '') + (t.available ? '' : ' off') + '">' +
        '<td><span class="u-id mono">' + t.id + '</span>' + esc(t.name.replace('Rescue Team ', '')) + '</td>' +
        '<td><span class="code ' + c[1] + '" title="' + c[2] + '">' + c[0] + '</span></td>' +
        '<td>' + esc(ZONES[t.zoneKey] ? ZONES[t.zoneKey].name : t.zoneKey) + '</td>' +
        '<td>' + t.capabilities.map(function (x) { return '<span class="chip">' + (CAP[x] || x) + '</span>'; }).join('') + '</td>' +
        '<td class="mono">' + (a && a.distanceKm !== null ? a.distanceKm + ' km' : '—') + '</td>' +
        '<td class="u-note">' + note + '</td>' +
        (ed ? '<td><label class="switch"><input type="checkbox" data-av="' + t.id + '"' + (t.available ? ' checked' : '') + ' aria-label="' + esc(t.name) + ' in service"><span class="tr"></span></label></td>' : '') + '</tr>';
    }).join('');
  }

  // ---------------- map ----------------
  // Real map (Leaflet + Esri dark-gray tiles). The incident pin is geocoded from the caller address; unit
  // positions are simulated (area centres); place names are real.
  // Falls back to the SVG map below when Leaflet or the tiles cannot load (offline demo).
  var LL = { downtown: [42.4396, -76.4966], collegetown: [42.4419, -76.4855], 'fall creek': [42.4500, -76.4930],
             'route 13': [42.4085, -76.5455], lansing: [42.5357, -76.4908], dryden: [42.4906, -76.2977] };
  var lmap = null, llayer = null, lfit = null, lfail = false;
  function zoneKeyOf(z) { if (!z) return null; for (var k in ZONES) if (ZONES[k].name === z.name) return k; return null; }
  function dropLeaflet() {
    if (lfail) return;
    lfail = true;
    if (lmap) { lmap.remove(); lmap = null; llayer = null; }
    document.querySelector('.map-panel').classList.remove('has-leaflet');
    if (run) renderMap();
  }
  function initLeaflet() {
    if (lfail) return false;
    if (lmap) return true;
    if (!window.L || !$('lmap')) return false;
    lmap = L.map('lmap', { zoomControl: true, attributionControl: true, scrollWheelZoom: true }).setView([42.47, -76.44], 11);
    var tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors' }).addTo(lmap);
    var tilesOk = 0, tilesBad = 0;
    tiles.on('tileload', function () { tilesOk++; });
    tiles.on('tileerror', function () { if (!tilesOk && ++tilesBad >= 4) dropLeaflet(); });
    lmap.attributionControl.addAttribution('Geocoding <a href="https://photon.komoot.io">Photon</a> · Routing <a href="https://project-osrm.org">OSRM</a>');
    llayer = L.layerGroup().addTo(lmap);
    document.querySelector('.map-panel').classList.add('has-leaflet');
    setTimeout(function () { if (lmap) lmap.invalidateSize(); }, 50);
    window.addEventListener('resize', function () { if (lmap) lmap.invalidateSize(); });
    // Re-draw overlays after every move: a fly-to interrupted by a newer one can leave vector layers mis-projected.
    lmap.on('moveend', function () { if (run && lmap) renderLeaflet(); });
    return true;
  }
  // Real-world lookups for the map display only; dispatch logic and the recommendation distance stay in the backend.
  // Address -> point: Photon geocoder (OpenStreetMap data). Road route and drive time: OSRM demo server.
  // Both are free public services with no key. On any failure the map falls back to the area centre / a straight line.
  var BBOX = '-76.75,42.25,-76.2,42.65', geo = {}, routes = {};
  function getJSON(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }
  function mapRefresh() { if (run && lmap) renderLeaflet(); }
  function geocode(addr) {
    if (geo[addr]) return geo[addr];
    geo[addr] = { state: 'pending' };
    // Try the full address; if that only matches an area (e.g. a neighbourhood name), retry with street + town.
    var parts = addr.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var qs = [addr]; if (parts.length > 2) qs.push(parts[0] + ', ' + parts[parts.length - 1]);
    function look(q) {
      q = /\b(NY|New York)\b/i.test(q) ? q : q + ', NY';
      return getJSON('https://photon.komoot.io/api/?limit=1&lat=42.44&lon=-76.5&bbox=' + BBOX + '&q=' + encodeURIComponent(q))
        .then(function (j) { return j.features && j.features[0] || null; });
    }
    function level(f) { var p = f.properties || {}; return p.type === 'house' || p.housenumber ? 2 : p.type === 'street' ? 1 : 0; }
    look(qs[0]).then(function (f) {
      return f && level(f) > 0 || !qs[1] ? f : look(qs[1]).then(function (f2) { return f2 && level(f2) > 0 ? f2 : f || f2; });
    }).then(function (f) {
      var p = f ? f.properties || {} : null;
      geo[addr] = !f ? { state: 'none' } : { state: 'ok', ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
        match: ['area-level', 'street-level', 'address'][level(f)] + ' match', label: [p.housenumber, p.name || p.street, p.city || p.district].filter(Boolean).join(' ') };
      mapRefresh();
    }).catch(function () { geo[addr] = { state: 'fail' }; mapRefresh(); });
    return geo[addr];
  }
  function roadRoute(a, b) {
    var k = a.join(',') + ';' + b.join(',');
    if (routes[k]) return routes[k];
    routes[k] = { state: 'pending' };
    getJSON('https://router.project-osrm.org/route/v1/driving/' + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] + '?overview=full&geometries=geojson').then(function (j) {
      var r = j.routes && j.routes[0];
      routes[k] = !r ? { state: 'none' } : { state: 'ok', line: r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), km: r.distance / 1000, min: r.duration / 60 };
      mapRefresh();
    }, function () { routes[k] = { state: 'fail' }; mapRefresh(); });
    return routes[k];
  }
  function mapInfo(g, rt, recTeam) {
    var el = $('map-info'); if (!el) return;
    if (!run.report) { el.hidden = true; return; }
    var h = g.state === 'pending' ? '<div class="mi-row"><span class="mi-k">Locating</span>Looking up the caller address…</div>' :
      g.state === 'ok' ? '<div class="mi-row"><span class="mi-k ok">Located</span>' + esc(g.label || repLoc()) + '<small>' + g.match + ' · OpenStreetMap</small></div>' :
      '<div class="mi-row"><span class="mi-k warn">Approx.</span>Area centre shown<small>address lookup unavailable</small></div>';
    if (rt && recTeam) {
      h += rt.state === 'ok' ? '<div class="mi-row"><span class="mi-k">Route</span>' + esc(recTeam.id) + ' → incident: <b>' + rt.km.toFixed(1) + ' km · ~' + Math.round(rt.min) + ' min</b><small>road route (OSRM) · recommendation used simulated grid distance</small></div>' :
        rt.state === 'pending' ? '<div class="mi-row"><span class="mi-k">Route</span>Calculating road route…</div>' :
        '<div class="mi-row"><span class="mi-k warn">Route</span>Straight line shown<small>routing unavailable</small></div>';
    }
    el.innerHTML = h; el.hidden = false;
  }

  function renderLeaflet() {
    llayer.clearLayers();
    var inc = run.incident, teams = teamsNow().filter(function (t) { return LL[t.zoneKey]; });
    var rec = run.rec && run.rec.teamId;
    var recTeam = rec ? teams.filter(function (t) { return t.id === rec; })[0] : null;
    var rp = recTeam ? LL[recTeam.zoneKey] : null;
    var ik = inc && inc.zone ? zoneKeyOf(inc.zone) : null, ip = null;
    Object.keys(LL).forEach(function (k) {
      if (!ZONES[k]) return;
      var hot = k === ik;
      L.circle(LL[k], { radius: hot ? 1500 : 1100, interactive: false, weight: hot ? 2 : 1, color: hot ? '#ff4d5a' : '#3d8bff', opacity: hot ? .9 : .45,
        fillColor: hot ? '#ff4d5a' : '#3d8bff', fillOpacity: hot ? .18 : .07, dashArray: hot ? null : '4 4' }).addTo(llayer);
      L.marker(LL[k], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="zone-lab">' + esc(ZONES[k].name) + '</div>', iconSize: [0, 0], iconAnchor: [-18, 26] }) }).addTo(llayer);
    });
    var g = run.report && run.report.location ? geocode(run.report.location) : { state: run.report ? 'pending' : 'none' };
    if (g.state === 'ok') ip = g.ll;
    else if (ik && LL[ik]) {
      var hasTeam = teams.some(function (t) { return t.zoneKey === ik; });
      ip = [LL[ik][0] + (hasTeam ? 0.006 : 0), LL[ik][1] + (hasTeam ? 0.009 : 0)];
    }
    var rt = ip && rp && run.order ? roadRoute(rp, ip) : null;
    if (rt) {
      L.polyline(rt.state === 'ok' ? rt.line : [rp, ip], { color: run.ackd ? '#22c55e' : '#a78bfa', weight: 4, opacity: .95, className: run.ackd ? '' : 'route-line' }).addTo(llayer);
    }
    mapInfo(g, rt, recTeam);
    teams.forEach(function (t) {
      var cls = 'u-mk' + (t.available ? '' : ' off') + (rec === t.id ? ' rec' : '') + (rec === t.id && run.order && !run.ackd ? ' disp' : '');
      var html = '<div class="' + cls + '">' + t.id.slice(-1) + '</div>' + (rec === t.id ? '<div class="u-lab">' + esc(t.name.replace('Rescue Team ', 'Unit ')) + '</div>' : '');
      L.marker(LL[t.zoneKey], { icon: L.divIcon({ className: '', html: html, iconSize: [30, 30], iconAnchor: [15, 15] }), title: t.name, zIndexOffset: rec === t.id ? 500 : 0 }).addTo(llayer);
    });
    if (ip) {
      L.marker(ip, { icon: L.divIcon({ className: '', html: '<div class="i-mk"><span class="ring"></span><span class="core"></span></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000, title: (run.report && run.report.location) || 'Incident' }).addTo(llayer);
    }
    var key = (ip ? ip.join(',') : '-') + '|' + (rec || '-') + '|' + (run.order ? 'o' : '-') + '|' + (rt ? rt.state : '-') + '|' + (phoneOpen() ? 'p' : '-');
    if (key !== lfit) {
      // Leaflet cannot fit a 0x0 container (hidden tab or before layout); retry on the next render.
      var sz = lmap.getSize();
      if (!sz.x || !sz.y) { lmap.invalidateSize(); sz = lmap.getSize(); }
      if (!sz.x || !sz.y) return;
      var animate = lfit !== null;
      lfit = key;
      lmap.stop();
      var pts = rt && rt.state === 'ok' ? rt.line : ip && rp ? [ip, rp] : teams.map(function (t) { return LL[t.zoneKey]; }).concat(ip ? [ip] : []);
      if (pts.length === 1) lmap.setView(pts[0], 13, { animate: animate });
      // keep the fitted area clear of the info box (top right) and legend (bottom)
      var left = phoneOpen() && sz.x > 700 ? 300 : 70;
      var pad = run.report ? { paddingTopLeft: [left, 70], paddingBottomRight: [Math.min(360, sz.x / 2), 70] } : { paddingTopLeft: [left, 70], paddingBottomRight: [70, 70] };
      if (pts.length > 1 && animate) lmap.flyToBounds(L.latLngBounds(pts), L.extend({ maxZoom: 13, duration: 0.8 }, pad));
      else if (pts.length > 1) lmap.fitBounds(L.latLngBounds(pts), L.extend({ maxZoom: 13, animate: false }, pad));
    }
  }

  function P(z) { return { x: 40 + (z.x + 5) * 26, y: 440 - (z.y + 3) * 26 }; }
  function renderMap() {
    if (initLeaflet()) { renderLeaflet(); renderChips(); return; }
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
    renderChips();
  }
  function renderChips() {
    if (!$('metrics')) return;
    var inc = run.incident;
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

  // ---------------- incident card (one record that grows as the call is worked) ----------------
  function kv(inc) {
    function v(x) { return x ? esc(x) : '<span class="miss">Missing</span>'; }
    return '<dl class="kv"><dt>Location</dt><dd>' + v(inc.location) + '</dd><dt>Area</dt><dd>' + v(inc.zone && inc.zone.name) + '</dd>' +
      '<dt>Assistance</dt><dd>' + v(inc.assistanceNeeded) + '</dd><dt>Needs</dt><dd>' +
      (inc.requiredCapabilities.map(function (c) { return '<span class="chip">' + CAP[c] + '</span>'; }).join('') || '<span class="miss">Missing</span>') +
      '</dd><dt>People</dt><dd>' + v(inc.peopleCount) + '</dd><dt>Urgency</dt><dd>' + esc(inc.urgency) + '</dd></dl>';
  }
  function btn(label, act, cls) { return '<button type="button" class="btn ' + (cls || 'go') + '" data-act="' + act + '">' + label + '</button>'; }
  function sec(title, body, cls) { return '<section class="sec ' + (cls || '') + '"><h3>' + title + '</h3>' + body + '</section>'; }
  function bar(who, whoCls, hint, buttons) {
    return '<div class="ab-top"><span class="who-tag ' + whoCls + '">' + who + '</span><span class="ab-hint">' + hint + '</span></div><div class="acts">' + buttons + '</div>';
  }
  function short(name) { return esc(String(name || '').replace('Rescue Team ', '')); }

  function cardBody() {
    if (!run.report) {
      var ps = phone ? phone.state() : { stage: 'idle', lines: [] };
      if (ps.stage === 'idle' || ps.stage === 'failed') {
        return sec('Incoming calls', '<p class="line">No call in progress. The AI voice assistant answers every call at once, so there is no call queue.</p>' +
          '<p class="hint">Start a call on the <b>caller phone</b> over the map' + (client && client.mode() === 'http' ? ', or from a real phone on the same network: open the <b>Caller phone</b> address that <code>npm start</code> prints (…/frontend/caller.html)' : '') + '.</p>' +
          (ps.stage === 'failed' ? '<div class="note warn"><b>Last call not registered</b>' + esc(ps.error) + '</div>' : ''));
      }
      return sec('Live call <span class="src">AI voice intake</span>', '<ul class="narr">' + ps.lines.map(function (l) {
        return '<li class="' + l.who + '"><b>' + (l.who === 'ai' ? 'AI' : 'Caller') + '</b>' + esc(l.text) + '</li>';
      }).join('') + '</ul><p class="hint">The report is registered when the assistant has the location and the need.</p>');
    }
    var r = run.report, inc = run.incident, rec = run.rec, o = run.order, out = '';
    out += sec('Caller statement <span class="src">Voice · ' + hm(r.registeredAt) + '</span>',
      (r.remote ? '<p class="line">Call taken on the caller’s own phone by the AI assistant. The structured details appear after triage.</p>'
                : '<p class="quote">“' + esc(r.description) + '”</p>') +
      '<div class="readback"><b>Read back to caller</b>' + esc(run.receipt.message) + '</div>');
    if (inc && inc.manual) {
      out += sec('AI triage', '<div class="note bad"><b>Manual handling<span class="mdl"> (SyRD 2.3.1, 2.3.3)</span></b>' + esc(inc.error) + '. The agent’s output was withheld; nothing was dispatched.</div>');
    } else if (inc) {
      var ai = /Claude/.test(inc.source || '');
      out += sec('AI triage ' + (ai ? '<span class="tag ai">CLAUDE</span>' : '<span class="tag rules">RULES</span><span class="tag stub mdl">STUB</span>'),
        kv(inc) + (inc.missing.length ? '<div class="note warn"><b>Flagged, not guessed</b>' + esc(inc.missing.join(', ')) + '</div>' : ''), 'ai');
    }
    if (run.done[2]) {
      var n = run.teams.filter(function (t) { return t.available; }).length;
      out += sec('Unit availability', '<p class="line"><b>' + n + '/' + run.teams.length + '</b> units in service · ' +
        (run.stale && run.stale.length ? 'refresh requested from ' + esc(run.stale.join(', ')) + ' (dispatch did not wait)' : 'all statuses current') + '</p>');
    }
    if (rec) {
      out += sec('Recommended unit <span class="tag rules">RULE-BASED</span>', rec.teamId ?
        '<div class="reco"><p class="nm">' + esc(rec.teamName) + (recDist() !== null ? '<span class="mono"> · ' + recDist() + ' km</span>' : '') + '</p><ul>' +
          rec.rationale.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
          (rec.briefing ? '<div class="note ai"><b>AI briefing <span class="tag ai">CLAUDE</span></b>' + esc(rec.briefing) +
            '<span class="hint" style="display:block;margin-top:4px">The unit is chosen by fixed rules; the agent only explains it.</span></div>' : '')
        : '<div class="note warn"><b>No suitable unit</b>' + rec.rationale.map(esc).join(' ') + '</div>');
    }
    if (run.guard || run.approval) {
      out += sec('Authorization',
        (run.guard ? '<div class="note bad alarm"><b>Blocked · dispatch without approval<span class="mdl"> (SR.6, CRD 2.1.1)</span></b>' + esc(run.guard).replace(/\s*\((SR\.\d+)\)/g, '<span class="mdl"> ($1)</span>') + '</div>' : '') +
        (run.approval ? '<div class="note ok"><b>Approved · ' + run.approval.id + '</b>' + esc(rec.teamName) + ' approved by the coordinator at ' + hm(run.approval.at) + '.</div>' : ''));
    }
    if (o) {
      out += sec('Dispatch order',
        '<div class="order"><div class="top"><span>ORDER ' + o.id + '</span><span>' + esc(o.urgency).toUpperCase() + '</span></div><div class="bd">' +
        '<span class="cap">Go to</span><p class="loc">' + esc(o.location) + '</p><span class="cap">Task</span><p class="task">' + esc(o.task) + '</p>' +
        '<dl class="kv"><dt>Unit</dt><dd>' + esc(o.teamName) + '</dd><dt>Approval</dt><dd>' + o.approvalId + ' · sent ' + hm(o.issuedAt) + '</dd></dl></div></div>' +
        (run.wrongAck ? '<div class="note bad alarm"><b>Rejected · wrong unit<span class="mdl"> (CRD 2.4.2)</span></b>' + esc(run.wrongAck) + '</div>' : '') +
        (run.ackd ? '<div class="note ok"><b>Receipt confirmed</b>' + esc(o.teamName) + ' acknowledged at ' + hm(run.ackd.acknowledgedAt) + '.</div>' : ''));
    }
    if (run.done[STEPS.length - 1]) {
      var a = run.ackd || o, st = run.status || { code: 'AWAITING_ACK' };
      var used = {}; logCache.forEach(function (e) { e.refs.forEach(function (x) { used[x] = true; }); });
      var ops = window.RESCUTECH_TRACE.filter(function (t) { return t.lane !== 'delivery'; });
      var nn = ops.filter(function (t) { return used[t.sr]; }).length;
      function tl(on, what, ref, when) { return '<li class="' + (on ? 'on' : '') + '"><span class="pt"></span><div><b>' + what + '</b><small>' + esc(ref) + '</small></div><span class="when">' + hm(when) + '</span></li>'; }
      out += sec('Dispatch status <span class="pill ' + st.code + '">' + (st.code === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Awaiting acknowledgment') + '</span>',
        '<ol class="tl">' + tl(true, 'Call registered', r.id, r.registeredAt) + tl(true, 'Assignment approved', run.approval.id, run.approval.at) +
        tl(true, 'Order issued', a.id + ' → ' + a.teamName, a.issuedAt) + tl(!!a.acknowledgedAt, 'Receipt acknowledged', a.teamName, a.acknowledgedAt) + '</ol>' +
        '<p class="hint">Status comes only from recorded events. Arrival and rescue are outside the system boundary.</p>' +
        '<div class="note mdl"><b>' + nn + '/' + ops.length + ' operational requirements exercised</b>See the Traceability tab.</div>');
    }
    return out;
  }

  function cardActions() {
    var k = STEPS[view].key;
    if ((run.incident && run.incident.manual) || (run.rec && !run.rec.teamId))
      return bar('Coordinator', 'hu', 'Handle this call manually, then start a new incident.', btn('New incident', 'restart', 'primary'));
    if (run.done[STEPS.length - 1])
      return bar('Coordinator', 'hu', 'Dispatch confirmed. Close out and take the next call.', btn('New incident', 'restart', 'primary') + (modelOn ? btn('Open traceability', 'open-trace', '') : ''));
    if (k === 'report') {
      var cs = phone ? phone.state().stage : 'idle';
      return cs === 'idle' || cs === 'failed' ? bar('Caller · simulated', 'cit', 'Waiting for a call. Start one on the caller phone, or here.', btn('Start demo call', 'call'))
        : bar('AI agent', 'ai', 'AI voice intake is on the line with the caller…', '');
    }
    if (k === 'structure') return bar('AI agent', 'ai', 'Turn the transcript into a structured incident. Unknowns are flagged, never guessed.', btn('Run AI triage', 'structure'));
    if (k === 'status') return bar('Units · simulated', 'team', 'Units push status changes. Switch a unit off in the board to try it.', btn('Confirm unit status', 'status'));
    if (k === 'recommend') return bar('AI + rules', 'ai', 'Match availability, capability and distance. The coordinator decides.', btn('Recommend unit', 'recommend'));
    if (k === 'approve') return bar('Coordinator', 'hu', 'Every dispatch needs your approval.', btn('Dispatch without approval', 'unapproved', 'danger') + btn('Approve ' + short(run.rec.teamName), 'approve'));
    if (k === 'order' && !run.order) return bar('Coordinator', 'hu', 'Send the approved order to the unit’s field tablet.', btn('Send dispatch order', 'issue'));
    if (k === 'order') {
      var other = teamsNow().filter(function (t) { return t.id !== run.order.teamId; })[0];
      return bar('Field tablet · simulated', 'team', 'Only the assigned unit can acknowledge.', btn('Ack as ' + (other ? other.id : 'other unit'), 'wrongack', 'danger') + btn(short(run.order.teamName) + ' acknowledges', 'ack'));
    }
    return '';
  }

  function renderStep() {
    var s = STEPS[view];
    $('step-card').setAttribute('style', vars(s.actor));
    if (!run.report) {
      $('inc-sub').textContent = 'New call';
      var on = phone && phone.state().stage !== 'idle' && phone.state().stage !== 'failed';
      $('step-top').innerHTML = '<span class="prio p0">' + (on ? 'CALL' : 'IDLE') + '</span><div class="ih-main"><div class="ih-top"><b>' + (on ? 'Call in progress' : 'Waiting for calls') + '</b>' +
        '<span class="q-st ' + (on ? 'warn' : 'info') + '">' + (on ? 'ON CALL' : 'READY') + '</span></div><div class="ih-loc">Voice line · AI intake answers at once</div></div>';
    } else {
      var p = prio(), st = incState();
      $('inc-sub').textContent = 'Opened ' + hm(run.report.registeredAt);
      $('step-top').innerHTML = '<span class="prio ' + p[1] + '" title="Priority: ' + esc(p[2]) + '">' + p[0] + '</span><div class="ih-main"><div class="ih-top"><b class="mono">' + esc(incNo()) + '</b>' +
        '<span class="q-st ' + st[1] + '">' + st[0] + '</span><span class="ih-time mono" id="inc-elapsed">--:--</span></div>' +
        '<div class="ih-nat">' + esc(nature()) + '</div><div class="ih-loc">' + esc(repLoc()) + '</div></div>';
    }
    $('stage').innerHTML = cardBody();
    $('foot').innerHTML = cardActions();
    $('stage').scrollTop = $('stage').scrollHeight;
    tick();
  }

  // ---------------- caller phone (X.1 Citizen, front end only) ----------------
  // Embedded: the simulated caller's phone over the map. Real phone: caller.html registers through the same API;
  // when served by `npm start` the console notices the new report in the event log and takes the call.
  var phone = null, phoneUser = null, seenRemote = {};
  function phoneOpen() { return phoneUser !== null ? phoneUser : !run || !run.incident; }
  function renderPhone() {
    var open = phoneOpen();
    $('phone-wrap').classList.toggle('open', open);
    document.querySelector('.map-panel').classList.toggle('phone-open', open);
    $('phone-tab').setAttribute('aria-expanded', String(open));
    $('phone-tab').innerHTML = open ? 'Hide caller phone' : 'Caller phone' + (run && run.report && run.report.remote ? ' · real phone' : '');
  }
  function mountPhone() {
    phone = window.RescuTechCallerPhone.mount($('phone'), {
      location: SAMPLE.location, description: SAMPLE.description,
      register: function (loc, desc) {
        return api('POST', '/api/distress-reports', { location: loc, transcript: desc, channel: 'voice' }).then(function (r) {
          return r.status === 201 ? { ok: true, report: r.body.report, receipt: r.body.receipt } : { ok: false, error: (r.body && r.body.error) || 'Registration failed' };
        });
      },
      onChange: function () { if (run && !run.report) { renderStep(); renderTabs(); } },
      onRegistered: function (res) { if (run.report) return; run.report = res.report; run.receipt = res.receipt; finish('Report ' + res.report.id + ' registered'); }
    });
  }
  function pollRemoteCalls() {
    if (!client || client.mode() !== 'http' || !run || run.report || !phone || phone.state().stage !== 'idle') return;
    client.log().then(function (entries) {
      if (run.report || phone.state().stage !== 'idle') return;
      var hit = null;
      entries.forEach(function (e) { var m = e.uc === 'UC.1.2' && /report (R-\d+) registered/.exec(e.text); if (m && !seenRemote[m[1]]) hit = { id: m[1], time: e.time }; });
      if (!hit) return;
      seenRemote[hit.id] = true;
      run.report = { id: hit.id, location: null, description: null, registeredAt: hit.time, channel: 'voice', remote: true };
      run.receipt = { message: 'Report details and receipt were read back to the caller on their phone.' };
      phoneUser = false;
      finish('Incoming call · ' + hit.id + ' from a caller phone');
    }, function () { /* server unreachable: try again on the next poll */ });
  }
  setInterval(pollRemoteCalls, 2000);
  $('phone-tab').addEventListener('click', function () { phoneUser = !phoneOpen(); renderPhone(); if (run) renderMap(); });

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
    renderLane(); renderQueue(); renderKpis(); renderUnits(); renderPhone(); renderMap(); renderStep(); renderTabs(); tick();
    return client.log().then(function (l) { logCache = l; renderTabs(); if (STEPS[view].key === 'final') renderStep(); });
  }
  // A finished action moves the incident on by itself; the card keeps every earlier result.
  function finish(msg) {
    run.done[view] = true; if (msg) toast(msg);
    var stop = (run.incident && run.incident.manual) || (run.rec && !run.rec.teamId);
    if (!stop && view < STEPS.length - 1) return goStep(view + 1);
    return render();
  }
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
    call: function () { if (phone) { phoneUser = null; phone.start(); } return Promise.resolve(); },
    structure: function () {
      return api('POST', '/api/distress-reports/' + run.report.id + '/incident').then(function (r) {
        if (r.status !== 201) { run.incident = { manual: true, error: r.body.error || 'Structuring failed' }; return finish('Sent to manual handling'); }
        run.incident = r.body;
        if (!run.report.location && r.body.location) run.report.location = r.body.location;   // call taken on a real phone
        return finish('Incident ' + r.body.id + ' structured');
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

  var curView = 'demo';
  function showView(v) {
    curView = v;
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
    run = { done: {} }; cur = 0; view = 0; reqs = []; miniTab = modelOn ? 'link' : 'log'; phoneUser = null; seenRemote = {};
    if (phone) phone.reset();
    return api('POST', '/api/reset').then(function () { reqs = []; showView('demo'); return render(); });
  }

  // ---------------- clock and call timer ----------------
  function mmss(ms) { var t = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
  function tick() {
    var now = new Date(); $('clock').textContent = now.toTimeString().slice(0, 8);
    var el = $('elapsed'), txt = '--:--';
    var start = run && run.report ? new Date(run.report.registeredAt).getTime() : NaN;
    var end = run && run.ackd ? new Date(run.ackd.acknowledgedAt).getTime() : NaN;
    if (!isFinite(start)) { el.textContent = 'No active call'; el.className = 'elapsed'; }
    else if (run.ackd) { txt = isFinite(end) ? mmss(end - start) : '--:--'; el.textContent = 'Dispatched in ' + txt; el.className = 'elapsed'; }
    else { txt = mmss(Date.now() - start); el.textContent = 'Call open ' + txt; el.className = 'elapsed on'; }
    ['q-elapsed', 'inc-elapsed', 'k-timer'].forEach(function (id) { var x = $(id); if (x) x.textContent = txt; });
  }
  setInterval(tick, 1000);

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
    run.avail = run.avail || {}; run.avail[id] = e.target.checked; renderUnits(); renderKpis(); renderMap();
  });
  $('btn-restart').addEventListener('click', function () { restart(); });
  $('btn-model').addEventListener('click', function () {
    modelOn = !modelOn; miniTab = modelOn ? 'link' : 'log';
    try { localStorage.setItem('rt-model-view', modelOn ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    applyModel(); if (curView !== 'demo' && !modelOn) showView('demo');
    if (run) render();
  });
  applyModel();
  $('btn-checks').addEventListener('click', function () { checkResults = window.RescuTechAcceptance.runAll(); renderTrace(); });

  client = window.RescuTechApiClient.create(function (r) { reqs.push(r); });
  mountPhone();
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
