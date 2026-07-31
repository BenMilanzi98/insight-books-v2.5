# Implementation Tasks

## Wave 0 — Audit pack
- [x] CURRENT_IMPLEMENTATION_AUDIT
- [x] REVERSAL_* audits
- [x] TAX_* audits
- [x] Risk registers + PERMISSION/TEST audits
- [x] FINAL_GAP_REGISTER

## Wave 1 — Tax route hub
- [x] Nested `/tax-management/*` pages
- [x] TaxManagementNav shell
- [x] Sidebar + tenantPageAccess + setup wizard hrefs
- [x] `taxManagement.*` ↔ `tax.*` aliases
- [x] Redirects from tax-types / tax-accounts
- [x] Wire settle authz (`tax.settle` | `tax.update`)

## Wave 2 — Reversal engine
- [x] `TransactionReversal` Prisma model + migration
- [x] `lib/reversals/*` façade
- [x] Wire execute/approve/request APIs
- [x] Reversal Centre UI permission alignment
- [x] Fix original-doc reverse linkage / list id mapping
- [x] Restart app + `prisma generate` when DLL unlocked (operator)
- [x] Deeper Reversal Centre detail tabs (approvals / journal drill-down) — polish pass

## Wave 3 — Tax core
- [x] TAX_CODE_MODEL + TAX_ACCOUNTING_POSTING_MATRIX docs
- [x] TaxType versioning fields (effectiveFrom/To, supersededById)
- [x] TaxAccountMapping model + resolve/upsert service + API
- [x] TaxTransaction subledger + postingEngine best-effort projection
- [x] Settings + Transactions hub pages wired
- [x] Full historical backfill projector job
- [x] Supersession UI on tax-codes page


## Wave 4 — Tax ops
- [x] TaxPeriod state machine + roll-forward
- [x] TaxReturn draft/ready/file/amend (filing does not auto-journal)
- [x] TaxPayment register + settle dual-write + Payments UI with TaxSettlementModal
- [x] Refunds / credits / withholding registers + hub pages

## Wave 5 — Reports / recon
- [x] `/api/reports/tax-summary/export` CSV
- [x] Reconciliation engine + hub page
- [x] Mapping import dry-run/commit + import-export page
- [x] Reports catalogue page

## Wave 6 — QA / readiness
- [x] MODULE_ADAPTER_STATUS.md
- [x] AUTOMATED_TEST_RESULTS.md
- [x] FINAL_READINESS_DECISION.md
- [x] Unit tests for wave 4–5 constants/bounds
- [x] Broader module export / remaining follow-up unit tests
- [x] Production SoD setting + pending approvals UI + request-only execute path
- [x] Static HTTP/IDOR tenant-scope suite (`test/taxManagementTenantScope.test.js`)
- [x] SoD unit tests (`test/reversalSodPolicy.test.js`)
- [x] Live dual-tenant HTTP IDOR (`test/taxManagementReversals.idor.live.test.js`)

