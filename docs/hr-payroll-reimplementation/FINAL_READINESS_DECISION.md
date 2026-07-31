# Final Readiness Decision — HR & Payroll V2

**Date:** 2026-07-25  
**Programme:** Full-phase reimplementation (Phases 1–10)

## Decision

| Gate | Result |
|------|--------|
| Critical security (status PATCH / tenant scope) | **PASS** |
| EmploymentContract + compensation resolution | **PASS** |
| PayrollRun engine + snapshot + components | **PASS** (V2 path) |
| Leave accrual idempotency | **PASS** |
| Attendance approval bridge | **PASS** |
| Advance disbursement ≠ payroll expense | **PASS** |
| Advance recovery unique on run | **PASS** |
| Recognition vs payment separation | **PASS** (V2 post/pay) |
| Reconciliation centre | **PASS** (`/api/payroll-v2/reconcile`) |
| Automated unit tests (calc/state/formula/status) | **PASS** |
| Production claim (all legacy paths retired) | **CONDITIONAL** |

## Conditional notes

1. **Legacy** `/api/payroll/enhanced` remains available during cutover; prefer `/hr/payroll-v2` for new runs.
2. **Post/Pay** require `mappingSnapshot` account IDs on the run before accounting journals are created.
3. **HTTP multi-tenant IDOR** seeded integration test still recommended in CI with a test DB.
4. **SoD** fine-grained split (create vs approve vs post) uses existing permission keys; configure roles so the same user is not sole approver+poster in production tenants.
5. After deploy: `npx prisma migrate deploy` then restart Next (stop `npm run dev` before `prisma generate` on Windows if EPERM).

## Go / No-go for tenant cutover

- **Go** for pilot tenants using Payroll Workbench V2 with approved attendance.
- **No-go** for claiming “legacy payroll deleted” until enhanced path is feature-flagged off per tenant.
