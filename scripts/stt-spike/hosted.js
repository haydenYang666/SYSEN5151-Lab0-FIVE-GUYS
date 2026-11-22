/*
 * Speech-to-text spike, A2 hosted transcription API.
 * Sends the recordings made with frontend/stt-spike.html ("Record only") to a hosted transcription API
 * and measures C1 (request round trip) and C2 (key-field accuracy, same scoring as the browser page).
 *
 *   OPENAI_API_KEY=... node scripts/stt-spike/hosted.js path/to/recordings
 *
 * Files must be named call01.webm ... call10.webm (the page names them that way).
 * STT_MODEL selects the model (default gpt-transcribe). The key is read from the environment only and is never printed.
 * Note: this measures the API leg from the machine running the script, not the upload from a caller's phone.
 */
'use strict';
var fs = require('fs'), path = require('path');
var Spike = require('./score.js');

var dir = process.argv[2];
var key = process.env.OPENAI_API_KEY;
var model = process.env.STT_MODEL || 'gpt-transcribe';
if (!dir || !key) { console.error('Usage: OPENAI_API_KEY=... node scripts/stt-spike/hosted.js <recordings-dir>'); process.exit(1); }

(async function () {
  var rows = [['alt', 'call', 'c1', 'correct', 'got', 'wer', 'transcript']];
  for (var n = 1; n <= Spike.CALLS.length; n++) {
    var file = path.join(dir, 'call' + String(n).padStart(2, '0') + '.webm');
    if (!fs.existsSync(file)) { console.log('missing ' + file); continue; }
    var form = new FormData();
    form.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/webm' }), path.basename(file));
    form.append('model', model);
    var t0 = Date.now();
    var res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form });
    var body = await res.json();
    var ms = Date.now() - t0;
    if (!res.ok) { console.log('call ' + n + ': HTTP ' + res.status + ' ' + ((body.error && body.error.message) || '')); continue; }
    var s = Spike.score(Spike.CALLS[n - 1], body.text || '');
    rows.push(['A2 ' + model, n, ms / 1000, s.correct, (s.got.zone || 'no zone') + ' / ' + (s.got.caps || 'none'), s.wer, body.text || '']);
    console.log('call ' + n + ': ' + (ms / 1000) + ' s, correct=' + s.correct);
  }
  var ok = rows.slice(1).filter(function (r) { return r[3]; }).length, total = rows.length - 1;
  console.log('\nC1 median ' + Spike.median(rows.slice(1).map(function (r) { return r[2]; })) + ' s · C2 ' + (total ? Math.round(100 * ok / total) : 0) + '% (' + ok + '/' + total + ')');
  var out = path.join(dir, 'hosted-results.csv');
  fs.writeFileSync(out, rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n') + '\n');
  console.log('Wrote ' + out);
})().catch(function (e) { console.error(e.message); process.exit(1); });
