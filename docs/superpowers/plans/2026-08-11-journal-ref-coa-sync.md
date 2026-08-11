# Journal ref uniqueness + tenant CoA sync — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Stop cross-tenant journal persist failures and ensure every tenant has baseline CoA/payment/tax/period defaults.

**Architecture:** Schema uniqueness becomes tenant-scoped; admin backfill reuses `initializeNewTenantFinancialDefaults`; signup no longer swallows CoA errors.

**Tech Stack:** Prisma migration, Next.js admin API, existing financial init helpers.

## Global Constraints

- Do not change journal number format (`POS-2026-000001`).
- Backfill must be idempotent (safe re-run).
- Do not commit secrets / `.env`.

---

### Task 1: Schema + migration

- [x] Update `prisma/schema.prisma` JournalEntry: remove `@unique` on `referenceNumber`; add `@@unique([tenantId, referenceNumber])`.
- [x] Add migration dropping `JournalEntry_referenceNumber_key`, creating tenant-scoped unique (NULLs allowed per PG semantics).

### Task 2: Persistence logging

- [x] Ensure `createPostedJournal` catch logs `err.message` / Prisma `code` before wrapping (console.error with diagnostic).

### Task 3: Admin backfill API

- [x] `POST /api/admin/tenants/sync-financial-defaults` (admin auth): iterate tenants, call `initializeNewTenantFinancialDefaults(tenantId, prisma)`, return success/failure counts.

### Task 4: Signup hardening

- [x] In `initializeNewTenantFinancialDefaults`, rethrow CoA errors (do not treat as non-fatal). Keep tax/period warnings non-fatal if already soft.

### Task 5: Verify

- [x] Local migrate deploy + index probe (global unique gone; same-tenant dup still P2002).
