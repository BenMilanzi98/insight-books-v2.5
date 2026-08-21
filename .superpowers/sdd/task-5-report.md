# Task 5 Report: Import step (CSV / Excel)

## Status
**DONE_WITH_CONCERNS**

## Summary
Replaced the Import wizard placeholder with a real CSV/Excel upload → preview → confirm flow. Confirm posts **multipart FormData** (`batchId`, `file`, `reconciliationId`) to match `app/api/bank-reconciliation/import/confirm/route.js` (not JSON). On success the wizard refreshes the workspace and advances to Match.

## Changes implemented

### Step 1: Wire preview/confirm
- `reconApi.js`: `GUIDED_IMPORT_ACCEPT`, extension gate (`.csv/.xlsx/.xls` only), `buildPreviewImportFormData`, `buildConfirmImportFormData`, `previewStatementImport`, `confirmStatementImport`.
- Preview FormData: `file`, `paymentAccountId`, optional `statementOpening` / `statementClosing` from the active reconciliation, optional `profileId`.
- Confirm FormData: `file`, `batchId`, `reconciliationId`. File is re-uploaded as the confirm route requires.
- `ImportStep.jsx`: file input `accept=".csv,.xlsx,.xls"` plus client extension check (rejects OFX/QFX). Preview table (date / description / reference / amount), duplicate count, balance-check warnings. Confirm requires a previewed batch.

### Step 2: On confirm success
- `ReconcileWizard.jsx` `handleImported`: `GET /api/bank-reconciliation/reconciliations/[id]` then `setStepIndex` to Match (`WIZARD_STEPS.indexOf('match')` = 2).

### Step 3: Commit
- **SHA:** `e6c180da6`
- **Subject:** `feat(payments): CSV/Excel statement import in guided reconcile`
- **Files (4):**
  - `components/payments/reconcile/ImportStep.jsx` (created)
  - `components/payments/reconcile/reconApi.js`
  - `components/payments/reconcile/ReconcileWizard.jsx`
  - `test/guidedReconcileWizard.test.js` (TDD; not in brief `git add` list)

## Verification

| Check | Result |
|-------|--------|
| Preview POST multipart `/api/bank-reconciliation/import/preview` | Pass (helpers + tests) |
| Confirm POST multipart `/api/bank-reconciliation/import/confirm` with `batchId` + file + `reconciliationId` | Pass (wired to route; tests) |
| Accept `.csv,.xlsx,.xls` only; reject OFX | Pass |
| Confirm success → Match + workspace refresh | Pass (source) |
| ESLint on task files | Pass (exit 0) |
| Browser smoke (upload real CSV) | Not run |

## TDD Evidence

- **RED:** `npx vitest run test/guidedReconcileWizard.test.js` — 4 failed (helpers missing: `GUIDED_IMPORT_ACCEPT` undefined, `buildPreviewImportFormData` / `buildConfirmImportFormData` not functions). Existing 5 statement tests still passed.
- **GREEN:** same command after implementation — **Test Files 1 passed, Tests 9 passed**. Re-run after warning-list cleanup: **9/9 passed**. Also `test/bankReconciliation.import.test.js` with wizard tests: **12/12 passed**.

## Self-review
- Confirm contract taken from the confirm route (FormData), not the dispatch’s JSON guess.
- No OFX accept attribute; client `assertAllowedGuidedStatementFile` clears the input on reject.
- Did not stage unrelated dirty files (stock APIs, AppShell, locales, `.superpowers` briefs).
- Match/Resolve/Complete remain placeholders.

## Concerns / follow-ups
1. Wizard **Next** is not locked until import confirms — users can skip to Match with zero statement lines (resume of already-imported recon still works).
2. Live upload smoke was not run.
3. If workspace refresh fails after a successful confirm, the wizard stays on Import (confirm is idempotent for already-CONFIRMED batches).
4. Test file was extra vs the brief `git add` list (same as Task 4 TDD).
5. Full Vitest suite was not run (focused wizard + import-service tests only).

---

## Review fix: block confirm on empty preview

**Status:** DONE

### Problem
Confirm was enabled whenever `preview.batch.id` and file existed. Empty/unmapped previews (`totalRows === 0`) could still be confirmed and lock the file hash.

### Fix
- `reconApi.js`: added `canConfirmGuidedImportPreview(preview, file)` — requires file, batch id, and `Number(totalRows) > 0`.
- `ImportStep.jsx`: Confirm button disabled via helper; amber status when preview exists with zero rows; confirm handler rejects empty previews.
- `ReconcileWizard.jsx` (minor): after successful confirm, advance to Match even if workspace refresh fails; show refresh error message.

### Verification
- `npx vitest run test/guidedReconcileWizard.test.js` — **10/10 passed** (new test for `canConfirmGuidedImportPreview`).

### Commit
- **Subject:** `fix(payments): block confirm on empty statement preview`
- **SHA:** `22715e297`
