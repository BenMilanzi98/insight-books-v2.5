# Current Territory Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM territory model | NOT_FOUND | — |
| Territory ↔ team / owner mapping | NOT_FOUND | — |
| Geo / segment territory rules | NOT_FOUND | — |
| Portfolio geography as territory | WRONG_DOMAIN | Customer portfolio ≠ sales territory |
| Tenant multi-branch as territory | WRONG_DOMAIN | Tenant org structure |

**Implication:** Wave 3 introduce territories as CRM ownership scope. Keep portfolios and tenant branches out of territory truth.
