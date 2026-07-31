# Phase 5 Test Results

## Latest run (2026-07-22)

```
npx vitest run test/mraEis.phase5*.test.js
Test Files  4 passed (4)
Tests       17 passed (17)
```

Suites:
- `mraEis.phase5.stateMachines.test.js`
- `mraEis.phase5.valueObjects.test.js`
- `mraEis.phase5.noSecrets.test.js`
- `mraEis.phase5.domainEvents.test.js`

Unit/domain suites are DB-independent.

## Database-dependent

`npx prisma migrate deploy` — **not applied** in this environment (`P1001` cannot reach `127.0.0.1:5432`).
Concurrency / claim / sequence integration tests require PostgreSQL up + migrated schema.

Dry-run: `node scripts/mra-eis-phase5-migration-dry-run.js`

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
