# Currency Policy Matrix

| Case | Policy | Class today |
|------|--------|-------------|
| Opportunity amount currency | Explicit required field | NOT_FOUND |
| Multi-currency Pipeline report | Separate by currency; no silent rollup | NOT_FOUND |
| FX conversion | No silent conversion; explicit rate + audit if ever added | FORBIDDEN silent |
| Mixed-currency weighted total in UI | Dark until Phase 16; still no silent FX | NOT_AVAILABLE (UI) |
| Lead/Account currency assumption | Do not infer Opportunity currency | FORBIDDEN infer |
| Tenant Invoice currency as Opportunity currency | May inform estimate; must copy explicitly | WRONG_DOMAIN auto-link |

**Rule:** Currency always explicit. Reports currency-separated.
