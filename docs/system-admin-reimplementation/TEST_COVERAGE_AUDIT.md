# Test Coverage Audit — System Admin

## Current state

| Area | Coverage | Classification |
|------|----------|----------------|
| Admin auth (`lib/adminAuth.js`) | No dedicated unit tests found | INCOMPLETE |
| Admin pages (36) | No page-level tests found | INCOMPLETE |
| Most `/api/admin/*` (~84) | No systematic API tests | INCOMPLETE |
| MRA EIS admin | `test/mraEis.phase18.admin.test.js` (+ other mraEis tests in suite) | KEEP / EXTEND |
| System CoA | Payload helpers may have incidental coverage; admin routes sparse | INCOMPLETE |
| Affiliates / subscriptions / tenants admin APIs | Not evidenced as admin-focused tests | INCOMPLETE |
| Billing stubs | Untestable persistence (none) | STUB |
| Permissions catalog | EIS permissions tested in EIS suite; `systemAdmin.*` absent | MISSING |

## What exists (positive)

- MRA EIS has a mature test culture relative to the rest of admin (phase tests, permission/domain services).
- This is the **pattern to REUSE** for tenants, subscriptions, and future platform billing.

## Critical untested paths (priority)

| Priority | Path | Why |
|----------|------|-----|
| P0 | `test-delete` and unauthenticated admin routes | Must prove gone / 401 |
| P0 | Tenant delete | Destructive |
| P0 | system-coa apply / coa-migration | Cross-tenant mutation |
| P0 | admin login / me / logout cookie semantics | Auth boundary |
| P1 | subscriptions update/delete + trial expire | Money/entitlement |
| P1 | affiliate set-password / delete | Account takeover-adjacent |
| P1 | mobile-app forceLock / maintenanceLock | Customer impact |
| P1 | CoA page redirect | Locked product behavior |
| P2 | adminHasPermission Super Admin vs JSON grants | Authz matrix |
| P2 | invoices API domain assertion (`tenant_ar` vs platform) | Billing safety |
| P3 | Dashboard aggregates | Correctness vs performance |

## Target coverage policy (by phase)

| Phase | Test bar |
|-------|----------|
| 1 | Auth middleware/JWT; remove test routes; CoA redirect; permission helper unit tests |
| 2 | Shell nav config snapshot (routes present/absent: no CoA, no duplicates) |
| 3 | Integration tests for tenants, subscriptions, affiliates, mobile, email APIs |
| 4 | Continue EIS admin suite; entitlement SoD tests KEEP |
| 5 | PlatformInvoice service tests; forbid tenant Invoice in platform billing handlers |
| 6 | Settings persistence, audit consolidation, metrics contract tests |

## Tooling note

Prefer existing project test runner patterns used by `test/mraEis*.test.js`. Do not introduce a parallel framework unless the repo already standardizes one for app router API tests.
