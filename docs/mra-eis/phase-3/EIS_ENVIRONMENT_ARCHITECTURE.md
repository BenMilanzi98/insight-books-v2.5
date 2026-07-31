# EIS Environment Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Env | Base URL | Credentials | Allowed |
|---|---|---|---|
| test/mock | mock server | fixtures | Contract tests |
| sandbox | dev-eis-api.mra.mw | sandbox terminal | Cert prep |
| production | eis-api.mra.mw | prod terminal | After cert + admin |

Environment stored on **terminal + transmission**. Client cannot override. Sandbox terminal cannot use production client.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
