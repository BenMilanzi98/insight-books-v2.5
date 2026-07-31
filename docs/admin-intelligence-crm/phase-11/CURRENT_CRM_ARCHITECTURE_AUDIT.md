# Current CRM Architecture Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `/insightbooks/crm/**` ops plane | NOT_FOUND | No `app/insightbooks/crm` tree; ROUTE_INVENTORY lists as gap |
| `lib/admin/crm/*` | NOT_FOUND | No module directory |
| CrmAccount / CrmContact / CrmLead Prisma | NOT_FOUND | `schema.prisma` — no `Crm*` / `Lead` / `Opportunity` / `Pipeline` models |
| INTEL CRM permission scaffold | PARTIAL | `INTEL_CRM_PERMISSION_SCAFFOLD.crm.*` keys in `lib/admin/permissions.js`; default deny; not a live SYSTEM_ADMIN crm category UI |
| Canonical Customer plane | CORRECT_AND_REUSABLE | Phase 7 — link target for Account; not CRM Account |
| CsCase / CS expansion | WRONG_DOMAIN / FORBIDDEN as Lead | Phase 8 retention; `CsExpansionHandoff` READY as record-only |
| SupportTicket / SupportHandoff | WRONG_DOMAIN / FORBIDDEN as Lead | Phase 10; handoffs link-only, no Lead bridge |
| Tenant Client / Invoice / POS `sales.*` | WRONG_DOMAIN | Tenant accounting / POS — not platform CRM |
| Public marketing contact | PARTIAL | `/contact` + demo-request email only |
| WhatsApp | NOT_AVAILABLE (ingest) | CTA / `wa.me` only — no Business API Lead capture |
| Competing CRM systems | NOT_FOUND | Greenfield — create one dedicated domain |

**Implication:** Build dedicated CRM under `lib/admin/crm/*` + `Crm*` Prisma models (Approach B). Never alias Customer, CsCase, SupportTicket, or Tenant POS sales as CRM.
