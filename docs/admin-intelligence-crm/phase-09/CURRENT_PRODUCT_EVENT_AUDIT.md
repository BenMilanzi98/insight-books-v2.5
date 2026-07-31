# Current Product Event Audit

| Item | Class | Evidence |
|------|-------|----------|
| AnalyticsOutbox / AnalyticsEvent | CORRECT_AND_REUSABLE | Prisma + `lib/admin/analytics` |
| Verified emitters today | PARTIAL | Tenant lifecycle, subscription, platform billing, admin login (`emit.js`) |
| `emitUserLogin` | DISCONNECTED | Defined; **no call sites** |
| `FEATURE_USED` | NOT_INSTRUMENTED | Scaffold-only in catalogue; not in VERIFIED_EMITTERS |
| Invoice / POS / Payroll / Inventory producers | NOT_INSTRUMENTED | Domain tables exist; no outbox emit |
| MRA accepted → AnalyticsEvent | NOT_INSTRUMENTED | Transmission/receipt tables are candidates only |
| Browser page-view as authoritative | FORBIDDEN | Must not become value |

**Wave 1 target producers (locked):** Sales Invoice posted, POS completed, MRA EIS accepted — idempotent keys on source id.
