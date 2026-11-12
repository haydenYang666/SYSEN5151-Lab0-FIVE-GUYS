# UC.1 measured vs simulated (Modeling and Simulation, Lab Manual 10.4)

- Date: 2026-11-12T00:33:38.041Z
- Runs: 30 (outcomes: dispatched 30)
- Structuring and briefing: Claude agent, model claude-haiku-4-5
- Claude usage for these runs: 60 calls, 0 failures, about $0.1058
- Input: 10 scripted call transcripts (tests/fixtures/distress-calls.json), voice channel, cycled
- Server time = entry to exit inside the server at the participant boundary; client time = HTTP round trip from this script (same machine).
- Human actions (UC.1.1, UC.1.3, UC.1.6, UC.1.10, UC.1.11, UC.1.13, UC.1.16) are driven instantly by the script and are not measured.

| Stage | Simulated (s) | Sim. mean (ms) | n | Measured mean (ms) | SD (ms) | Min (ms) | Max (ms) | Client round trip mean (ms) |
|---|---|---|---|---|---|---|---|---|
| UC.1.2 Answer and Transcribe Call (S.1.1) | Normal(1, 0.3) | 1000 | 30 | 0.03 | 0.02 | 0.01 | 0.12 | 0.90 |
| UC.1.4 Structure Incident Information (S.1.2), total | Normal(3, 1) | 3000 | 30 | 1213.80 | 98.65 | 1077.53 | 1526.76 | 1215.02 |
|   of which: Claude structuring call | (part of UC.1.4) | – | 30 | 1213.73 | 98.62 | 1077.46 | 1526.56 | – |
| UC.1.5 Retrieve Latest Team Status (S.1.3) | Normal(0.3, 0.05) | 300 | 30 | 0.06 | 0.02 | 0.03 | 0.14 | 1.33 |
| UC.1.7 Update Resource Availability (S.1.3) | Normal(0.3, 0.05) | 300 | 30 | 0.03 | 0.01 | 0.01 | 0.07 | – |
| UC.1.8 Evaluate Resource Suitability (S.1.4) | Normal(0.5, 0.1) | 500 | 30 | 0.07 | 0.04 | 0.03 | 0.19 | – |
| UC.1.9 Present Dispatch Recommendation: Claude briefing (S.1.4) | Normal(2.5, 0.8) | 2500 | 30 | 1179.29 | 130.94 | 965.07 | 1522.11 | – |
| UC.1.12 Issue Dispatch Order (S.1.5) | Normal(0.5, 0.1) | 500 | 30 | 0.06 | 0.05 | 0.02 | 0.29 | 1.08 |
| UC.1.14 Record Dispatch Acknowledgment (S.1.5) | Normal(0.3, 0.05) | 300 | 30 | 0.05 | 0.06 | 0.01 | 0.35 | 1.22 |
| UC.1.15 Present Dispatch Status (S.1.5) | Normal(0.3, 0.05) | 300 | 30 | 0.03 | 0.03 | 0.01 | 0.17 | 0.81 |

Divergence explanation and the decision (update simulation parameters, architecture, or neither): to be written by the team after checking the data.
