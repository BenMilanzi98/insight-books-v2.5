# Wave A — Invoice Payment Deferred Full Tax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep invoice payment adapters, but stop posting VAT on invoice issue; park tax in Deferred Revenue; release full invoice tax to VAT Output exactly once when the invoice becomes Paid; fix dashboard outstanding AR to use remaining balances; reverse Paid tax when the completing payment is reversed.

**Architecture:** Change `CUSTOMER_INVOICE` so issue is `Dr AR total / Cr Deferred total` (no VAT line). Add `Invoice-Tax` posting (`Dr Deferred / Cr VAT_OUTPUT` for full `taxAmount`) gated by Paid + idempotency. Wire `ensureInvoiceOutputTaxOnPaid` after revenue recognition on payment routes. Extend payment reversal to reverse `Invoice-Tax` by invoice id when needed. Fix metrics outstanding-invoice aggregation.

**Tech Stack:** Next.js API routes, Accounting V2 posting engine (templates/adapters), Prisma transactions, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-invoice-payment-deferred-tax-design.md`

## Global Constraints

- Approach 1 — fix hooks/adapters; do not rewrite the payment orchestrator.
- Revenue recognition on partials stays today’s behavior (`ensureInvoicePaymentRevenueRecognition`).
- No invoice output VAT GL until invoice status is **Paid**; then full `invoice.taxAmount` once.
- WHT on receipts stays payment-level (unchanged).
- Legacy invoices that already credited VAT on the issue journal: skip Paid tax post (no double tax).
- No auto-repair of Partially Paid invoices with legacy partial tax.
- Bills partials / closed-period UX / loan schedule lock are out of scope.
- Prefer posting inside the same DB transaction as the payment update.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/accountingV2/templates/pilotTemplates.js` | Issue journal: deferred = total; no VAT on issue |
| `lib/accountingV2/domain/enums.js` | `INVOICE_OUTPUT_TAX_RECOGNIZED` event |
| `lib/accountingV2/engine/journalNumbering.js` | Prefix for new event |
| `lib/accountingV2/engine/legacyGuard.js` | Map `Invoice-Tax` → SALES / new event |
| `lib/accountingV2/engine/sourceValidation.js` | Validate Invoice-Tax source |
| `lib/accountingV2/templates/stageTemplates.js` | `INVOICE_OUTPUT_TAX` template (Dr Deferred, Cr VAT) |
| `lib/accountingV2/adapters/invoiceOutputTaxAdapter.js` | `postInvoiceOutputTaxAccounting` |
| `lib/accountingV2/adapters/index.js` | Export adapter |
| `lib/ensureInvoiceOutputTaxOnPaid.js` | Gate + idempotency + legacy skip |
| `app/api/invoices/partial-payment/route.js` | Call ensure after recognition when Paid |
| `app/api/payments/route.js` | Same for invoice payments |
| `lib/transactionReversalService.js` | Reverse `Invoice-Tax` when undoing Paid |
| `app/api/dashboard/metrics/route.js` | Outstanding AR = remaining balances + Partial status |
| `test/invoiceIssueDeferredTaxParking.test.js` | Issue template behavior |
| `test/ensureInvoiceOutputTaxOnPaid.test.js` | Gate / idempotency unit tests |
| `test/invoiceOutputTaxAdapter.test.js` | Adapter engine input |
| `test/invoicePaymentDeferredTaxWiring.test.js` | Route source-order wiring |
| `test/dashboardMetricsOutstandingReceivables.test.js` | Metrics source assertions |

---

### Task 1: Park tax in deferred on invoice issue (no VAT line)

**Files:**
- Modify: `lib/accountingV2/templates/pilotTemplates.js` (`buildCustomerInvoiceDraft` + `CUSTOMER_INVOICE` registration)
- Create: `test/invoiceIssueDeferredTaxParking.test.js`
- Modify: `test/invoiceIssueDeferredRevenueTemplate.test.js` only if assertions conflict

