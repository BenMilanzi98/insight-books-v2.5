# Admin Authorisation Phase 3 — Implementation Plan

> **For agentic workers:** Complete waves in order. TDD for decision service. Do not implement CRM/KPI modules.

**Goal:** Production authorisation for `/insightbooks`.  
**Architecture:** [../specs/2026-07-28-admin-authorization-phase-03-design.md](../specs/2026-07-28-admin-authorization-phase-03-design.md)  
**Audit pack:** [../../admin-intelligence-crm/phase-03/](../../admin-intelligence-crm/phase-03/)

---

## Wave 1 — Decision service

### Task 1: Failing tests for authorizeAdminDecision

**Files:**
- Create: `test/systemAdmin.authorizationDecision.test.js`

Cases: deny anonymous; deny missing permission; allow nested grant; Super Admin breakGlass; scaffold intel key denied for Billing Admin; ALLOW_MASKED when only aggregate finance.

### Task 2: Implement catalogue + decision

**Files:**
- Create: `lib/admin/authorization/catalogue.js` (version, role templates from matrix)
- Create: `lib/admin/authorization/outcomes.js`
- Create: `lib/admin/authorization/authorizeAdminDecision.js`
- Create: `lib/admin/authorization/resolveAdminActor.js`
- Create: `lib/admin/authorization/index.js`
- Modify: `lib/admin/permissions.js` — `adminHasPermission` delegates to decision boolean

### Task 3: requireAdminDecision helper

**Files:**
- Create: `lib/admin/authorization/requireAdminDecision.js`
- Re-export from `lib/adminAuth.js` without breaking existing imports

---

## Wave 2 — Enforcement

### Task 4: Middleware JWT verify

**Files:**
- Modify: `middleware.js` — verify admin JWT (edge-safe strategy: call lightweight verify or redirect on malformed); never trust presence alone

### Task 5: High-risk API migration

Migrate to `getAdminFromRequest` + decision: dashboard stats metric filters; legacy jwt-only routes identified in API audit.

### Task 6: Tenant filter helper + wire tenant list APIs

**Files:**
- Create: `lib/admin/authorization/withAdminTenantFilter.js`
- Wire: tenant-management list API

### Task 7: COA regression

Run existing nav/breadcrumb tests.

---

## Waves 3–5

Follow `phase-03/IMPLEMENTATION_PLAN.md` and SECURITY_DEFECT_REGISTER wave columns. PAM/SoD → field/export/search → access review UI.

---

## Verification (each wave)

```bash
npx vitest run test/systemAdmin.authorizationDecision.test.js
npx vitest run test/systemAdmin.navPermissionMap.test.js test/systemAdmin.breadcrumbs.test.js
```
