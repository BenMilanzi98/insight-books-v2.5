# Current Renewals Audit

| Check | Result | Evidence |
|-------|--------|----------|
| Renewal date (commercial) | READY_WITH_LIMITATIONS | `AccountSubscription.expiresAt` via `commercial.js` |
| Signal RENEWAL_DUE_SOON | READY | `signalCatalogue.js` / `signals.js` |
| Segment `system.renewals_due` | READY | `segments.js` |
| CI renewals UI tab | READY_WITH_LIMITATIONS | `/insightbooks/intelligence/customers/renewals` (Phase 7) |
| CS RenewalWorkspace / outcome capture | NOT_FOUND | No renewal outcome model |
| Authoritative outcome evidence | Partial | Subscription status exists; no CS outcome ledger |

**Disposition:** Wave 3 RenewalWorkspace may claim outcomes only when subscription evidence supports them (e.g. renewed → new/extended `expiresAt` or active sub). No invented win rate.
