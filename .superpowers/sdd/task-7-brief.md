### Task 7: Regression checklist (manual + automated)

**Files:**
- Optional: `test/rentalHubs.smoke.test.js` for pure redirects/tag invariants only (no DB).

- [ ] **Step 1: Automated**

```bash
npx vitest run test/rentalSourceTags.test.js test/rentalReverseService.test.js test/rentalReportsService.test.js test/rentalKinds.test.js test/rentalAvailability.test.js test/rentalBookingPolicy.test.js
```

Expected: all PASS.

- [ ] **Step 2: Manual checklist**

1. Sidebar shows only Rentals / Hirings / Reports.
2. Book space → invoice on `/invoices` → record payment.
3. Book customer hire → invoice on `/invoices` → payment.
4. Reverse draft → slots free + space available / pool capacity restored.
5. Reverse posted unpaid → invoice voided + slots free.
6. Reverse paid → 409 + guidance; after refund/credit, reverse succeeds.
7. Supplier hire bill → expense/AP only; Reports supplier spend increases; revenue unchanged.
8. Damage + repair → appear under Reports damages/repairs.
9. Deep links `/rentals/contracts-v2` still load for power users.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Three sidebar options | 3 |
| Rentals = spaces only | 3–4 (existing `/rentals` mode) |
| Hirings dual tabs | 4 |
| Hide Contracts/Quotations/Reconcile | 3 |
| Redirects old hiring URLs | 3–4 |
| Invoice on `/invoices` | 1 (tags) + existing book path |
| Reverse frees dates + restock | 2 |
| Paid reverse gated | 2 |
| Revenue/tax/reversals/damages/repairs/utilization/supplier | 5–6 |
| Supplier never customer revenue | 4–5 |
| POS-style headers | 4–5 |

## Placeholder scan

No TBD / “implement later” left; hiring-v2 supplier bill model must be confirmed by reading the action route in Task 5 Step 1 (explicit instruction, not a placeholder).

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-rentals-hirings-three-hubs.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