**Interfaces:**
- Produces: issue draft lines = Dr AR `total`, Cr Deferred Revenue `total` (net+tax). No `VAT_OUTPUT` line when tax > 0.
- Produces: `requiredPurposes: ['ACCOUNTS_RECEIVABLE', 'DEFERRED_REVENUE']` (VAT optional / removed from required)

- [ ] **Step 1: Write the failing test**

Create `test/invoiceIssueDeferredTaxParking.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { AccountingEventType } from '../lib/accountingV2/domain/enums.js';
import { getActiveTemplate } from '../lib/accountingV2/templates/index.js';
import { money } from '../lib/accountingV2/domain/money.js';

describe('CUSTOMER_INVOICE parks tax in deferred', () => {
  it('credits deferred for full total and does not require VAT_OUTPUT', async () => {
    const template = getActiveTemplate(AccountingEventType.INVOICE_POSTED);
    expect(template.requiredPurposes).toEqual(['ACCOUNTS_RECEIVABLE', 'DEFERRED_REVENUE']);
    expect(template.requiredPurposes).not.toContain('VAT_OUTPUT');

    const accounts = {
      ACCOUNTS_RECEIVABLE: { id: 'ar' },
      DEFERRED_REVENUE: { id: 'def' },
      VAT_OUTPUT: { id: 'vat' },
    };
    const resolvePurpose = vi.fn(async (p) => accounts[p]);
    const command = {
      currency: 'MWK',
      transactionDate: '2026-08-22',
      requestedPostingDate: '2026-08-22',
      description: null,
      sourceReference: { sourceType: 'Invoice', sourceId: 'inv-1' },
      exchangeRate: null,
      dimensions: { customerId: 'c1' },
      metadata: {},
    };
    const source = {
      total: '1180.00',
      taxAmount: '180.00',
      invoiceNumber: 'INV-1',
      clientId: 'c1',
    };

    const draft = await template.buildDraft({
      context: { tenantId: 't1' },
      command,
      source,
      resolvePurpose,
    });

    const defLine = draft.lines.find((l) => l.accountId === 'def');
    const vatLine = draft.lines.find((l) => l.accountId === 'vat');
    expect(defLine.credit).toBe('1180.00');
    expect(vatLine).toBeUndefined();
    expect(resolvePurpose).not.toHaveBeenCalledWith('VAT_OUTPUT');
  });
});
```

If `createJournalLineDraft` / draft shape differs, assert using the same field names the revenue-recognition template tests use (`debit`/`credit` decimals). Adjust imports to match existing `invoiceRevenueRecognitionAdapter.test.js` draft inspection patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/invoiceIssueDeferredTaxParking.test.js -v`  
Expected: FAIL (deferred still net-only and/or VAT line still present / VAT still required).

- [ ] **Step 3: Implement template change**

In `buildCustomerInvoiceDraft` (`pilotTemplates.js`):

1. Credit deferred with `total.decimal` (not `net`).
2. Remove the `if (tax.minor > 0) { ... VAT_OUTPUT ... }` block entirely.
3. Update registration:
   - `requiredPurposes: ['ACCOUNTS_RECEIVABLE', 'DEFERRED_REVENUE']`
   - Description: `Dr Accounts Receivable / Cr Deferred Revenue (includes tax until Paid).`
4. Bump `templateVersion` to `2`.

Keep `tax` / `net` locals only if still used; otherwise delete unused vars.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/invoiceIssueDeferredTaxParking.test.js test/invoiceIssueDeferredRevenueTemplate.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/accountingV2/templates/pilotTemplates.js test/invoiceIssueDeferredTaxParking.test.js test/invoiceIssueDeferredRevenueTemplate.test.js
git commit -m "feat(accounting): park invoice tax in deferred until Paid"
```

---

### Task 2: Invoice-Tax event, template, and adapter

