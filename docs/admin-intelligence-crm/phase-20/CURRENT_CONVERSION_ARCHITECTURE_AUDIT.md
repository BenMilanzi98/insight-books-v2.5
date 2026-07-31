# Current Conversion Architecture Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Canonical `CrmConversion` / CNV- | READY | CORRECT_AND_REUSABLE | `prisma/schema.prisma` `CrmConversion`; `numbering.js` `allocateConversionNumber` |
| `CrmConversionRequest` / CVR- | READY | CORRECT_AND_REUSABLE | `requests.js`; status history models |
| Plan / dry-run | READY | CORRECT_AND_REUSABLE | `plan.js`, `dryRun.js`; dry-run zero side effects |
| Orchestrator | PARTIAL | EXTEND | `orchestrator.js` `executeClosedWonConversion` / `resumeConversion` |
| Step durability / resume | PARTIAL | EXTEND | `steps.js` + `CrmConversionStep` / Attempt / Failure |
| Domain contract | PARTIAL | EXTEND | `catalogue.js` `CONVERSION_DOMAIN_CONTRACT` still `phase: 16` |
| Hub UI | PARTIAL | FOUNDATION | `app/insightbooks/crm/conversions/**` (overview, my-work, queues, requests, duplicate-review) |
| Hub API | PARTIAL | FOUNDATION | `app/api/admin/crm/conversions/route.js` |
| Accounting boundary | READY | CORRECT_AND_REUSABLE | `accountingBoundary.js` — Tenant GL forbidden |
| Isolation | PARTIAL | EXTEND | `isolation.js` `assertTenantIsolation` |
| Parallel SalesConversion domain | — | FORBIDDEN / NOT_FOUND | Correctly absent |

**Implication:** Architecture is Approach 1 durable saga already shipped under tree phase-16. Phase 20 hardens truth edges; does not rebuild.
