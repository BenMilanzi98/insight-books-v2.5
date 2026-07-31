# Test Coverage Audit

**Date:** 2026-07-28

## Existing (REUSE)

| Area | Evidence |
|------|----------|
| Platform billing helpers / phase3 | `test/systemAdmin.platformBilling.test.js`, `test/systemAdmin.phase3.billing.test.js` |
| Admin UI wave / permissions | `test/systemAdmin*.test.js` |
| MRA EIS domain tests | Under `test/` / mraEis suites (capability, entitlement — verify locally) |

## Missing for master prompt (GAP)

- Public pricing DB-driven + draft hidden  
- Checkout idempotency + amount reject  
- Payment callback replay → no duplicate PlatformPayment  
- EIS trial / conversion  
- Upgrade/downgrade/proration  
- Usage metering excluding retries  
- Subscription↔entitlement reconciliation  
- Multi-tenant IDOR matrix for EIS checkout  
- Responsive/a11y for pricing + wizard  

Classification: INCOMPLETE relative to acceptance criteria §55.