**Files:**
- Modify: `lib/accountingV2/domain/enums.js`
- Modify: `lib/accountingV2/engine/journalNumbering.js`
- Modify: `lib/accountingV2/engine/legacyGuard.js`
- Modify: `lib/accountingV2/engine/sourceValidation.js`
- Modify: `lib/accountingV2/templates/stageTemplates.js`
- Create: `lib/accountingV2/adapters/invoiceOutputTaxAdapter.js`
- Modify: `lib/accountingV2/adapters/index.js`
- Create: `test/invoiceOutputTaxAdapter.test.js`

**Interfaces:**
- Produces: `AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED = 'INVOICE_OUTPUT_TAX_RECOGNIZED'`
- Produces: sourceType `'Invoice-Tax'` (sourceId = **invoiceId**)
- Produces: `postInvoiceOutputTaxAccounting({ db, tenantId, userId, invoiceId, taxAmount, paymentId?, paymentDate, hasPermission?, currency? })`
- Consumes: purposes `DEFERRED_REVENUE`, `VAT_OUTPUT`

- [ ] **Step 1: Write the failing adapter/registry test**

Create `test/invoiceOutputTaxAdapter.test.js` (mirror `test/invoiceRevenueRecognitionAdapter.test.js` structure):

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingEventType, AccountingSourceModule } from '../lib/accountingV2/domain/enums.js';
import { LEGACY_SOURCE_SCOPE } from '../lib/accountingV2/engine/legacyGuard.js';
import { journalNumberPrefix } from '../lib/accountingV2/engine/journalNumbering.js';
import { getActiveTemplate } from '../lib/accountingV2/templates/index.js';

const submitViaCutover = vi.fn(async ({ buildEngineInput }) => ({
  input: await buildEngineInput(),
}));

vi.mock('../lib/accountingV2/adapters/baseAdapter.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitViaCutover: (...args) => submitViaCutover(...args),
  };
});

describe('invoice output tax adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers Invoice-Tax scope and builds engine input keyed by invoice id', async () => {
    expect(LEGACY_SOURCE_SCOPE['Invoice-Tax']).toEqual({
      moduleKey: AccountingSourceModule.SALES,
      eventType: AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED,
    });
    expect(journalNumberPrefix(AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED)).toBe('ITAX');
    const template = getActiveTemplate(AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED);
    expect(template.supportedSourceTypes).toContain('Invoice-Tax');
    expect(template.requiredPurposes).toEqual(['DEFERRED_REVENUE', 'VAT_OUTPUT']);

    const { postInvoiceOutputTaxAccounting } = await import(
      '../lib/accountingV2/adapters/invoiceOutputTaxAdapter.js'
    );
    const db = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 'tenant-1',
          clientId: 'c1',
          invoiceNumber: 'INV-1',
          branchId: 'b1',
          taxAmount: 180,
        }),
      },
    };
    const result = await postInvoiceOutputTaxAccounting({
      db,
      tenantId: 'tenant-1',
      userId: 'u1',
      invoiceId: 'inv-1',
      taxAmount: 180,
      paymentId: 'pay-final',
      paymentDate: new Date('2026-08-22'),
    });
    expect(result.input.sourceReference).toMatchObject({
      sourceType: 'Invoice-Tax',
      sourceId: 'inv-1',
      eventType: AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED,
    });
    expect(result.input.totalAmount).toBe('180.00');
    expect(result.input.taxAmount).toBe('180.00');
    expect(result.input.metadata.paymentId).toBe('pay-final');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/invoiceOutputTaxAdapter.test.js -v`  
Expected: FAIL (missing enum / template / adapter).

- [ ] **Step 3: Implement event + template + adapter**

1. Add to `AccountingEventType` in `enums.js`:
   `INVOICE_OUTPUT_TAX_RECOGNIZED: 'INVOICE_OUTPUT_TAX_RECOGNIZED'`
2. `journalNumbering.js`: `[AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED]: 'ITAX'`
3. `legacyGuard.js`:
   ```js
   'Invoice-Tax': {
     moduleKey: AccountingSourceModule.SALES,
     eventType: AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED,
   },
   ```
4. In `stageTemplates.js`, add builder (place after invoice revenue recognition block):

```js
async function buildInvoiceOutputTaxDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(
    String(command.metadata?.taxAmount ?? source.taxAmount ?? command.totalAmount ?? '0'),
    currency
  );
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([
      { path: 'taxAmount', message: 'invoice output tax must be positive' },
    ]);
  }
  const deferred = await resolvePurpose('DEFERRED_REVENUE');
  const vat = await resolvePurpose('VAT_OUTPUT');
  const customerId = command.dimensions.customerId ?? source.clientId;
  const label = source.invoiceNumber || source.id;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: deferred.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: `Release deferred tax${label ? ` — ${label}` : ''}`,
        dimensions: { customerId },
      }),
      createJournalLineDraft({
        accountId: vat.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: `VAT output on full payment${label ? ` — ${label}` : ''}`,
        dimensions: { customerId },
      }),
    ],
    templateId: 'INVOICE_OUTPUT_TAX',
    description: `Invoice output tax${label ? ` — ${label}` : ''}`,
  });
}

