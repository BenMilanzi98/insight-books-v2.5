# Current Closed-Won Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| `closeOpportunityWon` | READY | CORRECT_AND_REUSABLE | `lib/admin/crm/opportunities/close.js` — evidence + win reason; `assertNoProvision` |
| Close alone ≠ provision | READY | CORRECT_AND_REUSABLE | Orchestrator calls close once at durable start; honesty flags |
| Commercial Closed-Won readiness | PARTIAL | EXTEND | `commercial/readiness.js` — acceptance version/checksum/authority blockers |
| Conversion readiness wrap | PARTIAL | EXTEND | `conversions/readiness.js` — soft-allows missing acceptance via handoff pin |
| UNKNOWN ≠ READY | GAP | EXTEND | `CRM_CONVERSION_READINESS_STATUS` lacks `UNKNOWN`; soft WARN paths can still yield READY-ish ok |
| Expired / superseded commercial | GAP | EXTEND | Version existence checked; expiry/supersede status not hard-blocked in commercial readiness |
| Exact Closed-Won retry | PARTIAL | EXTEND | Orchestrator retains early Closed Won; deepen conflicting idempotency Wave 1–2 |
| Browser-only Closed-Won | READY | CORRECT_AND_REUSABLE | Server orchestrator path required for conversion |

**Implication:** Wave 1 hardens readiness/authority/expiry gates so UNKNOWN/expired never pass Closed-Won/convert.
