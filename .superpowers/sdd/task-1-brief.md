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

