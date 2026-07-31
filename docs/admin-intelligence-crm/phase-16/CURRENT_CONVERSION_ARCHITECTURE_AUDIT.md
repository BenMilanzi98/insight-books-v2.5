# Current Conversion Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Canonical CrmConversion / CVN- | NOT_FOUND | No `model CrmConversion` in `prisma/schema.prisma`; no `lib/admin/crm/conversions/*` |
| CrmConversionRequest / CVR- | NOT_FOUND | No conversion-request services or numbering |
| Conversion plan / dry-run | NOT_FOUND | Design Approach 1 locked; not implemented |
| Orchestrator `executeClosedWonConversion` | NOT_FOUND | Expected greenfield Wave 1 |
| Step durability / resume / compensate | NOT_FOUND | — |
| Conversion hub UI | NOT_FOUND | No `app/insightbooks/crm/conversions/**` |
| Conversion APIs | NOT_FOUND | No `app/api/admin/crm/conversions/**` or `conversion-requests/**` |
| Phase 15 Closed-Won handoff | CORRECT_AND_REUSABLE | `lib/admin/crm/commercial/phase16Handoff.js` — payload only; rejects provision flags |
| Phase 15 Closed-Won readiness | CORRECT_AND_REUSABLE | `lib/admin/crm/commercial/readiness.js` `evaluateClosedWonReadiness` |
| Opp conversion readiness | CORRECT_AND_REUSABLE / EXTEND | `opportunities/conversionReadiness.js` — checklist + handoff payload; never provisions |
| Phase 12 close as conversion | CORRECT_AND_REUSABLE | `closeOpportunityWon` — Closed Won ≠ provision (`assertNoProvision`) |
| Admin Tenant create as conversion | FOUNDATION / WRONG_DOMAIN if silent | `app/api/admin/tenants/route.js` — operator create, not CRM saga |
| Target architecture (docs) | FOUNDATION (docs) | Design + plan approved 2026-07-31 |

**Implication:** Wave 1 greenfield `lib/admin/crm/conversions/*` + durable models. Consume Phase 15 handoff as request source; call Phase 12 close at durable start; never invent Customer/Tenant from handoff alone.
