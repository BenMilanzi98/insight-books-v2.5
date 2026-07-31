# Admin Authorisation Phase 3 — Design

**Date:** 2026-07-28  
**Status:** Approved (plan approval 2026-07-28)  
**Inputs:** `docs/admin-intelligence-crm/phase-03/*`, Phase 2 close-out

## Goal

One canonical decision service for the `/insightbooks` control plane answering who / what / scope / conditions / result, with server-side enforcement and default deny.

## Approach

**Extend-in-place** on Admin plane. Do not merge with tenant `securityGovernance`.

### Components

1. **Catalogue** — versioned role templates + permission keys (`platform-authz-2026-07-28`)
2. **Actor resolver** — real admin, support session, effective tenant
3. **Decision service** — `authorizeAdminDecision` → structured outcome
4. **Adapters** — `adminHasPermission` / `requireAdminDecision`
5. **Scope filters** — `withAdminTenantFilter`
6. **Projection** — `projectAdminFields` (Wave 4)
7. **SoD / PAM** (Wave 3)
8. **UI** — role assignment + access review (Wave 5); gates remain UX-only

### Super Admin

Break-glass allow with `breakGlass: true` on decision; retain last-super-admin protection.

### Data

Wave 1–2: dual-read `Admin.permissions` JSON + role string.  
Later waves: additive assignment tables without dropping JSON until cutover.

### Non-goals

KPI/CRM/AI modules; billing math; accounting; System CoA reintroduction.

## Success

Denial matrix tests green; Critical/High defects closed; COA regression green.
