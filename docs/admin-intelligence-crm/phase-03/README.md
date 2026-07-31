# Phase 3 — Platform Authorisation & Data Security

**Status:** Wave 0 audit complete — design locked for gated implementation  
**Date:** 2026-07-28  
**Design:** [../../superpowers/specs/2026-07-28-admin-authorization-phase-03-design.md](../../superpowers/specs/2026-07-28-admin-authorization-phase-03-design.md)  
**Plan:** [../../superpowers/plans/2026-07-28-admin-authorization-phase-03.md](../../superpowers/plans/2026-07-28-admin-authorization-phase-03.md)

## Objective

Complete platform-level RBAC + ABAC scopes + PAM/support governance + field/export/search security for `/insightbooks`, so every request answers: who / what / scope / conditions / result — via one decision service.

## Boundary

**In:** Authorisation architecture, privileged admin workflows, catalogues, server enforcement, SoD, access reviews scaffolding.  
**Out:** Executive KPI calculations, CRM leads/pipeline, AI, billing math changes, accounting, System CoA admin UI.

## Deliverables (this folder)

| Document | Purpose |
|----------|---------|
| [PHASE_03_SCOPE.md](./PHASE_03_SCOPE.md) | In / out of scope |
| [PHASE_INPUT_VALIDATION.md](./PHASE_INPUT_VALIDATION.md) | Phase 1/2 path map + blockers resolved |
| [CURRENT_AUTHORIZATION_AUDIT.md](./CURRENT_AUTHORIZATION_AUDIT.md) | Master code-level authZ audit |
| [AUTHENTICATION_SESSION_AUDIT.md](./AUTHENTICATION_SESSION_AUDIT.md) | JWT, sessions, MFA, revoke |
| [ROLE_MODEL_AUDIT.md](./ROLE_MODEL_AUDIT.md) | Admin roles vs PRD |
| [PERMISSION_MODEL_AUDIT.md](./PERMISSION_MODEL_AUDIT.md) | Catalog + Super Admin bypass |
| [ASSIGNMENT_MODEL_AUDIT.md](./ASSIGNMENT_MODEL_AUDIT.md) | Assignments, temp grants |
| [SCOPE_ENFORCEMENT_AUDIT.md](./SCOPE_ENFORCEMENT_AUDIT.md) | ADMIN_SCOPES / AdminTenantAccess |
| [ROUTE_AUTHORIZATION_AUDIT.md](./ROUTE_AUTHORIZATION_AUDIT.md) | Pages + middleware |
| [API_AUTHORIZATION_AUDIT.md](./API_AUTHORIZATION_AUDIT.md) | `/api/admin/*` patterns |
| [SERVICE_AUTHORIZATION_AUDIT.md](./SERVICE_AUTHORIZATION_AUDIT.md) | Domain services |
| [REPOSITORY_SCOPE_AUDIT.md](./REPOSITORY_SCOPE_AUDIT.md) | Query scoping |
| [WORKER_AUTHORIZATION_AUDIT.md](./WORKER_AUTHORIZATION_AUDIT.md) | Jobs / workers |
| [CACHE_AUTHORIZATION_AUDIT.md](./CACHE_AUTHORIZATION_AUDIT.md) | Cache isolation |
| [SEARCH_AUTHORIZATION_AUDIT.md](./SEARCH_AUTHORIZATION_AUDIT.md) | Global search |
| [NOTIFICATION_AUTHORIZATION_AUDIT.md](./NOTIFICATION_AUTHORIZATION_AUDIT.md) | Notification centre |
| [EXPORT_AUTHORIZATION_AUDIT.md](./EXPORT_AUTHORIZATION_AUDIT.md) | Exports / downloads |
| [FIELD_SECURITY_AUDIT.md](./FIELD_SECURITY_AUDIT.md) | Field projection / masking |
| [SUPPORT_ACCESS_AUDIT.md](./SUPPORT_ACCESS_AUDIT.md) | PlatformSupportAccess |
| [IMPERSONATION_AUDIT.md](./IMPERSONATION_AUDIT.md) | Real vs effective actor |
| [SEGREGATION_OF_DUTIES_AUDIT.md](./SEGREGATION_OF_DUTIES_AUDIT.md) | SoD |
| [PRIVILEGED_SESSION_AUDIT.md](./PRIVILEGED_SESSION_AUDIT.md) | Privileged sessions |
| [ACCESS_REVIEW_AUDIT.md](./ACCESS_REVIEW_AUDIT.md) | Certification / dormant |
| [TARGET_SECURITY_ARCHITECTURE.md](./TARGET_SECURITY_ARCHITECTURE.md) | Locked target model |
| [TARGET_ROLE_PERMISSION_MATRIX.md](./TARGET_ROLE_PERMISSION_MATRIX.md) | Canonical roles × perms × scopes |
| [SECURITY_DEFECT_REGISTER.md](./SECURITY_DEFECT_REGISTER.md) | Prioritised defects |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Ordered waves |

## Phase 2 close-out consumed

- [../phase-02/FINAL_PHASE_02_REPORT.md](../phase-02/FINAL_PHASE_02_REPORT.md)
- [../phase-02/FINAL_READINESS_DECISION.md](../phase-02/FINAL_READINESS_DECISION.md)
- [../phase-02/PHASE_03_INPUTS.md](../phase-02/PHASE_03_INPUTS.md)
- [../phase-02/PHASE_03_READINESS_CHECKLIST.md](../phase-02/PHASE_03_READINESS_CHECKLIST.md)

## Non-negotiables

Default deny · least privilege · server-side enforcement · System CoA stays removed · no Tenant GL via platform admin · zero unaudited impersonation.
