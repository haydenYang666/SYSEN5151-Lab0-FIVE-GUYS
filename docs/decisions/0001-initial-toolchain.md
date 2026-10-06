# ADR 0001 — Initial toolchain

**Status:** Proposed — team to confirm.

## Decision
Build the walking skeleton in dependency-free Node.js (REST service + static front end) so it runs with one
command and the same route table can also run in the browser for demos. Keep the language-model participant
as a stub until its response contract (SPEC.md §3) is implemented; plan for a locally hosted model, the course
default, because distress reports could contain personal information.

## Evidence that would change this decision
- The Week 12 trade study shows a hosted model is needed for extraction accuracy or latency.
- The team prefers Python/FastAPI to match course tutorials; the route table in `routes.js` ports directly.
