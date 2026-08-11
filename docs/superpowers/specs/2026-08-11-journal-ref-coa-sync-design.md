# Design: Fix JOURNAL_PERSISTENCE + sync tenant financial defaults

**Date:** 2026-08-11  
**Status:** Approved (Approach C)

## Problem

POS/invoice/capital posting fail with `JOURNAL_PERSISTENCE` on multi-tenant production. V2 sets `referenceNumber = journalNumber` (e.g. `POS-2026-000001`) while `JournalEntry.referenceNumber` is **globally unique**. Sequences are per-tenant → second tenant collides.

Some tenants also lack complete CoA because signup treats CoA init as non-fatal.

## Solution

1. Replace global unique on `referenceNumber` with `@@unique([tenantId, referenceNumber])`.
2. Admin API to backfill `initializeNewTenantFinancialDefaults` for all tenants (idempotent).
3. Make CoA failure fatal in new-tenant financial init (rethrow after log).
4. Log Prisma cause under `JournalPersistenceError` (server-side; already via diagnostic).

## Out of scope

Purpose-mapping registry backfill (legacy code fallback remains until CoA V2 flag is on).
