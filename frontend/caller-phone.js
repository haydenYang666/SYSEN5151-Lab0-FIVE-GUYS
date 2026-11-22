/*
 * Caller phone (X.1 Citizen · Interface 1, voice) — front end only.
 * Simulates the emergency call the citizen makes: the AI voice assistant asks where they are and what help
 * they need, registers the report through the same REST route as everything else (POST /api/distress-reports,
 * passed in as `register`), then reads the details and the receipt back. The citizen sees only what the
 * system gives them (UC.1.3 receipt: registration, not dispatch).
 * Speech: when the page passes `transcribe` (caller.html with a server that has speech-to-text, ADR 0006), the citizen
 * can speak the description; the transcript fills the field for review before calling. Otherwise the words are typed.
 * Used twice: embedded in the dispatch console (index.html) and full screen on a real phone (caller.html).
 */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mmss(ms) { var t = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }

  /**
   * @param {HTMLElement} el
   * @param {{register: function(string, string): Promise<{ok: boolean, report?: object, receipt?: object, error?: string}>,
   *          location?: string, description?: string, allowNewCall?: boolean, pace?: number,
   *          onChange?: function(object), onRegistered?: function(object)}} opt
   */
  function mount(el, opt) {
    var pace = opt.pace || 1, st, timer = null;
    function fresh() { return { rec: null, note: null, stage: 'idle', lines: [], typing: false, loc: opt.location || '', desc: opt.description || '', report: null, receipt: null, error: null, t0: 0, t1: 0 }; }
    st = fresh();

    function statusBar() {
      return '<div class="cp-status"><span>' + new Date().toTimeString().slice(0, 5) + '</span><span class="cp-sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>';
    }
    function bubbles() {
      return '<div class="cp-chat" aria-live="polite">' + st.lines.map(function (l) {
        return '<div class="cp-b ' + l.who + '"><span class="cp-who">' + (l.who === 'ai' ? 'AI assistant' : 'You') + '</span>' + esc(l.text) + '</div>';
      }).join('') + (st.typing ? '<div class="cp-b ai typing" aria-label="Assistant is speaking"><i></i><i></i><i></i></div>' : '') + '</div>';
    }
    function render() {
      var h = statusBar();
      if (st.stage === 'idle') {
        h += '<div class="cp-idle"><div class="cp-line"><b>Emergency</b><span>RescuTech emergency line · Tompkins County</span></div>' +
          '<label class="cp-f"><span>You say: where are you?</span><input data-f="loc" type="text" autocomplete="off" value="' + esc(st.loc) + '"></label>' +
          '<label class="cp-f"><span>You say: what is happening?</span><textarea data-f="desc">' + esc(st.desc) + '</textarea></label>' +
          (opt.transcribe ? '<button type="button" class="cp-again cp-mic" data-ph="' + (st.rec ? 'stop' : 'speak') + '">' + (st.rec ? 'Stop and transcribe' : 'Speak instead of typing') + '</button>' : '') +
          (st.note ? '<p class="cp-note" role="status">' + esc(st.note) + '</p>' : '') +
          (st.error ? '<p class="cp-err" role="alert">' + esc(st.error) + '</p>' : '') +
          '<button type="button" class="cp-call" data-ph="call" aria-label="Call the emergency line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg></button>' +
          '<p class="cp-note">Simulated call · ' + (opt.transcribe ? 'speak or type your words' : 'your words are entered as text') + '. Fictional scenario.</p></div>';
      } else {
        var live = st.stage === 'dialing' || st.stage === 'talking';
        h += '<div class="cp-head"><span class="cp-av" aria-hidden="true">AI</span><div><b>RescuTech Emergency</b><span>' +
          (st.stage === 'dialing' ? 'Calling…' : live ? 'AI voice assistant · call recorded' : st.stage === 'done' ? 'Call ended' : 'Call failed') + '</span></div>' +
          '<span class="cp-timer">' + (st.t0 ? mmss((st.t1 || Date.now()) - st.t0) : '00:00') + '</span></div>' + bubbles();
        if (st.stage === 'done') {
          h += '<div class="cp-receipt"><span class="cp-k">Report registered</span><b>' + esc(st.report.id) + '</b><p>' + esc(st.receipt.message) + '</p></div>' +
            (opt.allowNewCall ? '<button type="button" class="cp-again" data-ph="again">New call</button>' : '');
        } else if (st.stage === 'failed') {
          h += '<div class="cp-receipt bad"><span class="cp-k">Not registered</span><p>' + esc(st.error) + '</p></div><button type="button" class="cp-again" data-ph="retry">Try again</button>';
        } else {
          h += '<button type="button" class="cp-end" disabled aria-label="End call (the assistant ends the call)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9c-1.6 0-3.2.3-4.6.7v3.1c0 .4-.2.7-.6.9-1 .5-1.9 1.1-2.7 1.8-.2.2-.4.3-.7.3s-.5-.1-.7-.3L.3 13.1A1 1 0 0 1 0 12.4c0-.3.1-.5.3-.7C3.3 8.8 7.4 7 12 7s8.7 1.8 11.7 4.7c.2.2.3.4.3.7s-.1.5-.3.7l-2.4 2.4c-.2.2-.4.3-.7.3s-.5-.1-.7-.3c-.8-.7-1.7-1.3-2.7-1.8-.3-.2-.6-.5-.6-.9V9.7C15.2 9.3 13.6 9 12 9z"/></svg></button>';
        }
      }
      el.innerHTML = h;
      var chat = el.querySelector('.cp-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
      if (opt.onChange) opt.onChange(st);
    }
    function say(who, text, ms) {
      st.typing = who === 'ai'; render();
      return wait(ms * pace).then(function () { st.typing = false; st.lines.push({ who: who, text: text }); render(); });
    }
    function start() {
      if (st.stage !== 'idle') return;
      var l = el.querySelector('[data-f="loc"]'), d = el.querySelector('[data-f="desc"]');
      st.loc = l ? l.value.trim() : st.loc; st.desc = d ? d.value.trim() : st.desc;
      st.stage = 'dialing'; st.lines = []; st.error = null; st.t0 = 0; st.t1 = 0; render();
      if (!timer) timer = setInterval(function () { if (st.stage === 'talking') { var t = el.querySelector('.cp-timer'); if (t) t.textContent = mmss(Date.now() - st.t0); } }, 1000);
      wait(900 * pace).then(function () {
        st.stage = 'talking'; st.t0 = Date.now();
        return say('ai', 'RescuTech emergency line. I am an automated assistant and this call is recorded. Where are you right now?', 900);
      }).then(function () { return say('me', st.loc || '…', 800); })
        .then(function () { return say('ai', 'Thank you. What is happening, and what help do you need?', 900); })
        .then(function () { return say('me', st.desc || '…', 900); })
        .then(function () { return say('ai', 'Thank you. I am registering your report now. Please stay on the line.', 800); })
        .then(function () { st.typing = true; render(); return opt.register(st.loc, st.desc); })
        .then(function (res) {
          st.typing = false;
          if (!res || !res.ok) {
            st.error = (res && res.error) || 'The emergency line could not be reached.';
            return say('ai', 'Sorry, I could not register that. ' + st.error, 500).then(function () { st.stage = 'failed'; st.t1 = Date.now(); render(); });
          }
          st.report = res.report; st.receipt = res.receipt;
          return say('ai', 'I have your location as “' + (res.report.location || st.loc) + '”. ' + res.receipt.message, 700).then(function () {
            st.stage = 'done'; st.t1 = Date.now(); render();
            if (opt.onRegistered) opt.onRegistered(res);
          });
        }, function (e) {
          st.typing = false; st.error = 'The emergency line could not be reached (' + (e && e.message || e) + ').'; st.stage = 'failed'; st.t1 = Date.now(); render();
        });
    }
    // Records the description and asks the page to transcribe it (POST /api/transcriptions, UC.1.2).
    function speak() {
      if (!navigator.mediaDevices || !window.MediaRecorder) { st.note = 'Recording is not available in this browser. Please type.'; render(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var mr = new MediaRecorder(stream), chunks = [];
        mr.ondataavailable = function (e) { chunks.push(e.data); };
        mr.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          var seconds = (Date.now() - st.rec.t0) / 1000;
          st.rec = null; st.note = 'Transcribing…'; render();
          opt.transcribe(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), seconds).then(function (r) {
            if (r.ok) { st.desc = r.transcript; st.note = 'Transcribed. Check the text, then call.'; }
            else st.note = r.queued ? 'No connection: your recording is saved and will be transcribed when the connection returns.' : (r.error || 'Speech-to-text is not available.') + ' Please type.';
            render();
          });
        };
        mr.start(); st.rec = { mr: mr, t0: Date.now() }; st.note = 'Recording… tap Stop when you have finished.'; render();
      }, function () { st.note = 'Microphone permission was refused. Please type.'; render(); });
    }
    function stopSpeaking() { if (st.rec) st.rec.mr.stop(); }
    function setTranscript(text) { st.desc = text; st.note = 'Your saved recording was transcribed. Check the text, then call.'; render(); }
    function reset() { var keepLoc = st.loc, keepDesc = st.desc; st = fresh(); if (keepLoc) st.loc = keepLoc; if (keepDesc) st.desc = keepDesc; render(); }
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ph]'); if (!b) return;
      var a = b.getAttribute('data-ph');
      if (a === 'call') start(); else if (a === 'again' || a === 'retry') reset();
      else if (a === 'speak') speak(); else if (a === 'stop') stopSpeaking();
    });
    render();
    return { start: start, reset: function () { st = fresh(); render(); }, state: function () { return st; }, setTranscript: setTranscript };
  }
  root.RescuTechCallerPhone = { mount: mount };
})(this);
