### Task 3: Reconcile Account CTA on hub

**Files:**
- Modify: `components/payments/PaymentChannelsPanel.jsx`
- Modify: `app/payments/page.js`
- Modify: hub copy strings on payments page header

**Interfaces:**
- Consumes: `isGuidedReconcilableAccountType`
- Produces: button navigates to `/payments/reconcile/[paymentAccountId]`

- [ ] **Step 1: Pass reconcile handler into panel**

In `app/payments/page.js`, import router (already present) and:

```js
const canReconcile = /* getPermission bankReconciliation.view â€” load in useEffect */;

const handleReconcileAccount = (account) => {
  router.push(`/payments/reconcile/${account.id}`);
};
```

Pass `onReconcileAccount={canReconcile ? handleReconcileAccount : undefined}` into `PaymentChannelsPanel`.

Update page title/subtitle from â€œPayment Accountsâ€ / cash-bank-mobile copy to **Accounts & Reconciliation** language per spec.

- [ ] **Step 2: AccountRow CTA**

In `PaymentChannelsPanel.jsx` `AccountRow` (non-management mode):

- Import `isGuidedReconcilableAccountType`.
- If eligible and `onReconcileAccount` provided, render a **Reconcile Account** button that `stopPropagation` and calls `onReconcileAccount(account)`.
- Keep existing row click for history/select.

Pseudo:

```jsx
{isGuidedReconcilableAccountType(account.accountType) && onReconcileAccount ? (
  <button
    type="button"
    className="text-xs font-semibold text-indigo-700 ..."
    onClick={(e) => {
      e.stopPropagation();
      onReconcileAccount(account);
    }}
  >
    {tt('Reconcile Account')}
  </button>
) : null}
```

Thread `onReconcileAccount` through `ChannelCard` â†’ `AccountRow`.

- [ ] **Step 3: Verify**

Bank/Mobile Money rows show **Reconcile Account**; Cash does not.

- [ ] **Step 4: Commit**

```bash
git add app/payments/page.js components/payments/PaymentChannelsPanel.jsx
git commit -m "feat(payments): Reconcile Account CTA for Bank and Mobile Money"
```

---
