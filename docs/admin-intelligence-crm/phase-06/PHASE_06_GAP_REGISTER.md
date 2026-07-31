# Phase 6 Gap Register

| ID | Gap | Severity | Disposition |
|----|-----|----------|-------------|
| G01 | No historical MRR snapshots | High | Wave 1 reconstruct-then-snapshot |
| G02 | No plan-change / amount-delta events | High | Bridge classification best-effort; UNAVAILABLE when ambiguous |
| G03 | PlatformInvoice sparse vs PayChangu | High | Billed metrics READY_WITH_LIMITATIONS; prefer Payment for collected |
| G04 | No FX rates | Medium | Cross-currency UNAVAILABLE |
| G05 | No industry/region/acquisition | Medium | NOT_SUPPORTED slices |
| G06 | No payment retry model | Low | Retry analytics NOT_SUPPORTED |
| G07 | NRR/GRR need stable bridge | High | UNAVAILABLE until bridge confidence |
| G08 | Amount-level MRR recon | High | Wave 1–4 recon workbench |
| G09 | Scheduled reports product | Low | Export foundation first; scheduler DEFER |
| G10 | GAAP recognition | Low | DEFER |

Critical/High gaps must be closed or explicitly UNAVAILABLE before claiming metric READY.
