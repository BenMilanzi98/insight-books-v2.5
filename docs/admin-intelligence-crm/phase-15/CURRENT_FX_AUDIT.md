# Current FX Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM FX rate service / snapshots | NOT_FOUND | No commercial FX module under `lib/admin/crm` |
| Opp silent FX | CORRECT_AND_REUSABLE (absent by design) | Estimates never auto-convert |
| Tenant ExchangeRate default 1.0 | CURRENCY_RISK / FORBIDDEN | `currencyService.js` — must not power CRM commercial conversion |
| Named approved FX source + timestamp | NOT_FOUND | Design requirement |
| Reliability states FX_CONTEXT_MISSING / STALE | NOT_FOUND | Design requirement |

**Implication:** Wave 2 implements explicit FX snapshots only. Missing/stale FX → reliability fail — never silent convert.
