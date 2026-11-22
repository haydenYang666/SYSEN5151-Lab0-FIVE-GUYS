/*
 * RescuTech speech-to-text — hosted transcription API (alternative A2 of trade study D.1, ADR 0006).
 *
 * Model link : S.1.1 Report Intake Subsystem performs F.2.1 (UC.1.2 Answer and Transcribe Call);
 *              element S.1.1.A2 Hosted Transcription API (Innoslate project 584).
 * Requirements: SR.1 voice report with text fallback; SyRD 2.1.8 answer and register within 5 s;
 *               SyRD 2.2.2 degraded network (the caller page queues audio offline and sends it later);
 *               SyRD 2.5.1 model cost within budget: S.1.1 is apportioned USD 5 of the USD 50/month (ADR 0006).
 *
 * The caller page records audio and posts it to POST /api/transcriptions; this module sends it to the provider
 * with a server-side key and returns the text, which the page then submits as the transcript (POST /api/distress-reports).
 * If the provider is not configured, unreachable, slow or over budget, the caller types the report instead (fallback).
 *
 * Node only (the key must never reach the browser). No dependencies: Node 18+ fetch, FormData, Blob.
 * Configuration (environment):
 *   OPENAI_API_KEY               enables the hosted transcriber; without it /api/transcriptions answers 503 (typed fallback)
 *   RESCUTECH_STT_MODEL          default gpt-transcribe
 *   RESCUTECH_STT_BUDGET_USD     monthly budget for S.1.1, default 5 (ADR 0006)
 *   RESCUTECH_STT_PRICE_PER_MIN  default 0.0045 (USD per audio minute)
 */
'use strict';

var MAX_SECONDS = 120;            // one distress report; longer audio is refused
var MAX_BYTES = 4 * 1024 * 1024;  // decoded audio size limit

function createTranscriber(opts) {
  opts = opts || {};
  var env = opts.env || process.env;
  var apiKey = opts.apiKey || env.OPENAI_API_KEY;
  var model = opts.model || env.RESCUTECH_STT_MODEL || 'gpt-transcribe';
  var budgetUsd = Number(opts.budgetUsd || env.RESCUTECH_STT_BUDGET_USD || 5);
  var pricePerMin = Number(opts.pricePerMin || env.RESCUTECH_STT_PRICE_PER_MIN || 0.0045);
  var timeoutMs = Number(opts.timeoutMs || 8000);
  var doFetch = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  var now = opts.clock || function () { return new Date(); };

  function monthOf(d) { return d.toISOString().slice(0, 7); }
  var usage = { month: monthOf(now()), calls: 0, failures: 0, seconds: 0, spentUsd: 0, last: null, lastError: null };
  function enabled() { return !!(apiKey && doFetch); }

  /**
   * transcribe({ audio: base64 string, mimeType, seconds }) -> Promise<{ text, model, seconds } | { unavailable: reason } | { invalid: reason }>
   */
  function transcribe(input) {
    input = input || {};
    if (!enabled()) return Promise.resolve({ unavailable: 'speech-to-text is not configured on this server' });
    var seconds = Number(input.seconds);
    if (!input.audio || typeof input.audio !== 'string') return Promise.resolve({ invalid: 'no audio' });
    if (!(seconds > 0) || seconds > MAX_SECONDS) return Promise.resolve({ invalid: 'audio length must be between 0 and ' + MAX_SECONDS + ' s' });
    var bytes = Buffer.from(input.audio, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) return Promise.resolve({ invalid: 'audio is empty or too large' });

    var t = now();
    if (monthOf(t) !== usage.month) usage = { month: monthOf(t), calls: 0, failures: 0, seconds: 0, spentUsd: 0, last: null, lastError: null };
    var cost = pricePerMin * seconds / 60;
    if (usage.spentUsd + cost > budgetUsd) return Promise.resolve({ unavailable: 'monthly speech-to-text budget of $' + budgetUsd + ' reached (SyRD 2.5.1, ADR 0006)' });

    var mime = /^audio\/[a-z0-9.+-]+/i.test(input.mimeType || '') ? input.mimeType.split(';')[0] : 'audio/webm';
    var form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), 'call.' + (mime.split('/')[1] || 'webm'));
    form.append('model', model);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;

    return doFetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form, signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      usage.calls += 1; usage.last = now().toISOString();
      if (res.status !== 200) {
        usage.failures += 1;
        usage.lastError = 'transcription API ' + res.status + ': ' + ((res.body && res.body.error && res.body.error.message) || 'error');
        return { unavailable: usage.lastError };
      }
      usage.seconds += seconds; usage.spentUsd = Math.round((usage.spentUsd + cost) * 1e6) / 1e6;
      var text = res.body && typeof res.body.text === 'string' ? res.body.text.trim() : '';
      if (!text) { usage.failures += 1; return { invalid: 'empty transcript' }; }
      return { text: text, model: model, seconds: seconds };
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      usage.calls += 1; usage.failures += 1; usage.last = now().toISOString();
      usage.lastError = e && e.name === 'AbortError' ? 'transcription API timed out after ' + timeoutMs + ' ms' : 'transcription API unreachable: ' + (e && e.message || e);
      return { unavailable: usage.lastError };
    });
  }

  function status() {
    return { enabled: enabled(), provider: enabled() ? 'hosted transcription API' : 'typed transcript (fallback)', model: enabled() ? model : null,
             budgetUsd: budgetUsd, month: usage.month, calls: usage.calls, failures: usage.failures, seconds: usage.seconds,
             spentUsd: usage.spentUsd, last: usage.last, lastError: usage.lastError };
  }

  return { enabled: enabled, transcribe: transcribe, status: status };
}

module.exports = { createTranscriber: createTranscriber, MAX_SECONDS: MAX_SECONDS };
