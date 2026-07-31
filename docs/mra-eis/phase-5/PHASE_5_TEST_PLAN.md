# Phase 5 Test Plan

| Suite | File |
|---|---|
| State machines | `test/mraEis.phase5.stateMachines.test.js` |
| Value objects | `test/mraEis.phase5.valueObjects.test.js` |
| Secret hygiene / SQL constraints | `test/mraEis.phase5.noSecrets.test.js` |
| Phase 4 regression | `test/mraEis.phase4.*.test.js` |

DB concurrency tests require PostgreSQL up + migrated schema.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
