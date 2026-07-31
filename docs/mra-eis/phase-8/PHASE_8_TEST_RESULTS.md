# Phase 8 Test Results

Run:

```bash
npx vitest run test/mraEis.phase8.configuration.test.js
```

**Result (2026-07-23):** 14/14 passed (1 file).

Coverage: type registry, request mappers, response parser (HTTP 200 alone, missing version, TIN mismatch), version comparison (idempotent + conflict), mock success/block, tax/levy/offline/receipt extraction, pause contract, BOD timezone, end-to-end mock parse for GLOBAL/TERMINAL/TAXPAYER.

DB-backed orchestrator E2E requires `prisma migrate deploy` + `prisma generate` when Postgres is available.

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
