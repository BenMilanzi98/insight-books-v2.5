# Current Duplicates Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Customer match engine | PARTIAL | EXTEND | `customerMatch.js` — EXACT/HIGH/POSSIBLE/CONFLICT scoring |
| DUPLICATE_REVIEW_REQUIRED request status | READY | CORRECT_AND_REUSABLE | `CRM_CONVERSION_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED` |
| Duplicate-review UI/API | PARTIAL | FOUNDATION | `app/insightbooks/crm/conversions/duplicate-review/page.js`, API route |
| EXACT_MATCH blocks auto-create | PARTIAL | EXTEND | Policy present in match decisions; harden server gate Wave 2 |
| LINK_EXISTING path | PARTIAL | EXTEND | `decideCustomerCreateOrLink` |
| No automatic merge | READY | CORRECT_AND_REUSABLE | Soft name similarity → POSSIBLE only |
| Contact duplicate link vs create | GAP | EXTEND | Wave 2 |
| Exact retry ≠ duplicate Conversion | PARTIAL | EXTEND | Orchestrator input hash; conflicting hash must fail visibly |
| Tenant / slug collision | PARTIAL | EXTEND | `tenantProvision.js` reserved slugs + link |

**Implication:** Duplicate review foundations exist; Wave 2 hardens EXACT_MATCH / contact / conflicting idempotency.
