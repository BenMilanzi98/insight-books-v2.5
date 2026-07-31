# Current Account Model Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `CrmAccount` Prisma model | NOT_FOUND | — |
| Account numbering (`ACC-…`) | NOT_FOUND | — |
| CRM Account ↔ Customer link | NOT_FOUND | Customer exists (Phase 7) but no CRM Account bridge |
| CRM Account ↔ Tenant link | NOT_FOUND | Tenant create APIs exist without Lead/Account lineage |
| Tenant `Client` as CRM Account | WRONG_DOMAIN | Tenant AR/AP party — POS/accounting |
| Platform billing AccountSubscription | WRONG_DOMAIN | Post-win commercial state — link later, not CRM Account |
| Affiliate as Account | WRONG_DOMAIN | Channel partner — attribution seed only |

**Implication:** Introduce `CrmAccount` distinct from Customer/Tenant/Client. Optional evidence-backed links to Customer/Tenant; never duplicate MRR/billing truth onto Account.
