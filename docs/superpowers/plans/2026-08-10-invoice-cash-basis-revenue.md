# Invoice Cash-Basis Revenue + Instant COGS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invoice issue posts AR + Deferred Revenue (+ VAT) and instant COGS; Sales Revenue is recognized only when invoice payments are recorded (pro-rata).

**Architecture:** Change the `CUSTOMER_INVOICE` posting template to credit `DEFERRED_REVENUE` instead of `SALES_REVENUE`. Add purpose `DEFERRED_REVENUE` (leaf 2150). On each payment, after Cash/AR settlement, post a new idempotent `Invoice-Revenue` journal moving Deferred → Sales for the payment’s net share. Refactor `ensureInvoiceSalesAccounting` so issue never credits Sales Revenue; payment path adds recognition and skips legacy invoices that already credited Sales Revenue at issue.

**Tech Stack:** Next.js App Router API routes, Accounting V2 posting engine/templates/adapters, Prisma, Vitest, `@/lib/money`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-invoice-cash-basis-revenue-design.md` — follow locked decisions exactly.
- Revenue recognition = payment basis; COGS = invoice issue; VAT Output = invoice issue; AR via Deferred Revenue.
- Existing invoices that already credited Sales Revenue at issue: leave journals; skip Journal D on their payments.
- Do not change POS cash-sale recognition.
- Do not mass-rewrite historical GL.
- Do not commit unless the user explicitly asks.
- Prefer TDD: failing test → implement → green for each task.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/coaV2/domain/systemPurposes.js` | Register `DEFERRED_REVENUE` purpose |
| `lib/coaV2/application/purposeMappingReadiness.js` | Include purpose in readiness list if needed |
| `lib/coaPostingCodes.js` | `CODE_DEFERRED_REVENUE = '2150'` |
| `lib/accountingV2/domain/enums.js` | Event type for revenue recognition if required by engine |
| `lib/accountingV2/templates/pilotTemplates.js` (and/or `stageTemplates.js`) | Invoice draft: Cr Deferred not Sales |
| `lib/accountingV2/templates/definitions.js` | Template required purposes |
| `lib/accountingV2/engine/legacyGuard.js` | Map `Invoice-Revenue` source type |
| `lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js` | New adapter for Journal D |
| `lib/accountingV2/adapters/index.js` | Export adapter |
| `lib/invoiceDeferredRevenue.js` | Pure helpers: pro-rata net, last-payment remaining, legacy detection |
| `lib/ensureInvoiceSalesAccounting.js` | Issue = A+B only; no Sales Revenue |
| `lib/ensureInvoicePaymentRevenueRecognition.js` | Journal D after payment; skip legacy |
| `app/api/invoices/partial-payment/route.js` | Call issue ensure + payment recognition |
| `app/api/invoices/route.js` / `[id]/route.js` | Keep issue ensure (already); no Sales Revenue |
| `lib/accountingV2/application/reverseSourceJournals.js` (+ payment/invoice reverse callers) | Reverse `Invoice-Revenue` with payment |
| Tests under `test/` | Unit + static route guards |

---

### Task 1: Deferred Revenue purpose + posting code

**Files:**
- Modify: `lib/coaV2/domain/systemPurposes.js`
- Modify: `lib/coaPostingCodes.js`
- Modify: `lib/coaV2/application/purposeMappingReadiness.js` (add to standard list if `SALES_REVENUE` peers are listed)
- Modify: `lib/coaV2/templates/blueprintClassification.js` (map `'2150'` → liability / deferred if blueprint maps codes)
- Test: `test/coaDeferredRevenuePurpose.test.js` (create)

**Interfaces:**
- Produces: purpose key `DEFERRED_REVENUE` with `legacyCode: '2150'`, liability, credit normal balance
- Produces: `export const CODE_DEFERRED_REVENUE = '2150'` from `lib/coaPostingCodes.js`

- [ ] **Step 1: Write the failing test**

```js
// test/coaDeferredRevenuePurpose.test.js
import { describe, it, expect } from 'vitest';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';
import { CODE_DEFERRED_REVENUE } from '../lib/coaPostingCodes.js';

describe('DEFERRED_REVENUE purpose', () => {
  it('is registered as a credit liability with legacy code 2150', () => {
    expect(CODE_DEFERRED_REVENUE).toBe('2150');
    const p = SYSTEM_ACCOUNT_PURPOSES.DEFERRED_REVENUE;
    expect(p).toBeTruthy();
    expect(p.legacyCode).toBe('2150');
    expect(p.normalBalance).toBe('CREDIT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/coaDeferredRevenuePurpose.test.js`  
Expected: FAIL (missing export / purpose)

- [ ] **Step 3: Write minimal implementation**

In `lib/coaPostingCodes.js` add:

