# ADR 0006 — Speech-to-text through a hosted transcription API (provisional)

Date: 2026-11-22 · Status: accepted, provisional · Context: System Analysis trade study (Lab Manual Ch. 11),
Innoslate Decision D.1 *Speech-to-Text Approach*

## Context
ADR 0005 represented voice intake by its transcript, so SyRD 2.1.8 (answer and register within 5 s) could not be
verified. The stakeholder analysis left the input technology open ("voice entry … design choices to evaluate later",
Citizen persona). The open question was how the Report Intake Subsystem (S.1.1) turns the Citizen's voice into the
transcript used by UC.1.2 and F.2.1. Telephony is out of scope: the Citizen uses the RescuTech caller web page.

## Alternatives (S.1.1.A1–A3 in Innoslate)
| | A1 Browser speech recognition | A2 Hosted transcription API | A3 Local Whisper model in the browser |
|---|---|---|---|
| How | Web Speech API in the caller page | Page records audio, server calls the provider with a server-side key | Whisper base (8-bit, ~77 MB) via Transformers.js |
| Audio goes to | Browser vendor's service (default) | Our server and one provider | Stays on the device |
| Works offline | No | Records offline, sends later | Yes, once the model is cached |

## Criteria and measures
Swing weights (confirmed by the team, 2026-11-22): C1 time to transcript 0.278, C4 degraded-network operation 0.250,
C2 key-field accuracy 0.222, C3 caller-data exposure 0.139, C5 caller device coverage 0.111.

Spike, 2026-11-22 (Yanda Shen; ten storm calls each, Windows desktop, Chrome; `frontend/stt-spike.html`,
`scripts/stt-spike/hosted.js`):

| | C1 median | C2 key fields correct |
|---|---|---|
| A1 browser recognition | 0.08 s | 5/10 |
| A2 hosted API (gpt-transcribe) | 0.83 s | 7/10 |
| A3 Whisper base.en, WebGPU | 1.01 s (first call 3.84 s, model load 10.0 s) | 4/10 |

C3 and C4 come from the design; C5 from published browser support (only a desktop was tested).
Weighted value: **A3 76.3, A2 74.0**, A1 36.9. 36-month LCC: A1 USD 2,835, A2 6,283, A3 6,573.

## Decision
**A2, hosted transcription API**, implemented in `speech-intake/transcriber.js`, route `POST /api/transcriptions`
(UC.1.2) and the caller page (`frontend/caller.html`, "Speak instead of typing"). The transcript fills the
description field for the Citizen to check before calling; registration is unchanged (`POST /api/distress-reports`).

A3 scored 2.3 points higher, but A2 is selected because:
1. the margin is inside the measurement uncertainty: A2 is first again if the C2 weight exceeds 0.26 or the C4
   weight falls below 0.19, and one C2 call for A2 is worth 4.4 points;
2. A3's C1 was measured on a desktop GPU; A2 overtakes A3 once A3's C1 exceeds about 1.8 s, which is likely on phones;
3. A2 had the best key-field accuracy (7/10), the criterion tied to TR.1.

The decision is provisional: repeat the spike on an Android phone and an iPhone before a pilot; if A3's median C1
there stays below 1.8 s, or caller-data exposure is weighted higher, re-run the trade.

## Budget (SyRD 2.5.1)
The Week 10 apportionment gave S.1.1 USD 0 of the USD 50/month model budget (S.1.2 30, S.1.4 20). A2 runs at about
USD 2.70/month (300 calls × 2 min × USD 0.0045/min). Measured Claude spend is about USD 0.0018 per call
(60 calls for USD 0.11), roughly USD 1/month at the same volume, so S.1.2 and S.1.4 have ample margin.
The budget is re-apportioned: **S.1.1 USD 5 (10 %), S.1.2 USD 27 (54 %), S.1.4 USD 18 (36 %), S.1.3 and S.1.5 USD 0**.
`RESCUTECH_STT_BUDGET_USD` (default 5) enforces the S.1.1 share; CRD 2.3.1 (S.1.5 makes no model calls) is unchanged.
If A3 is chosen instead, S.1.1 needs no budget and the Week 10 split can stay.

## What the losing alternatives would have required
- **A1:** a microphone button and result handling in the caller page (~8 h). It needs no account, but recognition
  goes to the browser vendor without an agreement, does not work offline, and is missing in Edge and Firefox.
- **A3:** model loading and caching, inference in a web worker, and a WebGPU/WASM fallback (~30 h); no account and no
  data leaves the phone, but transcription takes several seconds on a phone and the first load downloads ~77 MB.

## Consequences
- With `OPENAI_API_KEY` unset, or when the provider fails, is slow (8 s timeout) or the S.1.1 budget is used up, the
  route answers 503 and the Citizen types the report (SR.1 text fallback). Tests S.1–S.7 (`tests/transcriber.spec.js`)
  use a mocked provider; CI runs them.
- Offline, the caller page keeps the recording and sends it when the connection returns (SyRD 2.2.2).
- C3 holds at 70 only with a data agreement with the provider; until then the key is not configured in the demo.
- The key is read from the server environment only and never reaches the browser, a response or the log (test S.6).

## Model entities affected
Decision D.1 (Justification, Assumptions), S.1.1.A1–A3, criteria C1–C5, S.1.1, UC.1.2; SyRD 2.1.8, 2.2.2, 2.5.1.
