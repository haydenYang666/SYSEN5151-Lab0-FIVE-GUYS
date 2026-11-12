# ADR 0005 — Voice intake is represented by its transcript; team status is pushed

Date: 2026-11-11 · Status: accepted · Context: Modeling and Simulation study (Lab Manual Ch. 10)

## Context
The Monte Carlo simulation of the original UC.1 (typed report, every team polled for each incident) gave a mean
completion time of 7.61 min, slower than a conventional 911/CAD dispatch modeled as UC.4 (4.66 min). The two
largest contributors were UC.1.1 (typing the report) and UC.1.6 (waiting for every team to answer the status poll).
The team revised UC.1 in Innoslate first: the Citizen calls, an AI voice intake agent answers at once and transcribes
the call, and Rescue Teams push status whenever it changes (IO.3 and IO.4 became optional flows). The revised model
simulates at 3.42 min.

## Decision
1. **Status push is implemented as modeled.** `F.2.3` keeps the latest pushed status per team
   (`PUT /api/teams/:teamId/status`, UC.1.6). `retrieveLatestTeamStatus` (UC.1.5, contract v1.2.0, renamed from
   `requestResourceStatus`) reads it and sends IO.3 Status Refresh Request only to teams whose status is older than
   10 minutes or incomplete. Nothing waits for refresh replies. The 10-minute threshold is an assumption to revisit
   with Rescue Team input.
2. **Voice intake is represented by the call transcript.** The prototype has no telephony or speech recognition.
   `POST /api/distress-reports` accepts `{ location, transcript, channel: "voice" }`; the text form remains as
   `channel: "text"`. Everything after transcription (registration, structuring by the Claude agent, read-back
   receipt) runs as modeled.

## Consequences
- Measured timings (`scripts/measure-uc1.js`) cover the system stages after transcription. Speech-recognition and
  telephony latency are not measured; the simulation keeps their assumed durations, and the report states this as
  a known divergence between the built system and the model.
- `PUT /api/incidents/:id/team-status/:teamId` stays as the refresh reply for one incident (same push).
- Adding telephony and speech-to-text is future work; it would plug in before `submitDistressReport` without
  changing the contract.
