# ADR 0004 — Contract fields and error conditions that the implementation only partly uses yet

**Status:** Accepted (2026-10-25)

## Context
The contract was written from the model's flow descriptions, so it carries information that the walking skeleton
did not use before. Two gaps showed up when the generated stubs were compared with the existing code:

1. **IO.11 Incident Resource Needs.** In the model, F.2.3 uses the incident's location and required capabilities
   "to query current resource status". The old `requestResourceStatus(incidentId)` took only an ID and asked every
   simulated team, ignoring the needs.
2. **Invalid model output (SyRD.1 2.3.1, 2.3.3).** The contract gives `structureIncident` a 422 response: when the
   structured information fails schema validation, no IO.11 or IO.12 is produced and the incident goes to the
   Emergency Coordinator for manual handling. The old code had no such path; the keyword stub cannot produce
   invalid output.

## Decision
1. F.2.3 now **receives** IO.11 through the contract and records it with the status request, but **still asks all
   teams** (`requestedTeamIds` lists the whole roster). With five simulated teams, narrowing the query adds nothing
   to the demonstration; F.2.4 already excludes teams that lack a required capability. Narrowing the query by
   zone and capability is deferred to the physical-architecture work (Ch. 8).
2. F.2.2 now **checks** the structurer's output (capabilities in the allowed set, urgency High/Standard, list
   fields present). If the check fails, it records the incident as `MANUAL_HANDLING`, produces no internal flows,
   and the route returns 422. This is the contract's error path. It is not yet exercised by an acceptance check,
   because the keyword stub always returns valid output; TC.SYS.2.3.1 and TC.SYS.2.3.3 (SyRD.1) will be
   implemented when the language-model agent replaces the stub.

## Consequences
- `contracts/api-v1.yaml` stays the authority: the code may use less of a flow than the contract carries, never
  more than the contract allows.
- Two open items are visible rather than hidden: the status query is not narrowed by IO.11, and the 2.3.1/2.3.3
  path has no acceptance check yet.

## Model entities affected
F.2.2, F.2.3; IO.11, IO.12; requirements 1.2.2, 2.3.1, 2.3.3 (SyRD.1); TC.SYS.2.3.1, TC.SYS.2.3.3.
