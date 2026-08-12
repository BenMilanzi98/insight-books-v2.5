### Task 6: Damage / repair operator hooks (minimal tracing)

**Files:**
- Create: `app/api/rentals/charges/damage/route.js` (or extend complete/return)
- Modify: `app/rentals/RentalsClient.js` — optional “Record damage” on active booking
- Modify: expense create path **or** document notes convention — prefer small API that creates an Expense with `notes` including `source=REPAIR` + `rentalTransactionId=`

**Interfaces:**
- `POST /api/rentals/charges/damage` body `{ transactionId, amount, description }` → creates Customer Invoice line charge **or** standalone Pending invoice with `isRentalInvoice:true` + notes `source=DAMAGE`, linked via notes/`orderNumber=rt.id` if no FK; prefer creating `Invoice` + payment path on `/invoices`.
- `POST /api/rentals/charges/repair` body `{ transactionId?, rentalAssetId, amount, description }` → Expense with tagged notes for Reports.

Keep YAGNI: if V2 `RentalCharge` billing already exists for contracts, call into it when `contractId` present; for legacy RT-only bookings use invoice/expense tagging above.

- [ ] **Step 1: Unit test for tag helpers used by damage/repair create**

Extend `test/rentalSourceTags.test.js`:

```js
import { formatRentalTraceNote } from '../lib/rentalSourceTags.js';

it('formats repair/damage notes for report scraping', () => {
  expect(formatRentalTraceNote({ event: 'REPAIR', rentalTransactionId: 'rt-1' })).toContain('source=REPAIR');
  expect(formatRentalTraceNote({ event: 'DAMAGE', rentalTransactionId: 'rt-1' })).toContain('source=DAMAGE');
});
```

Implement:

```js
export function formatRentalTraceNote({ event, rentalTransactionId, rentalAssetId }) {
  return [
    `source=${event}`,
    rentalTransactionId ? `rentalTransactionId=${rentalTransactionId}` : null,
    rentalAssetId ? `rentalAssetId=${rentalAssetId}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 2: Implement damage invoice create + repair expense create** following existing invoice/expense patterns in the codebase (copy money helpers, tax optional 0 for v1 damage unless tax types selected).

- [ ] **Step 3: Wire minimal UI actions on Rentals + Customer hire lists.**

- [ ] **Step 4: Confirm Reports picks up tagged rows.**

- [ ] **Step 5: Commit only if user asked**

---

