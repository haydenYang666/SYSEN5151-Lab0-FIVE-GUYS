# Toolchain

> Status: **proposed — team to confirm** before the Week 12 trade study.

| Item | Current choice |
|------|----------------|
| Language / runtime | JavaScript, Node.js 18+ (no third-party dependencies in the skeleton) |
| API | Node `http` server in `rescutech-orchestrator/server.js` |
| Front end | Static HTML/CSS/JS in `frontend/` |
| Model runner | Not connected yet — `incident-structuring-agent/` is a stub. Course default is a locally hosted model (e.g. LM Studio). |
| CI | GitHub Actions, `.github/workflows/ci.yml` runs `npm test` |
| Assistants | _Each member: record which coding assistant you use_ |
