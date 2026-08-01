# Tax Activation (Active-Only Transactional Taxes)

**Date:** 2026-08-01  
**Status:** Approved (design)  
**Decision:** Reuse existing `TaxType.status` (`Active` / `Inactive`). No new schema column.

## Problem

Users need to activate only the taxes they want available for selling. Inactive taxes must not appear in quotations, invoices, POS, and similar transactional pickers.

Today:

- `TaxType.status` already supports `Active` / `Inactive` (Tax Codes UI).
- POS and several UIs already request `?status=Active`.
- Quotation and Invoice modals load `/api/tax-types` with **no** status filter, so Inactive taxes remain selectable.
- Create APIs for quotations/invoices do not reject Inactive `taxTypeId`s.

## Goals

1. Clear Activate / Deactivate UX on Tax Codes (`/tax-management/tax-codes` → `app/tax-types/page.js`).
2. All transactional tax pickers show only `Active` taxes.
3. Server-side enforcement: new/updated quotations, invoices, and sales cannot attach Inactive tax types.
4. Historical documents that already used a tax later set to Inactive remain intact; that tax is simply unavailable for new selection.

## Non-goals

- New boolean `enabled` / `enabledForSales` column.
- Per-document-type enable flags (POS vs invoice).
- Changing `TaxAccountMapping` status model (`ACTIVE` / `SUPERSEDED`).
- Auto-removing Inactive taxes from already-saved document lines.

## Design

### 1. Status model (unchanged)

| Value | Meaning |
|-------|---------|
| `Active` | Available for new quotes, invoices, POS, purchases, stock tax pickers, etc. |
| `Inactive` | Hidden from transactional pickers; retained for history, reporting, and Tax Management |

Management UI continues to list both statuses (with filter). System Malawi types cannot be hard-deleted; deactivate via `Inactive`.

### 2. Tax Codes UX

On `/tax-management/tax-codes` (and `/tax-types`):

- Keep existing status filter and edit form.
- Add explicit **Activate** / **Deactivate** actions per row (toggle or buttons) that `PUT /api/tax-types/[id]` with `{ status: 'Active' | 'Inactive' }`.
- Confirm copy for deactivate: tax will no longer appear on quotations, invoices, POS, etc.
- Visual badge: Active (success) / Inactive (muted).

### 3. Shared client helper

Add a small helper (e.g. `lib/taxTypesClient.js` or under `app/services/`):

- `fetchActiveTaxTypes()` → `GET /api/tax-types?status=Active`
- Optional `fetchTaxTypes({ status })` for management screens

Call sites that currently hit `/api/tax-types` without status for **picker** purposes must switch to the helper / `?status=Active`:

| Surface | Current | Target |
|---------|---------|--------|
| `components/QuotationModal.js` | unfiltered | Active only |
| `components/InvoiceModal.js` | unfiltered | Active only |
| `app/pos/page.js` | Active | keep (prefer helper) |
| `components/BulkTaxApplicationModal.js` | Active | keep |
| `app/rentals/RentalsClient.js` | Active (if present) | keep |
| `app/purchases/orders/page.js` | Active | keep |
| `components/Expenses/ExpenseForm.js` | Active | keep |
| `app/stock/page.js` | Active | keep |
| `app/tax-types/page.js` | all / filtered in UI | unchanged (management) |

Creating a tax from POS/expense forms continues to create with `status: 'Active'`.

### 4. Server enforcement

Introduce a shared validator (e.g. `lib/taxManagement/assertActiveTaxTypes.js`):

- Input: tenantId + array of taxTypeIds, optional `allowInactiveIds`
- Load types for tenant; if any missing → `UNKNOWN_TAX` (400)
- **Create** paths: every `taxTypeId` must be `status === 'Active'` (strict Active-only)
- **Update** paths: each `taxTypeId` must be Active **or** listed in `allowInactiveIds` (IDs already present on that document’s existing item taxes). Allow-listed IDs must still exist for the tenant; Active check is skipped only for those IDs. New Inactive attachments (not already on the document) still reject with `INACTIVE_TAX` (400)

Apply on create/update paths that accept line taxes:

- Quotations: `app/api/quotations/route.js`, `app/api/quotations/[id]/route.js` (and duplicate if it copies then allows edit — validation on write)
- Invoices: create/update routes that accept `itemTaxes` / tax breakdown
- Sales / POS: `app/api/sales/route.js` (and related update if any)

Do **not** fail reads of historical documents that reference Inactive types.

### 5. API list behaviour

- Keep `GET /api/tax-types` as-is: optional `?status=Active|Inactive`; omit = all (required for Tax Codes management).
- Do **not** change default to Active-only (avoids breaking management list).

### 6. Acceptance criteria

- [ ] User can Activate / Deactivate a tax from Tax Codes without opening the full edit form (or via equally obvious control).
- [ ] Inactive tax does not appear as a *new* selectable option in Quotation modal, Invoice modal, or POS tax list.
- [ ] Edit pickers show grandfathered Inactive taxes already on document lines as visible `(inactive)` rows (checked on lines that have them; removable, not attachable to lines that lack them).
- [ ] API rejects **new** Inactive tax attachments on create (strict) and on update when the `taxTypeId` is not in the document’s existing item taxes (`allowInactiveIds`); updates may preserve existing Inactive line taxes.
- [ ] Existing quotation/invoice/sale lines that already reference a tax remain visible after that tax is deactivated.
- [ ] Tax Codes page can still list Inactive taxes for reactivation.

## Risks / notes

- Stale open browser tabs may still show Inactive taxes until reload; server guard is the hard backstop.
- Product-default taxes that become Inactive should not be auto-applied on POS/invoice; product forms should prefer Active types when editing (out of band cleanup if needed).

## Implementation outline

1. Helper + assertActiveTaxTypes.
2. Wire QuotationModal + InvoiceModal to Active-only fetch.
3. Add Activate/Deactivate UX on tax-types page.
4. Enforce on quotation / invoice / sales write APIs.
5. Smoke-check POS, purchases, expenses, stock still Active-only.
