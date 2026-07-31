# Purchase Order Audit

## Classification: `EXTEND` (workflow) / `REUSE` (no posting) / `INCOMPLETE` (state machine)

### Accounting & inventory (verified intent)

PO create/approve paths do **not** call:

- `createPurchaseReceiptJournalEntry` / posting engine
- `createFifoBatch` / inventory transactions

**Correct:** PO = commitment only. Must be locked with regression tests (Scenario 1).

### Status handling

- Free-string `status` (Draft, Approved, etc.).
- Create often lands as Approved (policy shortcut) — weak segregation of duties.
- No command API (`submit` / `approve` / `amend` / `cancel`); updates mutate status fields.
- Receipt/billing/payment status not first-class dimensions; partially inferred in UI.

Classification: **`REIMPLEMENT` state machine** on top of existing model.

### Quantities

- Line: `quantityOrdered`, `quantityReceived`
- Missing billed/returned/rejected/outstanding on lines
- Header rollups missing

### Amendments

Silent edit of approved POs possible if API allows — **must block** material changes without revision. Classification: `UNSAFE`.

### UI metrics risk

If Orders page labels commitment as “spent” or mixes billed/paid — treat as `INCORRECT` UX (verify during UI phase; prefer “Ordered Commitments”).

### Disposition

| Item | Action |
|------|--------|
| Model | EXTEND fields + version |
| Status | Formal transitions + audit |
| Posting | Keep none; add guard tests |
| UI | Separate Ordered / Received / Billed / Paid |
