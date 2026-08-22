### Task 2: Navigation rename + redirect

**Files:**
- Modify: `locales/en/navigation.json` (and any other locale files that define `paymentAccounts`)
- Modify: `lib/i18n/navLabelMap.js`
- Modify: `components/Sidebar/Sidebar.js`
- Replace: `app/bank-reconciliation/page.js` with redirect
- Create: `app/bank-reconciliation/page.js` (server redirect) â€” keep path for bookmarks

**Interfaces:**
- Produces: sidebar label **Accounts & Reconciliation** â†’ `/payments`
- Produces: `/bank-reconciliation` â†’ `/payments` (or `/payments/reconcile/[id]` when `?paymentAccountId=` present)

- [ ] **Step 1: Update i18n**

`locales/en/navigation.json`:

```json
"paymentAccounts": "Accounts & Reconciliation",
"bankReconciliation": "Accounts & Reconciliation"
```

(Leave `bankReconciliation` key for any residual references; value may match hub.)

Update `navLabelMap.js` if hardcoded English strings are mapped:

```js
'Payment Accounts': 'navigation.paymentAccounts',
'Accounts & Reconciliation': 'navigation.paymentAccounts',
'Bank Reconciliation': 'navigation.paymentAccounts',
```

- [ ] **Step 2: Sidebar**

In `components/Sidebar/Sidebar.js`:

1. Change text for `/payments` entries from `"Payment Accounts"` to `"Accounts & Reconciliation"`.
2. **Remove** the Accounting submenu item with `href: "/bank-reconciliation"`.

- [ ] **Step 3: Redirect page**

Replace `app/bank-reconciliation/page.js` with a thin server redirect:

```js
import { redirect } from 'next/navigation';

export default async function BankReconciliationRedirect({ searchParams }) {
  const sp = await searchParams;
  const paymentAccountId = sp?.paymentAccountId;
  if (paymentAccountId) {
    redirect(`/payments/reconcile/${encodeURIComponent(paymentAccountId)}`);
  }
  redirect('/payments');
}
```

- [ ] **Step 4: Manual check**

Open `/payments` â€” sidebar shows **Accounts & Reconciliation**.  
Open `/bank-reconciliation` â€” lands on `/payments`.

- [ ] **Step 5: Commit**

```bash
git add locales/en/navigation.json lib/i18n/navLabelMap.js components/Sidebar/Sidebar.js app/bank-reconciliation/page.js
git commit -m "feat(nav): Accounts & Reconciliation hub; redirect legacy bank-rec route"
```

---
