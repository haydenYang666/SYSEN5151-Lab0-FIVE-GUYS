/*
 * F.2.1 Register Distress Reports (first-level function of F.2, Innoslate project 584).
 *   Inputs : IO.1 Distress Report (external, from F.1 Citizen)
 *   Outputs: IO.2 Report Receipt (external, to F.1); IO.10 Registered Report (internal, to F.2.2)
 *   Satisfies: 1.1.1, 1.2.1, 1.3.1, 2.1.2   UC.1 steps: UC.1.1–UC.1.3
 * IO.10 leaves this module only as the RegisteredReport schema of contracts/api-v1.yaml.
 * Mechanism: S.1.1 Report Intake Subsystem.
 *
 * Revised Nov 2026 with UC.1: the primary channel is a voice call answered by an AI voice intake agent
 * (UC.1.1 Call Emergency Line, UC.1.2 Answer and Transcribe Call, UC.1.3 Confirm Report Details); the text
 * form stays as the fallback. The prototype does not do speech recognition: a voice report arrives as its
 * transcript with channel "voice" (docs/decisions/0005-voice-intake-as-transcript.md).
 */
(function (root) {
  'use strict';
  var Common = (typeof module !== 'undefined' && module.exports) ? require('./common.js') : root.RescuTechCommon;

  function create(ctx) {
    var reports = {};

    // UC.1.1 Call Emergency Line (X.1 Citizen, C.1 Citizen Intake Interface) — SR.1 / N.1, 2.1.2
    // input: { location, description | transcript, channel: 'voice' | 'text' }
    function submitDistressReport(input) {
      var channel = input.channel === 'voice' ? 'voice' : 'text';
      var report = {
        location: (input.location || '').trim(),
        description: (input.transcript || input.description || '').trim(),
        channel: channel
      };
      if (!report.location || !report.description) {
        ctx.log('UC.1.1', 'Citizen', 'Report incomplete: location and description of assistance are both required' +
                (channel === 'voice' ? '; the agent asks again or transfers the call to the Emergency Coordinator (2.3.3).' : '.'), ['SR.1'], 'warn');
        return { ok: false, error: 'Please tell us where you are and what help you need.' };
      }
      ctx.log('UC.1.1', 'Citizen', channel === 'voice' ? 'Emergency call placed on Interface 1 (voice).' : 'Distress report submitted on Interface 1 (text fallback).', ['SR.1', 'N.1']);
      return registerDistressReport(report);
    }

    // UC.1.2 Register Distress Report -> UC.1.3 Receive Report Receipt (IO.2) — SR.2 / N.2
    function registerDistressReport(report) {
      var id = ctx.nextId('R');
      report.id = id;
      report.registeredAt = ctx.now();
      reports[id] = report;
      ctx.log('UC.1.2', 'RescuTech', (report.channel === 'voice' ? 'Call answered and transcribed; report ' : 'Report ') + id + ' registered.', ['SR.2', '2.1.8']);
      var receipt = {
        reportId: id,
        message: 'Your report ' + id + ' has been registered. This confirms registration only; ' +
                 'it does not mean a team has been assigned or dispatched.'
      };
      ctx.log('UC.1.3', 'Citizen', (report.channel === 'voice' ? 'Report details read back to the caller and confirmed for ' : 'Registration receipt delivered for ') + id + '.', ['SR.2', 'N.2']);
      return { ok: true, report: report, receipt: receipt };
    }

    // IO.10 Registered Report, shaped as contracts/api-v1.yaml#/components/schemas/RegisteredReport
    function registeredReport(reportId) {
      var r = reports[reportId];
      if (!r) return null;
      return { reportId: r.id, location: r.location, description: r.description, channel: r.channel, registeredAt: Common.iso(r.registeredAt) };
    }

    return { reports: reports, submitDistressReport: submitDistressReport, registeredReport: registeredReport };
  }

  var api = { id: 'F.2.1', create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RescuTechF21 = api;
})(this);
