# Automated Test Results — Reversals + Tax Management

**Date:** 2026-07-26

## Suites run this delivery

| Suite | Result |
|-------|--------|
| `test/reversalEngine.facade.test.js` | PASS (aliases + constants) |
| `test/taxManagement.purposes.test.js` | PASS |
| `test/taxManagement.wave4-5.test.js` | PASS (statuses + period bounds) |
| `test/taxManagement.remaining.test.js` | PASS (backfill/supersede/recon exports) |
| `test/reversalSodPolicy.test.js` | PASS (SoD same-actor rejection) |
| `test/taxManagementTenantScope.test.js` | PASS (static IDOR / tenant scope) |
| `test/taxManagementReversals.idor.live.test.js` | **15/15 PASS** (live dual-tenant IDOR) |
| Combined foundation batch | **11/11 PASS** (earlier) |
| `test/accountingV2.ledger.test.js` | Pre-existing strong V2 reverse coverage |

## Not yet automated
- Full document reverse execute E2E against live GL
- Tax period/return state machine golden fixtures
- Reconciliation suite golden fixtures

## Command

```bash
npx vitest run test/reversalSodPolicy.test.js test/taxManagementTenantScope.test.js test/taxManagementReversals.idor.live.test.js
```

