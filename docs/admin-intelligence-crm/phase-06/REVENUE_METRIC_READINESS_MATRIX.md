# Revenue Metric Readiness Matrix

Classes: `READY` | `READY_WITH_LIMITATIONS` | `READY_WITH_RECONCILIATION` | `UNAVAILABLE` | `NOT_SUPPORTED` | `DEFER`

| Metric | Class | Source / notes |
|--------|-------|----------------|
| Contracted MRR (estimated), point-in-time | READY_WITH_LIMITATIONS | `saasBillingKpis`; yearly÷12; CORE+EIS coexist |
| Contracted ARR (estimated) | READY_WITH_LIMITATIONS | MRR×12 approximate |
| MRR by CORE / MRA EIS | READY_WITH_LIMITATIONS | planCategory / plan code mapping |
| MRR by currency | READY_WITH_LIMITATIONS | Native currency buckets |
| Cross-currency MRR total | UNAVAILABLE | No FX rate source |
| Opening / closing MRR (snapshot) | READY_WITH_LIMITATIONS after Wave 1 | Reconstruct + snapshots; gaps UNAVAILABLE |
| New / expansion / contraction / churn / reactivation MRR | UNAVAILABLE until bridge confidence | Requires adjacent snapshots + classification rules |
| MRR bridge / waterfall / net new | UNAVAILABLE until bridge confidence | Same |
| Gross / net revenue retention | UNAVAILABLE until bridge confidence | Cohort + expansion |
| Revenue churn / logo churn | UNAVAILABLE until bridge confidence | |
| Renewal rate by count/value | READY_WITH_LIMITATIONS | `expiresAt` + renew events best-effort |
| ARPA | READY_WITH_LIMITATIONS | MRR / distinct paid tenants |
| Plan performance (contracted) | READY_WITH_LIMITATIONS | Group active subs by plan |
| Billed (period) | READY_WITH_LIMITATIONS | PlatformInvoice; sparse caveat |
| Collected (period) | READY_WITH_RECONCILIATION | PlatformPayment + event recon |
| Outstanding | READY_WITH_LIMITATIONS | Invoice outstanding |
| Receivable ageing | READY_WITH_LIMITATIONS after Wave 3 | Bucket by due/period end |
| Payment success / failure rate | READY_WITH_LIMITATIONS | Payment status mix |
| Payment retry analytics | NOT_SUPPORTED | No retry model |
| Credits / refunds | READY_WITH_LIMITATIONS | PlatformCredit / PlatformRefund |
| MRA EIS commercial MRR / collected | READY_WITH_LIMITATIONS | Product split; not fiscal EIS |
| Revenue by industry/region/country/acquisition | NOT_SUPPORTED | Attributes unverified |
| Subscription / revenue cohorts | UNAVAILABLE until reconstruct window | Wave 4 |
| Deterministic renewal exposure | READY_WITH_LIMITATIONS after Wave 4 | Active MRR × expiry horizon |
| Forecast scenarios (simple multipliers) | READY_WITH_LIMITATIONS | Documented multipliers only |
| Recognised (GAAP) revenue | DEFER | No recognition engine |
| Tenant Sale / GL revenue | FORBIDDEN | Never |

**UI rule:** Only `READY*` classes may show numeric values. All others → UNAVAILABLE with reason (never `0` as substitute).
