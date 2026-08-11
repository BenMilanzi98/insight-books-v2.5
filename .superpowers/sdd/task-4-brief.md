### Task 4: Receipts UI success notice with Bills / Payments links

**Files:**
- Modify: `app/purchases/receipts/page.js` (`postReceipt` consumer / `handleCreate` / page banner)

**Interfaces:**
- Consumes: `postReceipt` → `{ goodsReceipt: { supplierBillId, billNumber, billStatus, deferredStockPosting, stockPostingPending, ... } }`
- Produces: visible success message after inventory receive

- [ ] **Step 1: Capture POST result in `handleCreate`**

Replace:

```js
  const handleCreate = async (payload) => {
    await postReceipt(payload);
    setShowForm(false);
    await loadData();
  };
```

With state + handler:

Near other `useState` hooks on the page component (where `showForm` lives), add:

```js
  const [receiveNotice, setReceiveNotice] = useState(null);
```

Then:

```js
  const handleCreate = async (payload) => {
    const result = await postReceipt(payload);
    const gr = result?.goodsReceipt || null;
    setShowForm(false);

    if (payload?.receiptType === 'inventory' || (gr?.items && gr.items.length > 0)) {
      if (gr?.deferredStockPosting || gr?.stockPostingPending) {
        setReceiveNotice({
          tone: 'warning',
          title: 'Receipt posted — stock deferred',
          body: 'This receipt date is in the future. Stock and the unpaid bill will apply on the receipt date.',
          billNumber: gr?.billNumber || null,
        });
      } else {
        setReceiveNotice({
          tone: 'success',
          title: 'Goods received',
          body: gr?.billNumber
            ? `Stock updated. Unpaid bill ${gr.billNumber} is ready to pay.`
            : 'Stock updated. An unpaid supplier bill is ready on Bills / Payments.',
          billNumber: gr?.billNumber || null,
          supplierBillId: gr?.supplierBillId || null,
        });
      }
    } else {
      setReceiveNotice(null);
    }

    await loadData();
  };
```

- [ ] **Step 2: Render the notice above the list**

Inside the page return, above the receipts table / filters (and below the header actions), add:

```jsx
      {receiveNotice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            receiveNotice.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{receiveNotice.title}</p>
              <p className="mt-1">{receiveNotice.body}</p>
              {receiveNotice.tone === 'success' && (
                <p className="mt-2 flex flex-wrap gap-3">
                  <a href="/purchases/bills" className="font-medium underline underline-offset-2">
                    Open Bills
                  </a>
                  <a href="/purchases/payments" className="font-medium underline underline-offset-2">
                    Open Payments
                  </a>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReceiveNotice(null)}
              className="text-xs font-medium opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
```

Use `next/link` `Link` instead of `<a>` if the page already imports `Link`; otherwise plain anchors are fine for this notice.

- [ ] **Step 3: Manual UI verification**

1. Open `/purchases/receipts` → Receive Goods → post a same-day receipt for a known product.
2. Confirm product stock on `/stock` increased by received qty.
3. Confirm success notice appears with Bills / Payments links.
4. Open `/purchases/bills` — Unpaid bill `GRB-…` exists for the amount.
5. Open `/purchases/payments` — that unpaid bill is selectable; do **not** expect a payment to already exist.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

