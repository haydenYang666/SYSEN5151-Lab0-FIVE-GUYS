# Walking skeleton — UC.1 call list

Transcribed from the Innoslate Sequence Diagram for UC.1 "Coordinator Dispatches Resources to a Distress
Report". Participant names are the asset names in the model.

| # | From → To | Message (model) | Call in the product | Participant status |
|---|-----------|-----------------|---------------------|--------------------|
| 1 | Citizen → RescuTech | UC.1.1 Submit Distress Report | `POST /api/distress-reports` | Front end real |
| 2 | RescuTech | UC.1.2 Register Distress Report | `registerDistressReport()` | Real |
| 3 | RescuTech → Citizen | UC.1.3 Receive Report Receipt | 201 response `receipt` | Real |
| 4 | RescuTech | UC.1.4 Structure Incident Information | `POST /api/distress-reports/:id/incident` → `incident-structuring-agent` | **Stub** (model participant) |
| 5 | RescuTech → Rescue Team | UC.1.5 Request Resource Status | `POST /api/incidents/:id/status-requests` | Real |
| 6 | Rescue Team → RescuTech | UC.1.6 Provide Resource Status | `PUT /api/incidents/:id/team-status/:teamId` ← `resource-status-source` | **Stub** (data participant) |
| 7 | RescuTech | UC.1.7 Evaluate Resource Suitability | `evaluateResourceSuitability()` | **Stub** rules |
| 8 | RescuTech → Coordinator | UC.1.8 Present Dispatch Recommendation | `POST /api/incidents/:id/recommendation` | Real |
| 9 | Coordinator | UC.1.9 Review Dispatch Recommendation | console view | Real |
| 10 | Coordinator → RescuTech | UC.1.10 Approve Resource Assignment | `POST /api/recommendations/:id/approval` | Real |
| 11 | RescuTech → Rescue Team | UC.1.11 Issue Dispatch Order | `POST /api/recommendations/:id/dispatch-order` (409 without approval) | Real |
| 12 | Rescue Team → RescuTech | UC.1.12 Acknowledge Dispatch Order | `POST /api/dispatch-orders/:id/acknowledgment` | Real |
| 13 | RescuTech | UC.1.13 Record Dispatch Acknowledgment | `recordDispatchAcknowledgment()` | Real |
| 14 | RescuTech → Coordinator | UC.1.14 Present Dispatch Status | `GET /api/dispatch-orders/:id/status` | Real |
| 15 | Coordinator | UC.1.15 Review Dispatch Status | console view | Real |

Not in this increment (no requirement yet): real data access, real model call, retries, persistence.
