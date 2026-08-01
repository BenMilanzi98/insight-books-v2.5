# Tax Activation (Active-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only `TaxType.status === 'Active'` taxes appear in transactional UIs and are accepted on quotation/invoice/sale writes; Tax Codes gets clear Activate/Deactivate actions.

**Architecture:** Keep existing `Active`/`Inactive` status. Add `assertActiveTaxTypeIds` for server writes and `fetchActiveTaxTypes` for client pickers. Fix Quotation/Invoice modals that currently load unfiltered tax types. Add row-level Activate/Deactivate on Tax Codes.

**Tech Stack:** Next.js App Router, Prisma `TaxType`, existing `/api/tax-types`, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-01-tax-activation-active-only-design.md`

## Global Constraints

- No new Prisma column for enable/disable.
- `GET /api/tax-types` without `status` still returns all (Tax Codes management).
- Historical documents with Inactive tax lines remain readable; only new selection / write validation is Active-only.
- Do not commit unless the user explicitly asks.

## File map

| File | Responsibility |
|------|----------------|
| Create `lib/taxManagement/assertActiveTaxTypes.js` | Server: reject non-Active taxTypeIds |
| Create `lib/taxTypesClient.js` | Client: `fetchActiveTaxTypes()` |
| Create `tests/unit/taxManagement/assertActiveTaxTypes.test.js` | Unit tests for assert helper |
| Modify `components/QuotationModal.js` | Active-only fetch |
| Modify `components/InvoiceModal.js` | Active-only fetch |
| Modify `app/pos/page.js` | Prefer shared helper (already Active) |
| Modify `app/api/quotations/route.js` | Assert Active on create |
| Modify `app/api/quotations/[id]/route.js` | Assert Active on update |
| Modify `app/api/invoices/route.js` | Assert Active on create |
| Modify `app/api/invoices/[id]/route.js` | Assert Active on update |
| Modify `app/api/sales/route.js` | Assert Active on taxBreakdown write |
| Modify `app/tax-types/page.js` | Activate/Deactivate row actions |

---

### Task 1: Server assert helper + unit tests

**Files:**
- Create: `lib/taxManagement/assertActiveTaxTypes.js`
- Create: `tests/unit/taxManagement/assertActiveTaxTypes.test.js`

**Interfaces:**
- Produces: `export async function assertActiveTaxTypeIds(db, tenantId, taxTypeIds)` — dedupes IDs, no-op if empty, throws `Error` with message containing `INACTIVE_TAX` or `UNKNOWN_TAX` when invalid; or throw an object `{ code, message }` that routes can map to 400. Prefer throwing `{ status: 400, code: 'INACTIVE_TAX', message: string }` pattern if the codebase uses that; otherwise throw `Error` and catch in routes.

- [ ] **Step 1: Write failing unit test**

```js
import { describe, it, expect, vi } from 'vitest';
import { assertActiveTaxTypeIds } from '@/lib/taxManagement/assertActiveTaxTypes';

