# Current MRA EIS Product Audit

| Stage / source | Class | Notes |
|----------------|-------|-------|
| Commercial subscription / entitlement | READY_WITH_LIMITATIONS | AccountSubscription + MraEisTenantEntitlement |
| Configuration / terminal | CANDIDATE_EVIDENCE | Participation, business settings, terminal models |
| Accepted fiscal transaction | CANDIDATE_EVIDENCE | FiscalReceipt / accepted transmission — **not** AnalyticsEvent |
| Retries / attempts | CANDIDATE_EVIDENCE | Must exclude from “new usage” when instrumenting |
| Receipt reprints | RISK | Must not count as new value |
| Credentials in events | PRIVACY_RISK if ever emitted | Redact; never store payloads |
| Analytics emitters | NOT_INSTRUMENTED | Wave 1 third producer: accepted only |

**Disposition:** Funnel stages documented in matrix; live MRA product metrics NOT_INSTRUMENTED until accepted producer + retry exclusion rules ship.
