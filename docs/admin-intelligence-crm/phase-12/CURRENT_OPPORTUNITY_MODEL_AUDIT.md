# Current Opportunity Model Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `CrmOpportunity` model | NOT_FOUND | `schema.prisma` — no Opportunity |
| Opportunity numbering `OPP-YYYY-######` | NOT_FOUND | — |
| Opportunity status / stage fields | NOT_FOUND | — |
| Link Lead → Opportunity | NOT_FOUND (create) | Readiness sets `opportunityId: null` / `opportunityCreated: false` |
| READY handoff payload | READY | `type: 'CRM_OPPORTUNITY_HANDOFF'`, idempotency key, pinned qual/score versions |
| Create from unqualified Lead | FORBIDDEN (enforced at readiness) | Checklist → NOT_READY / BLOCKED; Phase 12 must keep gate |
| Lead as Opportunity alias | FORBIDDEN | Lead ≠ Opportunity (Phase 11 hard rule) |
| Customer / Subscription as Opportunity | WRONG_DOMAIN | — |
| `CsExpansionHandoff.createsCrmOpportunity` | CORRECT_AND_REUSABLE | Explicit `false` in CS handoffs |

**Implication:** Wave 1 introduces `CrmOpportunity` + numbering; create only via READY handoff consumer (idempotent). Never promote Lead rows into Opportunity without create path.
