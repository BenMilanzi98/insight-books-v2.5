# Phase 15 Scope — Commercial Documents

**Date:** 2026-07-31  
**Upstream:** Phase 14 `READY_FOR_PHASE_15_WITH_BLOCKERS`  
**Design lock:** Approach 1 spine + Approach B waves

## In scope

1. **CrmProposalRequest** (`PRQ-`) qualify/approve/convert (idempotent)
2. **CrmCommercialDocument** + versions (`PROP-` / `QUO-` + `…-V{n}`) — shared status/approvals/delivery/artifacts/acceptance spine
3. Typed **CrmProposal** / **CrmQuotation** extensions (never merge into one unversioned object)
4. **CRM Price Books** (`PB-`) + entries referencing Phase 9 product/plan/add-on versions
5. Deterministic `calculateCommercialDocument` with immutable pricing snapshots
6. In-platform commercial tax rules + explicit FX snapshots (no silent convert)
7. Discount/exception policies + commercial approval engine with SoD
8. Terms/clauses/templates foundations; deterministic HTML→PDF + checksummed private artifacts
9. Issue/delivery/customer review/acceptance/rejection/expiry/withdrawal/supersession
10. E-signature **boundary only** (`NOT_CONFIGURED`)
11. Closed-Won readiness evaluation + Phase 16 conversion handoff payloads (create nothing)
12. Commercial hubs, reports/exports/schedules, DQ, reconciliation — honesty-gated

## Explicitly out of scope

- Automatic Customer / Tenant / Subscription / Invoice / Payment / revenue recognition
- Automatic Opportunity stage / probability / close-date / Closed Won
- Reuse of tenant `Quotation` / rentals quotations as CRM commercial truth
- Live e-signature provider; AI proposals/pricing/discounts/clauses
- Sales quotas / commissions / formal forecasting
- Accounting, platform billing, or MRA EIS fiscal behaviour changes
- Reintroduction of System CoA admin routes
- Weighted Pipeline UI (Phase 16 unless pulled forward)
- Recording media / cloud Demo infra (Phase 14 carry — orthogonal)

## Carry blockers (document; do not invent)

| Carry | Class |
|-------|-------|
| Tenant Quotation domain | WRONG_DOMAIN — never alias |
| E-sign provider | NOT_CONFIGURED / NOT_AVAILABLE |
| `resolveCrmScope` stub `mode: 'all'` | FOUNDATION / CROSS_TENANT_RISK — harden |
| Weighted Pipeline UI | NOT_AVAILABLE (Phase 16) |
| Prisma EPERM on Windows | CARRY — SQL + `hasCrm*Model` guards |
| Telephony / Google-Outlook / Lead ingest | NOT_AVAILABLE / NOT_CONNECTED (orthogonal) |
| Demo recording media / cloud Demo infra | NOT_AVAILABLE (orthogonal) |

## Honesty gates to preserve

- Handoff ≠ create; Acceptance ≠ Closed Won; Quoted totals ≠ Revenue
- Opp commercial estimates remain non-binding until Price Book–backed document pricing
- Report gate fail → EMPTY/UNAVAILABLE — never false zero
- Customer-safe projections strip internal notes, floors, approval chatter, restricted clauses
