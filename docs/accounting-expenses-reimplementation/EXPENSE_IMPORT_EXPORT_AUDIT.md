# Expense Import / Export Audit

**Date:** 2026-07-25

## Current state

| Capability | Status | Tag |
|------------|--------|-----|
| CSV export | Present (expense list/export paths) | `REUSE` |
| XLSX backup export | **Absent** | Missing — `EXTEND` (GAP-012) |
| Import dry-run preview | **Absent** for expenses (contrast historical-transactions preview) | Missing — `EXTEND` |
| Import confirm + post | Not a first-class expense pipeline | Missing |
| Template download | Partial / category-oriented; not blueprint-aligned xlsx pack | `EXTEND` |

## Comparison: historical transactions pattern (reuse target)

Existing patterns to mirror (do not invent a third import stack):

- `app/api/historical-transactions/preview/route.js` — dry-run  
- `app/api/historical-transactions/template/route.js` — template  
- `app/api/historical-transactions/batch-upload/route.js` — commit  

**Tag:** `REUSE` architecture; `EXTEND` for expense-specific columns (`expenseAccountId` / account code, tax, paymentStatus, supplier).

## Risks of CSV-only

1. No durable spreadsheet backup for accountants (xlsx expected).  
2. No dry-run means bad account codes can create drafts or trigger posts without preview.  
3. Category text import can re-enter `expenseCategoryNormalization` anti-blueprint codes.

## Target (Phase 7)

1. **Export xlsx** — columns: date, description, accountCode, accountName, amount, taxAmount, supplier, paymentStatus, status, branch, externalRef, journalSourceId (if posted).  
2. **Import dry-run** — validate tenant, account postable, period open, no post.  
3. **Confirm** — create expenses; post only when status transition rules say so (SM).  
4. Keep CSV as secondary `REUSE` until xlsx verified.

## Acceptance

- [ ] Round-trip xlsx export → dry-run → confirm on staging tenant  
- [ ] Dry-run never writes `AcctV2EventRegistry` or journals  
- [ ] Import rejects COGS headers / non-postable accounts
