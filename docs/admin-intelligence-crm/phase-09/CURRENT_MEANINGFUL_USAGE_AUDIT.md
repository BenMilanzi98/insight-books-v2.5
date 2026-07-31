# Current Meaningful Usage Audit

| Claimed “usage” source | Class | Verdict |
|------------------------|-------|---------|
| User.lastLogin | WRONG_SOURCE for value | Engagement proxy only (Phase 7/8) |
| Route / page open | PAGE_VIEW_ONLY | Discovery telemetry at best — not value |
| Invoice / Sale / Payroll rows | CANDIDATE_EVIDENCE | Authoritative records exist; **not** AnalyticsEvents yet |
| EISUsage monthly rollup | UNRECONCILED / CANDIDATE | Counts may include retries — must not feed first value until classified |
| MraEisFiscalReceipt / accepted transmission | CANDIDATE_EVIDENCE | Best EIS first-value candidate once producer exists |
| MobileAppClientEvent | WRONG_SCOPE | Update/download only |

**Standard:** Meaningful action = server-verified completed workflow with source id + idempotency. Strict events lock: candidates documented; metrics NOT_INSTRUMENTED until producers ship.