```js
export const CODE_DEFERRED_REVENUE = '2150';
```

In `lib/coaV2/domain/systemPurposes.js`, next to `VAT_OUTPUT` / payables liabilities, add:

```js
DEFERRED_REVENUE: {
  categories: [LIABILITY],
  behaviours: [POSTING, SYSTEM],
  normalBalance: CREDIT,
  subTypes: [AccountSubType.CURRENT_LIABILITY],
  legacyCode: '2150',
  notes: 'Unearned / deferred invoice revenue until payment recognition',
},
```

Add `'DEFERRED_REVENUE'` to the standard purposes array in `purposeMappingReadiness.js` alongside `SALES_REVENUE` / `VAT_OUTPUT`.

If `blueprintClassification.js` maps codes to subtypes, add `'2150'` → current liability (mirror `2120` pattern).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/coaDeferredRevenuePurpose.test.js`  
Expected: PASS

- [ ] **Step 5: Commit only if user asked**

---

### Task 2: Pure money helpers for recognition amounts

**Files:**
- Create: `lib/invoiceDeferredRevenue.js`
- Test: `test/invoiceDeferredRevenue.test.js`

**Interfaces:**
- Produces:
  - `computePaymentRecognizedNet({ paymentAmount, invoiceTotal, invoiceTaxAmount }) → number`
  - `computeFinalPaymentRecognizedNet({ invoiceNet, previouslyRecognizedNet }) → number`
  - `invoiceUsesLegacyAccrualRevenue(journalLinesOrFlag) → boolean` (or separate detector later)

- [ ] **Step 1: Write the failing tests**

```js
// test/invoiceDeferredRevenue.test.js
import { describe, it, expect } from 'vitest';
import {
  computePaymentRecognizedNet,
  computeFinalPaymentRecognizedNet,
} from '../lib/invoiceDeferredRevenue.js';

