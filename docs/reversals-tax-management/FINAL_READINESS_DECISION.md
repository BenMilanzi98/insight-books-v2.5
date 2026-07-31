# Final Readiness Decision — Reversals + Tax Management

**Date:** 2026-07-26  
**Decision:** **ENGINEERING COMPLETE** for unified Reversal Engine + Tax Management hub + migrated routes + core tax/reversal paths + production SoD UI + static IDOR guards.

## What is ready
- Forensic audit pack under `docs/reversals-tax-management/`
- Canonical hub `/tax-management/*` with redirects from `/tax-types`, `/tax-accounts`, `/tax`
- Reversal Engine façade (`lib/reversals`) + `TransactionReversal` register + API request/approve/reject/execute
- Production SoD: `TenantSettings.reversalRequireSeparateApprover` (default **true**), pending-approvals panel on `/transactions/reversals`, request-only POST (202) when SoD on without `reversalId`
- V2 `reverseJournal` remains sole GL reverse mechanism
- Tax mappings, subledger projection hook, historical TaxTransaction backfill + supersession API/UI
- Tax periods/returns/payments/refunds/credits/withholding registers
- Settlement dual-write into `TaxPayment`
- Tax summary CSV export endpoint restored
- Reconciliation suite (subledger↔GL, return↔tx, reversal linkage)
- Mapping import dry-run/commit
- Static multi-tenant scope tests for tax-management + reverse/reversals routes; SoD unit tests
- Live dual-tenant IDOR suite (`test/taxManagementReversals.idor.live.test.js`) — ephemeral tenants, service + HTTP route handlers

## What is explicitly not claimed
- Pixel-perfect coverage of every historical edge case
- Complete filing compliance suite (returns are status workflow; filing does not invent journals)

## Operator checklist before go-live
1. Ensure PostgreSQL is running (`DATABASE_URL`)
2. Confirm migrations through `20260726010000_reversal_sod_setting` are applied (`prisma migrate status` → up to date)
3. Stop Node/Next if Windows locks Prisma engine, then `npx prisma generate`
4. Smoke: open `/tax-management`, roll-forward a period, settle a tax payment, run reconciliation
5. Smoke SoD: User A reverse → 202 pending → User B approve & execute on `/transactions/reversals` → register `COMPLETED`
6. Optional: toggle SoD off via Pending approvals panel (settings permission) for single-operator tenants

## Sign-off bar (honest)
**Met:** Engineering complete for unified Reversal Engine + Tax Management hub + migrated routes + reconciled core tax/reversal paths + SoD approval UX + static and live dual-tenant IDOR guards.  
**Not met:** Exhaustive edge-case / regulatory filing certification.
