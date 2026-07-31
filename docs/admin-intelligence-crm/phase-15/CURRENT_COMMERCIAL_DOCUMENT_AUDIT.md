# Current Commercial Document Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CrmCommercialDocument | NOT_FOUND | No Prisma model / lib module |
| Document versions `…-V{n}` | NOT_FOUND | — |
| Shared status machine | NOT_FOUND | Design DRAFT→…→ACCEPTED locked; unimplemented |
| Status history | NOT_FOUND | — |
| Pricing snapshot on version | NOT_FOUND | — |
| Approvals / recipients / artifacts on spine | NOT_FOUND | — |
| Opp commercial API | FOUNDATION | `app/api/admin/crm/opportunities/[id]/commercial` — estimate only |
| Opp products API | FOUNDATION | `…/products` — non-binding lines |
| Platform customer commercial metrics | WRONG_DOMAIN | `lib/admin/customers/commercial.js` — SaaS KPI plane |
| One document / many projections rule | NOT_FOUND | Design locked; Wave 1 |

**Implication:** Wave 1 introduces Approach 1 spine. Estimates and platform KPIs stay orthogonal.