describe('invoice deferred revenue math', () => {
  it('pro-rates net revenue by payment / total', () => {
    // total 1180, tax 180, net 1000; pay 590 → recognize 500
    expect(
      computePaymentRecognizedNet({
        paymentAmount: 590,
        invoiceTotal: 1180,
        invoiceTaxAmount: 180,
      })
    ).toBe(500);
  });

  it('final payment uses remaining net not a fresh multiply', () => {
    expect(
      computeFinalPaymentRecognizedNet({
        invoiceNet: 1000,
        previouslyRecognizedNet: 500,
      })
    ).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/invoiceDeferredRevenue.test.js`  
Expected: FAIL module not found

- [ ] **Step 3: Write minimal implementation**

```js
// lib/invoiceDeferredRevenue.js
import { multiplyMoney, parseMoney, roundMoney, subtractMoney } from '@/lib/money';

export function computePaymentRecognizedNet({
  paymentAmount,
  invoiceTotal,
  invoiceTaxAmount,
}) {
  const total = parseMoney(invoiceTotal);
  const tax = parseMoney(invoiceTaxAmount);
  const net = subtractMoney(total, tax);
  const pay = parseMoney(paymentAmount);
  if (total <= 0 || pay <= 0 || net <= 0) return 0;
  return roundMoney(multiplyMoney(pay, net / total));
}

export function computeFinalPaymentRecognizedNet({
  invoiceNet,
  previouslyRecognizedNet,
}) {
  return roundMoney(
    Math.max(0, subtractMoney(parseMoney(invoiceNet), parseMoney(previouslyRecognizedNet)))
  );
}
```

(Use existing `multiplyMoney` / ratio patterns from `lib/money.js`; if `multiplyMoney(pay, net/total)` is awkward, use `roundMoney((pay * net) / total)` with parseMoney inputs.)

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit only if user asked**

---

### Task 3: Change CUSTOMER_INVOICE template to credit Deferred Revenue

**Files:**
- Modify: `lib/accountingV2/templates/pilotTemplates.js` (`buildCustomerInvoiceDraft`)
- Modify: `lib/accountingV2/templates/definitions.js` (required purposes: replace/add `DEFERRED_REVENUE`)
- Modify: `lib/accountingV2/templates/stageTemplates.js` if a duplicate invoice template exists there
- Test: `test/invoiceIssueDeferredRevenueTemplate.test.js` (create) — static or unit with mocked `resolvePurpose`

**Interfaces:**
- Consumes: purpose `DEFERRED_REVENUE`
- Produces: Invoice journal lines Dr AR / Cr Deferred (net) / Cr VAT (tax); **never** Cr `SALES_REVENUE` on issue

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('customer invoice issue template', () => {
  it('credits deferred revenue purpose instead of sales revenue on issue', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/accountingV2/templates/pilotTemplates.js'),
      'utf8'
    );
    // Within buildCustomerInvoiceDraft region — assert deferred resolve and no sales credit for issue
    expect(src).toContain("resolvePurpose('DEFERRED_REVENUE')");
    const fnStart = src.indexOf('async function buildCustomerInvoiceDraft');
    const fnSlice = src.slice(fnStart, fnStart + 2500);
    expect(fnSlice).toContain('DEFERRED_REVENUE');
    expect(fnSlice).not.toContain("resolvePurpose('SALES_REVENUE')");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `buildCustomerInvoiceDraft`:
- `const deferred = await resolvePurpose('DEFERRED_REVENUE');` instead of `SALES_REVENUE`
- Credit line description: `Deferred revenue — invoice ${number}`
- Keep VAT_OUTPUT block unchanged
- Update `requiredPurposes` on `CUSTOMER_INVOICE` register to `['ACCOUNTS_RECEIVABLE', 'DEFERRED_REVENUE', 'VAT_OUTPUT']` (VAT still optional at runtime when tax=0; match existing pattern for VAT)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit only if user asked**

---

### Task 4: Invoice-Revenue recognition adapter + template

**Files:**
- Create: `lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js`
- Modify: `lib/accountingV2/adapters/index.js`
- Modify: `lib/accountingV2/templates/stageTemplates.js` (or pilot) — register `INVOICE_REVENUE_RECOGNIZED` / template
- Modify: `lib/accountingV2/domain/enums.js` — add `AccountingEventType.INVOICE_REVENUE_RECOGNIZED` if engine requires it
- Modify: `lib/accountingV2/engine/legacyGuard.js` — `'Invoice-Revenue': { moduleKey: SALES or RECEIVABLES, eventType: ... }`
- Modify: `lib/accountingV2/engine/sourceValidation.js` — register validator
- Modify: `lib/accountingV2/engine/journalNumbering.js` — short code e.g. `REV`
- Test: `test/invoiceRevenueRecognitionAdapter.test.js`

**Interfaces:**
- Produces: `postInvoiceRevenueRecognitionAccounting({ db, tenantId, userId, paymentId, invoiceId, recognizedNet, paymentDate, hasPermission })`
- Idempotency: `sourceType: 'Invoice-Revenue'`, `sourceId: paymentId`
- Journal: Dr DEFERRED_REVENUE / Cr SALES_REVENUE for `recognizedNet` (skip if ≤ 0)

- [ ] **Step 1: Write failing test** (mock `submitViaCutover` / assert buildEngineInput shape via vi.mock of baseAdapter — follow `test/accountingV2.integrations.test.js` patterns)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const submitViaCutover = vi.fn(async ({ buildEngineInput }) => {
  const input = await buildEngineInput();
  return { input };
});

vi.mock('../lib/accountingV2/adapters/baseAdapter.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitViaCutover: (...a) => submitViaCutover(...a),
  };
});

// prisma-less: adapter loads invoice/payment via db mocks
```

Minimal assertion: `sourceReference.sourceType === 'Invoice-Revenue'`, `sourceId === paymentId`, `totalAmount` matches recognized net.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement adapter + template** mirroring `costOfSalesAdapter.js` / `CUSTOMER_PAYMENT` draft:
  - Template `INVOICE_REVENUE_RECOGNITION`: required purposes `DEFERRED_REVENUE`, `SALES_REVENUE`
  - Lines: Dr deferred, Cr sales, amount from `command.totalAmount` / metadata `recognizedNet`

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit only if user asked**

---

### Task 5: Refactor ensure issue accounting (no Sales Revenue)

**Files:**
- Modify: `lib/ensureInvoiceSalesAccounting.js`
- Modify: `test/ensureInvoiceSalesAccounting.test.js`

**Interfaces:**
- Consumes: `postInvoiceAccounting` (now deferred template), `postCostOfSalesAccounting`
- Produces: same return shape; `postedInvoice` means Journal A posted; never expects Sales Revenue
- Update file header comment to match spec

- [ ] **Step 1: Update tests**

Change expectations:
- Still calls `postInvoiceAccounting` + `postCostOfSalesAccounting` when missing
- Add comment/assertion that route tests no longer imply “revenue on create”
- Keep Draft skip / force behaviour for issue+COGS when paying Draft

- [ ] **Step 2: Run tests — may still PASS** if only comments; if any assert Sales Revenue, update

- [ ] **Step 3: Tighten implementation comments**; ensure payment callers will not treat this as full revenue recognition

- [ ] **Step 4: Run `npx vitest run test/ensureInvoiceSalesAccounting.test.js` — PASS**

---

### Task 6: Payment revenue recognition helper + wire partial-payment

**Files:**
- Create: `lib/ensureInvoicePaymentRevenueRecognition.js`
- Modify: `app/api/invoices/partial-payment/route.js`
- Modify: `test/invoicePartialPaymentSalesAccounting.test.js`
- Test: `test/ensureInvoicePaymentRevenueRecognition.test.js`

**Interfaces:**
- Produces: `ensureInvoicePaymentRevenueRecognition({ db, tenantId, userId, invoiceId, paymentId, paymentAmount, hasPermission })`
- Logic:
  1. Load invoice (`total`, `taxAmount`)
  2. Find posted `Invoice` JE for invoice; if none, return `{ skipped: 'no_issue_journal' }` (caller should have run issue ensure first)
  3. If any credit line on that JE is to Sales Revenue account (legacy): return `{ skipped: 'legacy_accrual' }`
  4. If `Invoice-Revenue` already exists for `paymentId`: return `{ skipped: 'already_posted' }`
  5. Sum prior `Invoice-Revenue` totals for this invoice’s payments (or sum recognized nets from journals linked by payment ids on invoice)
  6. If payment settles remaining balance (`remaining after this payment ≤ MONEY_TOLERANCE`): `recognizedNet = computeFinalPaymentRecognizedNet(...)` else `computePaymentRecognizedNet(...)`
  7. Call `postInvoiceRevenueRecognitionAccounting`

**Legacy detection:** load Invoice JE lines with accounts; if any credited account maps to purpose `SALES_REVENUE` or `accountCode === '4100'` (Product Sales), treat as legacy.

Wire `partial-payment/route.js` inside the transaction **after** payment create + `postCustomerPaymentAccounting`:

```js
await ensureInvoiceSalesAccounting({ db: tx, tenantId, userId, invoiceId, force: true });
// create payment + update invoice status...
await postCustomerPaymentAccounting({ ... });
await ensureInvoicePaymentRevenueRecognition({
  db: tx,
  tenantId: user.tenantId,
  userId: user.id,
  invoiceId,
  paymentId: payment.id,
  paymentAmount: numericAmount,
});
```

Update static test:

```js
expect(source).toContain('ensureInvoicePaymentRevenueRecognition');
expect(source).toContain('ensureInvoiceSalesAccounting');
```

- [ ] **Step 1: Failing unit tests** for skip legacy / pro-rata / final payment (mock db + adapter)

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement helper + wire route**

- [ ] **Step 4: Run related vitest files — PASS**

---

### Task 7: Reversal coverage for Invoice-Revenue

**Files:**
- Modify: `lib/accountingV2/application/reverseSourceJournals.js` and/or invoice payment reversal / void paths that already reverse `Payment`
- Grep callers: `reverseSourceJournals`, invoice void/refund, payment reversal
- Test: extend existing reversal test or add `test/invoiceRevenueRecognitionReversal.test.js` (static: void/refund includes `Invoice-Revenue` in source types list)

**Interfaces:**
- When reversing a payment, also reverse journals with `sourceType: 'Invoice-Revenue'` and `sourceId: paymentId`
- Invoice void that reverses `Invoice` already reverses issue lines (now Deferred + VAT); ensure no assumption that credits were Sales Revenue in description-only logic

- [ ] **Step 1: Grep and write failing static/unit test** that payment reverse includes Invoice-Revenue

- [ ] **Step 2: Implement minimal extension**

- [ ] **Step 4: PASS**

---

### Task 8: Smoke verification (manual / scripted)

**Files:** none required (optional `.cursor` script deleted after)

- [ ] **Step 1:** Create Pending inventory invoice on local tenant → confirm Product Sales GL movement for that journal is 0; Deferred 2150 credited; Invoice-COGS posted
- [ ] **Step 2:** Partial payment → Product Sales increases by pro-rata net; AR decreases; Deferred decreases
- [ ] **Step 3:** Pay remainder → deferred for invoice ~0; cumulative sales net = invoice net
- [ ] **Step 4:** Dashboard revenue for today moves with payments, not unpaid invoice total
- [ ] **Step 5:** Pay a legacy invoice (if any with 4100 on issue) → no second revenue recognition

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Issue: Dr AR / Cr Deferred / Cr VAT | 3 |
| Issue: instant COGS | 5 (existing ensure) |
| Payment: Cash/AR | existing + 6 |
| Payment: Deferred → Sales pro-rata | 2, 4, 6 |
| Last payment remaining net | 2, 6 |
| Purpose DEFERRED_REVENUE 2150 | 1 |
| Skip legacy accrual invoices | 6 |
| No historical rewrite | Global + 6 |
| Reverse Invoice-Revenue | 7 |
| Draft no GL until finalize/force | 5 |
| Dashboard follows Sales Revenue | emergent from 3–6 |

## Placeholder / consistency self-review

- Source type locked: **`Invoice-Revenue`**, event **`INVOICE_REVENUE_RECOGNIZED`**
- Purpose locked: **`DEFERRED_REVENUE`**, code **`2150`**
- No TBD left in tasks
