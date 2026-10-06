# System context inventory

Source: Innoslate project 584 — Universe asset diagram / system context diagram (S.1 and X.1–X.3).
Everything that crosses the S.1 boundary, in which direction, and in what form. This is the ancestor of the
interface contract (Lab Manual Ch. 7).

| External element | Interface | Direction | Item | Form in the skeleton |
|------------------|-----------|-----------|------|----------------------|
| X.1 Citizen | Interface 1 | in | Distress Report | JSON `{location, description}` → `POST /api/distress-reports` |
| X.1 Citizen | Interface 1 | out | Report Receipt | JSON `{reportId, message}` in the 201 response |
| X.2 Emergency Coordinator | Interface 3 | out | Incident and Recommendation | JSON incident + `{teamName, rationale[], alternatives[]}` |
| X.2 Emergency Coordinator | Interface 3 | in | Dispatch Approval | `POST /api/recommendations/:id/approval` |
| X.2 Emergency Coordinator | Interface 3 | out | Dispatch Status | `GET /api/dispatch-orders/:id/status` → `{code, label}` |
| X.3 Rescue Team | Interface 4 | out | Resource Status Request | `POST /api/incidents/:id/status-requests` |
| X.3 Rescue Team | Interface 4 | in | Resource Status | `PUT /api/incidents/:id/team-status/:teamId` `{available, zoneKey, capabilities}` |
| X.3 Rescue Team | Interface 4 | out | Dispatch Order | JSON `{location, task, urgency, approvalId}` |
| X.3 Rescue Team | Interface 4 | in | Dispatch Acknowledgment | `POST /api/dispatch-orders/:id/acknowledgment` `{teamId}` |

Outside the boundary: physical rescue, route planning, real GIS, agency systems.
Inside S.1: service layer, Incident Structuring Agent (model participant, stub), suitability evaluation (stub),
dispatch authority guard (SR.6), status from recorded events (SR.7).