registerTemplate({
  templateId: 'INVOICE_OUTPUT_TAX',
  templateVersion: 1,
  eventType: AccountingEventType.INVOICE_OUTPUT_TAX_RECOGNIZED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Invoice-Tax'],
  requiredPurposes: ['DEFERRED_REVENUE', 'VAT_OUTPUT'],
  requiredSourceFields: [],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'System-generated when invoice becomes Paid; no separate approval.',
  reversalBehaviour: 'Reverse with payment reversal / invoice void workflows; never edit in place.',
  description: 'Dr Deferred Revenue, Cr VAT Output for full invoice tax when Paid.',
  buildDraft: buildInvoiceOutputTaxDraft,
});
```

Use the same `draftBase` / imports already used by `buildInvoiceRevenueRecognitionDraft` in that file.

5. Create `invoiceOutputTaxAdapter.js` modeled on `invoiceRevenueRecognitionAdapter.js`:
   - Load invoice by `invoiceId`
   - `submitViaCutover` with `moduleKey: SALES`, event `INVOICE_OUTPUT_TAX_RECOGNIZED`
   - `sourceType: 'Invoice-Tax'`, `sourceId: invoiceId`
   - `totalAmount` / `taxAmount` = `amountString(taxAmount)`
   - `metadata: { taxAmount, paymentId: paymentId ?? null }`

6. Export from `adapters/index.js`.

7. Register a thin source validator in `sourceValidation.js` that loads the invoice and ensures `sourceId` matches invoice id (copy pattern from revenue recognition validator, keyed by invoice not payment).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/invoiceOutputTaxAdapter.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/accountingV2/domain/enums.js lib/accountingV2/engine/journalNumbering.js lib/accountingV2/engine/legacyGuard.js lib/accountingV2/engine/sourceValidation.js lib/accountingV2/templates/stageTemplates.js lib/accountingV2/adapters/invoiceOutputTaxAdapter.js lib/accountingV2/adapters/index.js test/invoiceOutputTaxAdapter.test.js
git commit -m "feat(accounting): add Invoice-Tax adapter and template"
```

---

### Task 3: `ensureInvoiceOutputTaxOnPaid` gate + idempotency

**Files:**
- Create: `lib/ensureInvoiceOutputTaxOnPaid.js`
- Create: `test/ensureInvoiceOutputTaxOnPaid.test.js`

**Interfaces:**
- Consumes: `postInvoiceOutputTaxAccounting` from adapters
- Produces:
  ```js
  ensureInvoiceOutputTaxOnPaid({
    db, tenantId, userId, invoiceId, paymentId, paymentDate, hasPermission?
  }) =>
    | { skipped: 'not_paid' | 'zero_tax' | 'already_posted' | 'legacy_issue_vat' }
    | { ...postingResult }
  ```

**Legacy detection:** Invoice journal (`sourceType: 'Invoice'`, `sourceId: invoiceId`, posted) has a credit line on an account mapped/purposed as VAT_OUTPUT **or** account code matching tenant VAT payable leaf used by issue historically. Prefer: credit line whose `accountId` equals current `VAT_OUTPUT` purpose resolution; if purpose resolve fails, treat any prior `Invoice-Tax` only. Simpler acceptable rule for v1:

