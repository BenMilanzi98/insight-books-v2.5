# Current Demo Data Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo data packs | NOT_FOUND | No `dataPacks` under CRM demos |
| Safe synthetic pack catalogue | NOT_FOUND | — |
| Production data clone into Demo | FORBIDDEN / absent | Must reject if attempted in Wave 3 |
| Customer/Production data detection | NOT_FOUND | Design: reject Production credentials/data |
| Financial planning "pilot defaults for demos" | WRONG_DOMAIN | `lib/financialPlanning/application/historicalDatasetService.js` comment — FP pilot UI, not CRM Demo data packs |
| Seed/fixture test data | WRONG_DOMAIN | Vitest fixtures — not Demo Environment packs |
| Lead/Opportunity CRM data as Demo pack | FORBIDDEN | CRM operational data ≠ Demo Environment data |

**Implication:** Wave 3 safe data packs with Production-data detection; never clone Production Tenant DB.