describe('assertActiveTaxTypeIds', () => {
  it('no-ops for empty ids', async () => {
    const db = { taxType: { findMany: vi.fn() } };
    await expect(assertActiveTaxTypeIds(db, 't1', [])).resolves.toBeUndefined();
    expect(db.taxType.findMany).not.toHaveBeenCalled();
  });

  it('passes when all found and Active', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Active', taxName: 'VAT' },
        ]),
      },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['a'])).resolves.toBeUndefined();
  });

  it('rejects Inactive', async () => {
    const db = {
      taxType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', status: 'Inactive', taxName: 'Old VAT' },
        ]),
      },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['a'])).rejects.toMatchObject({
      code: 'INACTIVE_TAX',
    });
  });

  it('rejects unknown id', async () => {
    const db = {
      taxType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(assertActiveTaxTypeIds(db, 't1', ['missing'])).rejects.toMatchObject({
      code: 'UNKNOWN_TAX',
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js`

- [ ] **Step 3: Implement helper**

```js
/**
 * Ensure every taxTypeId belongs to tenant and is Active.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} tenantId
 * @param {string[]} taxTypeIds
 */
export async function assertActiveTaxTypeIds(db, tenantId, taxTypeIds) {
  const ids = [...new Set((taxTypeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return;

  const rows = await db.taxType.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, status: true, taxName: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      const err = new Error(`Unknown tax type: ${id}`);
      err.code = 'UNKNOWN_TAX';
      err.status = 400;
      throw err;
    }
    if (row.status !== 'Active') {
      const err = new Error(
        `Tax "${row.taxName || id}" is not active and cannot be used on new documents.`
      );
      err.code = 'INACTIVE_TAX';
      err.status = 400;
      throw err;
    }
  }
}

/** Collect taxTypeIds from quotation/invoice item tax arrays. */
export function collectTaxTypeIdsFromItems(items) {
  const ids = [];
  for (const item of items || []) {
    const taxes = item.itemTaxes || item.taxes || item.taxBreakdown || [];
    for (const t of taxes) {
      const id = t.taxTypeId || t.id;
      if (id) ids.push(id);
    }
  }
  return ids;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js`

---

### Task 2: Client helper + Quotation/Invoice/POS pickers

**Files:**
- Create: `lib/taxTypesClient.js`
- Modify: `components/QuotationModal.js` (replace `fetch('/api/tax-types')` used for picker load)
- Modify: `components/InvoiceModal.js` (same)
- Modify: `app/pos/page.js` (replace `fetch('/api/tax-types?status=Active')` with helper)

**Interfaces:**
- Produces: `export async function fetchActiveTaxTypes()` → `Promise<array>` of tax type objects from JSON `taxTypes` or array body (match existing API response shape used by modals).

- [ ] **Step 1: Implement client helper**

```js
export async function fetchActiveTaxTypes() {
  const response = await fetch('/api/tax-types?status=Active');
  if (!response.ok) {
    throw new Error(`Failed to load tax types: ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.taxTypes || data.data || [];
}
```

- [ ] **Step 2: Wire QuotationModal**

Replace picker loads of `fetch('/api/tax-types')` with `fetchActiveTaxTypes()` (import from `@/lib/taxTypesClient`). Leave create-tax `POST /api/tax-types` unchanged.

- [ ] **Step 3: Wire InvoiceModal** — same as QuotationModal.

- [ ] **Step 4: Wire POS** — use `fetchActiveTaxTypes()` for the Active list load.

- [ ] **Step 5: Manual check** — open Quotation modal with an Inactive tax in DB; it must not appear in checkboxes.

---

### Task 3: API write enforcement

**Files:**
- Modify: `app/api/quotations/route.js` (POST, before itemTaxes create)
- Modify: `app/api/quotations/[id]/route.js` (PUT/PATCH that recreates items)
- Modify: `app/api/invoices/route.js` (POST)
- Modify: `app/api/invoices/[id]/route.js` (PUT that writes item taxes)
- Modify: `app/api/sales/route.js` (before creating sale item tax rows from taxBreakdown)

**Pattern in each write handler (before persisting taxes):**

```js
import {
  assertActiveTaxTypeIds,
  collectTaxTypeIdsFromItems,
} from '@/lib/taxManagement/assertActiveTaxTypes';

try {
  await assertActiveTaxTypeIds(prisma, user.tenantId, collectTaxTypeIdsFromItems(items));
} catch (e) {
  if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
  }
  throw e;
}
```

**Create (POST):** call with three args only — strict Active-only.

**Update (PUT):** load existing item-tax `taxTypeId`s for the document (tenant-scoped), then pass as 4th arg `allowInactiveIds` so historical Inactive line taxes can be preserved; IDs not on that allow-list still require Active.

```js
const allowInactiveIds = existingItemTaxes.map((r) => r.taxTypeId);
await assertActiveTaxTypeIds(
  prisma,
  user.tenantId,
  collectTaxTypeIdsFromItems(items),
  allowInactiveIds
);
```

For sales, also collect IDs from each `item.taxBreakdown` before insert.

- [ ] **Step 1: Quotations POST + [id] update** (PUT uses `allowInactiveIds` from existing `quotationItemTax`)
- [ ] **Step 2: Invoices POST + [id] update** (PUT uses `allowInactiveIds` from existing item taxes)
- [ ] **Step 3: Sales POST taxBreakdown path**
- [ ] **Step 4: Verify** — POST quotation with Inactive taxTypeId returns 400 JSON `{ code: 'INACTIVE_TAX' }`; PUT of a doc that already has that Inactive tax succeeds when only preserving it

---

### Task 4: Tax Codes Activate / Deactivate UX

**Files:**
- Modify: `app/tax-types/page.js`

- [ ] **Step 1: Add `toggleTaxStatus(tax)` that PUTs `{ status: tax.status === 'Active' ? 'Inactive' : 'Active' }`**

- [ ] **Step 2: In the table Actions column, add button:**
  - If Active → “Deactivate” (confirm: “This tax will no longer appear on quotations, invoices, or POS.”)
  - If Inactive → “Activate”

- [ ] **Step 3: Refresh list after success; show toast/alert on failure**

- [ ] **Step 4: Manual check** — Deactivate a tax → disappear from Invoice modal after reload; Activate → reappear.

---

### Task 5: Spec acceptance sweep

- [ ] Inactive not in Quotation / Invoice / POS pickers
- [ ] API 400 on Inactive taxTypeId for quotation create
- [ ] Tax Codes still lists Inactive and can Activate
- [ ] Existing document with that tax still opens for view/edit of historical lines (read path unchanged)
- [ ] Run: `npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js`

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Activate/Deactivate UX on Tax Codes | Task 4 |
| Pickers Active-only | Task 2 |
| Shared client helper | Task 2 |
| Server reject Inactive on quote/invoice/sale write | Task 1 + 3 (create strict; PUT `allowInactiveIds` grandfathering) |
| Historical lines preserved | Task 3 (read paths untouched + PUT allow-list) |
| GET /api/tax-types default unchanged | No change to route list default |

## Placeholder scan

No TBD/TODO steps; code snippets are concrete.