1. If any posted `JournalEntry` with `sourceType: 'Invoice-Tax'` and `sourceId: invoiceId` → `already_posted`
2. Else if posted `Invoice` journal lines include a credit to the resolved `VAT_OUTPUT` account id → `legacy_issue_vat`
3. Else if invoice status is not `Paid` (and not case-insensitive paid) → `not_paid`
4. Else if `taxAmount <= 0` → `zero_tax`
5. Else post

- [ ] **Step 1: Write failing unit tests**

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postInvoiceOutputTaxAccounting = vi.fn();

vi.mock('../lib/accountingV2/adapters/index.js', () => ({
  postInvoiceOutputTaxAccounting: (...args) => postInvoiceOutputTaxAccounting(...args),
}));
vi.mock('../lib/accountingV2/adapters', () => ({
  postInvoiceOutputTaxAccounting: (...args) => postInvoiceOutputTaxAccounting(...args),
}));

describe('ensureInvoiceOutputTaxOnPaid', () => {
  let db;

  beforeEach(() => {
    vi.clearAllMocks();
    postInvoiceOutputTaxAccounting.mockResolvedValue({ ok: true });
    db = {
      invoice: { findFirst: vi.fn() },
      journalEntry: { findFirst: vi.fn(), findMany: vi.fn() },
      coaV2AccountMapping: { findFirst: vi.fn() },
    };
  });

  it('skips when invoice is not Paid', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'Partial',
      taxAmount: 180,
    });
    const { ensureInvoiceOutputTaxOnPaid } = await import('../lib/ensureInvoiceOutputTaxOnPaid.js');
    const result = await ensureInvoiceOutputTaxOnPaid({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
    });
    expect(result).toEqual({ skipped: 'not_paid' });
    expect(postInvoiceOutputTaxAccounting).not.toHaveBeenCalled();
  });

  it('skips zero tax', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'Paid', taxAmount: 0 });
    const { ensureInvoiceOutputTaxOnPaid } = await import('../lib/ensureInvoiceOutputTaxOnPaid.js');
    const result = await ensureInvoiceOutputTaxOnPaid({
      db, tenantId: 't1', userId: 'u1', invoiceId: 'inv-1', paymentId: 'pay-1',
    });
    expect(result).toEqual({ skipped: 'zero_tax' });
  });

  it('skips when Invoice-Tax already posted', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'Paid', taxAmount: 180 });
    db.journalEntry.findFirst.mockResolvedValueOnce({ id: 'je-tax' });
    const { ensureInvoiceOutputTaxOnPaid } = await import('../lib/ensureInvoiceOutputTaxOnPaid.js');
    const result = await ensureInvoiceOutputTaxOnPaid({
      db, tenantId: 't1', userId: 'u1', invoiceId: 'inv-1', paymentId: 'pay-1',
    });
    expect(result).toEqual({ skipped: 'already_posted' });
  });

  it('skips when legacy issue journal already credited VAT_OUTPUT', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'Paid', taxAmount: 180 });
    db.journalEntry.findFirst
      .mockResolvedValueOnce(null) // no Invoice-Tax
      .mockResolvedValueOnce({
        id: 'je-issue',
        lines: [{ accountId: 'vat-acct', creditAmount: 180 }],
      });
    db.coaV2AccountMapping.findFirst.mockResolvedValue({ accountId: 'vat-acct' });
    const { ensureInvoiceOutputTaxOnPaid } = await import('../lib/ensureInvoiceOutputTaxOnPaid.js');
    const result = await ensureInvoiceOutputTaxOnPaid({
      db, tenantId: 't1', userId: 'u1', invoiceId: 'inv-1', paymentId: 'pay-1',
    });
    expect(result).toEqual({ skipped: 'legacy_issue_vat' });
    expect(postInvoiceOutputTaxAccounting).not.toHaveBeenCalled();
  });

  it('posts full tax when Paid and not previously taxed', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'Paid',
      taxAmount: 180,
      clientId: 'c1',
      invoiceNumber: 'INV-1',
      branchId: 'b1',
    });
    db.journalEntry.findFirst.mockResolvedValue(null);
    db.coaV2AccountMapping.findFirst.mockResolvedValue({ accountId: 'vat-acct' });
    const { ensureInvoiceOutputTaxOnPaid } = await import('../lib/ensureInvoiceOutputTaxOnPaid.js');
    await ensureInvoiceOutputTaxOnPaid({
      db, tenantId: 't1', userId: 'u1', invoiceId: 'inv-1', paymentId: 'pay-2',
      paymentDate: new Date('2026-08-22'),
    });
    expect(postInvoiceOutputTaxAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
        taxAmount: 180,
        paymentId: 'pay-2',
      })
    );
  });
});
```

Match posted-status constants used by `ensureInvoicePaymentRevenueRecognition.js` (`POSTED_STATUSES`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/ensureInvoiceOutputTaxOnPaid.test.js -v`  
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/ensureInvoiceOutputTaxOnPaid.js`**

Follow patterns in `lib/ensureInvoicePaymentRevenueRecognition.js` for journal lookups and money parsing. Resolve VAT account via `coaV2AccountMapping` purpose `VAT_OUTPUT` for the tenant (same approach used elsewhere in revenue recognition for deferred/sales). Call `postInvoiceOutputTaxAccounting` with invoice `taxAmount`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/ensureInvoiceOutputTaxOnPaid.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ensureInvoiceOutputTaxOnPaid.js test/ensureInvoiceOutputTaxOnPaid.test.js
git commit -m "feat(accounting): gate full invoice tax until Paid"
```

