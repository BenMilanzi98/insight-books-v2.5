### Task 1: Source tags + operator labels

**Files:**
- Create: `lib/rentalSourceTags.js`
- Create: `test/rentalSourceTags.test.js`
- Modify: `lib/rentalKinds.js`
- Modify: `test/rentalKinds.test.js`

**Interfaces:**
- Produces:
  - `OUTBOUND_INVOICE_SOURCE = { RENTAL_SPACE: 'RENTAL_SPACE', CUSTOMER_HIRE: 'CUSTOMER_HIRE' }`
  - `resolveOutboundInvoiceSource(kind: string|null): 'RENTAL_SPACE'|'CUSTOMER_HIRE'|null`
  - `RENTAL_TRACE_EVENT = { REVENUE, TAX, REVERSAL, DAMAGE, DAMAGE_LOSS, REPAIR, SUPPLIER_HIRE_SPEND, UTILIZATION }`
  - `outboundKindLabel(kind)` returns `'Customer hire'` for quantity pool (was `'Quantity rental'`)

- [ ] **Step 1: Write failing tests**

Create `test/rentalSourceTags.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  OUTBOUND_INVOICE_SOURCE,
  resolveOutboundInvoiceSource,
  RENTAL_TRACE_EVENT,
} from '../lib/rentalSourceTags.js';

describe('rentalSourceTags', () => {
  it('maps space rental kind to RENTAL_SPACE', () => {
    expect(resolveOutboundInvoiceSource('rental')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
    expect(resolveOutboundInvoiceSource('space')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
  });

  it('maps quantity pool / hiring kind to CUSTOMER_HIRE', () => {
    expect(resolveOutboundInvoiceSource('hiring')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
    expect(resolveOutboundInvoiceSource('quantity_pool')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
  });

  it('returns null for unknown / inbound kinds', () => {
    expect(resolveOutboundInvoiceSource('supplier_hire')).toBeNull();
    expect(resolveOutboundInvoiceSource(null)).toBeNull();
  });

  it('exports stable trace event constants', () => {
    expect(RENTAL_TRACE_EVENT.REVERSAL).toBe('REVERSAL');
    expect(RENTAL_TRACE_EVENT.DAMAGE).toBe('DAMAGE');
    expect(RENTAL_TRACE_EVENT.REPAIR).toBe('REPAIR');
    expect(RENTAL_TRACE_EVENT.SUPPLIER_HIRE_SPEND).toBe('SUPPLIER_HIRE_SPEND');
  });
});
```

Update expectation in `test/rentalKinds.test.js`:

```js
it('labels quantity pool for operators', () => {
  expect(outboundKindLabel('hiring')).toBe('Customer hire');
  expect(isQuantityPoolKind('hiring')).toBe(true);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js`

Expected: FAIL — missing module and/or label still `'Quantity rental'`.

- [ ] **Step 3: Implement**

Create `lib/rentalSourceTags.js`:

```js
import { normalizeOutboundRentalKind, OUTBOUND_RENTAL_KIND } from '@/lib/rentalKinds';

export const OUTBOUND_INVOICE_SOURCE = Object.freeze({
  RENTAL_SPACE: 'RENTAL_SPACE',
  CUSTOMER_HIRE: 'CUSTOMER_HIRE',
});

export const RENTAL_TRACE_EVENT = Object.freeze({
  REVENUE: 'REVENUE',
  TAX: 'TAX',
  REVERSAL: 'REVERSAL',
  DAMAGE: 'DAMAGE',
  DAMAGE_LOSS: 'DAMAGE_LOSS',
  REPAIR: 'REPAIR',
  SUPPLIER_HIRE_SPEND: 'SUPPLIER_HIRE_SPEND',
  UTILIZATION: 'UTILIZATION',
});

export function resolveOutboundInvoiceSource(kind) {
  const normalized = normalizeOutboundRentalKind(kind);
  if (normalized === OUTBOUND_RENTAL_KIND.RENTAL) return OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE;
  if (normalized === OUTBOUND_RENTAL_KIND.QUANTITY_POOL) return OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE;
  return null;
}
```

In `lib/rentalKinds.js`, change `outboundKindLabel`:

```js
export function outboundKindLabel(kind) {
  return isQuantityPoolKind(kind) ? 'Customer hire' : 'Rental';
}
```

In `app/api/rentals/route.js` invoice `create` data, set title using tags (keep behaviour, clearer copy):

```js
import { resolveOutboundInvoiceSource, OUTBOUND_INVOICE_SOURCE } from '@/lib/rentalSourceTags';
// ...
const source = resolveOutboundInvoiceSource(kind);
title:
  source === OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE
    ? 'Room / space rental'
    : 'Customer hire (equipment pool)',
notes: [notes, source ? `source=${source}` : null].filter(Boolean).join('\n') || null,
```

Keep `isRentalInvoice: true`. Do not add Prisma fields unless tests prove notes are insufficient for Reports (Reports will join `rentalTransaction.kind`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js`

Expected: PASS

- [ ] **Step 5: Commit only if user asked**

```bash
git add lib/rentalSourceTags.js test/rentalSourceTags.test.js lib/rentalKinds.js test/rentalKinds.test.js app/api/rentals/route.js
# git commit only when user requests
```

---

