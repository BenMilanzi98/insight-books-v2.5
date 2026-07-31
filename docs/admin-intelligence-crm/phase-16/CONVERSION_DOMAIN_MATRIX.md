# Conversion Domain Matrix

| Domain | Canonical home | Conversion role | Class |
|--------|----------------|-----------------|-------|
| CRM Account / Contact | Phase 11 CRM | Evidence / invite targets | CORRECT_AND_REUSABLE |
| Platform Customer (logical) | Tenant + portfolio ownership | Create-or-link | FOUNDATION / NOT_FOUND discrete model |
| Tenant | `Tenant` + admin APIs | Create-or-link | FOUNDATION |
| Business | Absent first-class | Optional primary | NOT_FOUND / SKIPPED_NOT_APPLICABLE often |
| Branch | `Branch` | Optional primary | FOUNDATION |
| Subscription | `AccountSubscription` | Create/amend from snapshot | FOUNDATION |
| Entitlement | featureEntitlements / plan versions | Cap ≤ accepted | FOUNDATION |
| Platform Invoice / Payment | Platform billing | Policy-driven | FOUNDATION |
| Tenant Invoice / Payment | Tenant AR | Never | WRONG_DOMAIN |
| CS / Onboarding / Training | CS libs + thin records | Handoff only | FOUNDATION |
| MRA EIS fiscal | `lib/mraEis` | Handoff only | WRONG_DOMAIN for execution |
| Tenant Journals / CoA admin | Accounting | CoA template init OK; journals forbidden | ACCOUNTING_SIDE_EFFECT_RISK / FORBIDDEN journals |
| CrmConversion saga | — | Authoritative orchestrator | NOT_FOUND |