---

### Task 4: Wire Paid tax into payment routes (atomic with payment)

**Files:**
- Modify: `app/api/invoices/partial-payment/route.js`
- Modify: `app/api/payments/route.js`
- Create: `test/invoicePaymentDeferredTaxWiring.test.js`

**Interfaces:**
- Consumes: `ensureInvoiceOutputTaxOnPaid`
- Call order inside the payment transaction, after revenue recognition:
  1. `postCustomerPaymentAccounting`
  2. `ensureInvoicePaymentRevenueRecognition`
  3. `ensureInvoiceOutputTaxOnPaid` (always call; helper no-ops unless Paid)

If tax ensure throws, the surrounding transaction must abort (fail closed — no Paid without tax when tax is required).

- [ ] **Step 1: Write failing wiring tests**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('partial-payment wires deferred tax on Paid', () => {
  const source = readFileSync(
    join(process.cwd(), 'app/api/invoices/partial-payment/route.js'),
    'utf8'
  );

  it('calls ensureInvoiceOutputTaxOnPaid after revenue recognition', () => {
    expect(source).toContain('ensureInvoiceOutputTaxOnPaid');
    const rev = source.indexOf('ensureInvoicePaymentRevenueRecognition');
    const tax = source.indexOf('ensureInvoiceOutputTaxOnPaid');
    expect(rev).toBeGreaterThanOrEqual(0);
    expect(tax).toBeGreaterThan(rev);
  });
});

describe('payments route wires deferred tax on Paid', () => {
  const source = readFileSync(join(process.cwd(), 'app/api/payments/route.js'), 'utf8');

  it('calls ensureInvoiceOutputTaxOnPaid after revenue recognition for invoices', () => {
    expect(source).toContain('ensureInvoiceOutputTaxOnPaid');
    const blockStart = source.indexOf("if (type === 'invoice' && invoice)");
    const block = source.slice(blockStart, blockStart + 1200);
    const rev = block.indexOf('ensureInvoicePaymentRevenueRecognition');
    const tax = block.indexOf('ensureInvoiceOutputTaxOnPaid');
    expect(rev).toBeGreaterThanOrEqual(0);
    expect(tax).toBeGreaterThan(rev);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/invoicePaymentDeferredTaxWiring.test.js -v`  
Expected: FAIL.

- [ ] **Step 3: Wire both routes**

`partial-payment/route.js` — after `ensureInvoicePaymentRevenueRecognition(...)`:

```js
await ensureInvoiceOutputTaxOnPaid({
  db: tx,
  tenantId: user.tenantId,
  userId: user.id,
  invoiceId,
  paymentId: payment.id,
  paymentDate: paymentDateObj,
});
```

`payments/route.js` — same inside the invoice payment block after recognition (use that route’s `db`/`tx`, ids, and date variables).

Import from `@/lib/ensureInvoiceOutputTaxOnPaid`.

Also check for any other invoice mark-paid path that posts payments (e.g. dedicated mark-paid). If one exists and updates status to Paid without going through these routes, wire it the same way. If none, note in commit message.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/invoicePaymentDeferredTaxWiring.test.js test/invoicePartialPaymentSalesAccounting.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/invoices/partial-payment/route.js app/api/payments/route.js test/invoicePaymentDeferredTaxWiring.test.js
git commit -m "feat(payments): post full invoice tax when invoice becomes Paid"
```

---

### Task 5: Reverse Invoice-Tax when undoing a Paid payment

**Files:**
- Modify: `lib/transactionReversalService.js` (payment reversal path that currently reverses `Payment` + `Invoice-Revenue`)
- Create or modify: `test/paymentReversalSourceTypes.test.js` (extend if present)

**Interfaces:**
- After reversing payment journals, if invoice has posted `Invoice-Tax` and post-reversal invoice status is not Paid, reverse journals with `sourceTypes: ['Invoice-Tax']`, `sourceIds: [invoiceId]`.

- [ ] **Step 1: Write / extend failing test**

Open `test/paymentReversalSourceTypes.test.js`. Add assertion that the payment-reversal implementation references `Invoice-Tax` (source-string scan of `transactionReversalService.js` near the payment reversal `sourceTypes: ['Payment', 'Invoice-Revenue']` block), **or** unit-test a small extracted helper if you introduce one:

```js
// Prefer behavioral source assertion if the file already uses readFileSync:
expect(paymentReversalSlice).toContain('Invoice-Tax');
```

If extracting:

```js
export function invoiceTaxSourceIdsToReverse({ invoiceId, invoiceStatusAfterReversal, hasPostedInvoiceTax }) {
  if (!hasPostedInvoiceTax) return [];
  if (String(invoiceStatusAfterReversal).toLowerCase() === 'paid') return [];
  return [invoiceId];
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/paymentReversalSourceTypes.test.js -v`  
Expected: FAIL.

- [ ] **Step 3: Implement reversal**

In the customer payment reversal flow (~`sourceTypes: ['Payment', 'Invoice-Revenue']`):

1. Determine `invoiceId` from `originalPayment`.
2. After payment/revenue reverse (or in the same multi-call), if a posted `Invoice-Tax` exists for that invoice **and** the invoice will not remain `Paid` after this reversal, call `reverseSourceJournals` with `sourceTypes: ['Invoice-Tax']`, `sourceIds: [invoiceId]`.
3. Keep fail-closed behavior consistent with existing payment reversal (if tax reverse required and fails, abort).

Do **not** reverse Invoice-Tax when reversing a non-final partial (tax never posted).

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/paymentReversalSourceTypes.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/transactionReversalService.js test/paymentReversalSourceTypes.test.js
git commit -m "fix(accounting): reverse Invoice-Tax when undoing Paid payment"
```

---

### Task 6: Dashboard outstanding AR uses remaining balances

**Files:**
- Modify: `app/api/dashboard/metrics/route.js` (the `outstandingInvoicesData` aggregate that sums `total` with statuses `Pending`/`Partially Paid` only)
- Create: `test/dashboardMetricsOutstandingReceivables.test.js`

**Problem:** Early aggregate uses `_sum: { total: true }` and omits status `Partial`, so AR/count can stay wrong after payments even when `remainingBalance` is updated.

- [ ] **Step 1: Write failing source test**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dashboard metrics outstanding invoices', () => {
  const source = readFileSync(
    join(process.cwd(), 'app/api/dashboard/metrics/route.js'),
    'utf8'
  );

  it('does not treat full invoice total as outstanding AR for Pending/Partially Paid only', () => {
    // The broken pattern: aggregate _sum total with only Pending + Partially Paid
    expect(source).not.toMatch(
      /status:\s*\{\s*in:\s*\['Pending',\s*'Partially Paid'\]\s*\}[\s\S]{0,120}_sum:\s*\{\s*total:\s*true/
    );
  });

  it('includes Partial status in outstanding invoice status lists', () => {
    expect(source).toContain("'Partial'");
  });
});
```

Refine the regex if formatting differs; goal is to force removal of the misleading aggregate.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboardMetricsOutstandingReceivables.test.js -v`  
Expected: FAIL.

- [ ] **Step 3: Fix metrics**

Replace the `outstandingInvoicesData` / `previousOutstandingInvoicesData` aggregates with the same remaining-balance approach already used later in the file (`findMany` + sum `remainingBalance` / `total - totalPaid`), including statuses `Pending`, `Partial`, `Partially Paid` (and lowercase variants if used). Reuse one helper inline or extract a tiny local function to avoid drift between “current” and “previous” blocks.

Ensure response fields that depended on `_sum.total` / `_count` still receive remaining-balance totals and correct counts (`remaining > 0`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/dashboardMetricsOutstandingReceivables.test.js -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/metrics/route.js test/dashboardMetricsOutstandingReceivables.test.js
git commit -m "fix(dashboard): outstanding AR uses invoice remaining balances"
```

---

### Task 7: Verification suite + smoke checklist

**Files:** none new required (run existing tests)

- [ ] **Step 1: Run focused regression pack**

```bash
npx vitest run \
  test/invoiceIssueDeferredTaxParking.test.js \
  test/invoiceIssueDeferredRevenueTemplate.test.js \
  test/invoiceOutputTaxAdapter.test.js \
  test/ensureInvoiceOutputTaxOnPaid.test.js \
  test/invoicePaymentDeferredTaxWiring.test.js \
  test/invoicePartialPaymentSalesAccounting.test.js \
  test/ensureInvoicePaymentRevenueRecognition.test.js \
  test/paymentReversalSourceTypes.test.js \
  test/dashboardMetricsOutstandingReceivables.test.js
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke (record results in PR / notes)**

1. Create taxable invoice → confirm issue JE has **no** VAT credit; deferred credit = invoice total.
2. Partial pay → cash/AR + revenue; **no** Invoice-Tax; dashboard AR drops by payment.
3. Final pay → status Paid; **one** Invoice-Tax (Dr deferred / Cr VAT) for full tax; replay is no-op.
4. Reverse final payment → Invoice-Tax reversed; invoice not Paid.

- [ ] **Step 3: Final commit only if Step 1 required tiny fixes**

```bash
git commit -m "test(accounting): verify Wave A deferred invoice tax pack"
```

(Skip empty commit if nothing changed.)

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Approach 1 keep adapters | 2–4 |
| No tax GL until Paid; full tax once | 1, 3, 4 |
| Keep revenue behavior | 4 (no change to recognition math) |
| Dashboard AR/cash truth | 6 (+ payment status updates already in routes) |
| Zero tax skip | 3 |
| Overpayment unchanged | — (no task; YAGNI) |
| Reversal after Paid reverses tax | 5 |
| Fail closed (no Paid without tax) | 4 (same transaction) |
| Idempotent retries | 3 |
| Legacy Paid/issue VAT leave as-is | 3 (`legacy_issue_vat`) |
| Bills/period/loan out of scope | — |

**Accounting model note (implements locked tax timing):** Issue journal changes from `Cr Deferred net + Cr VAT` to `Cr Deferred total`. Paid posts `Dr Deferred / Cr VAT` for `taxAmount`. This is required for a balanced journal once VAT is removed from issue.
