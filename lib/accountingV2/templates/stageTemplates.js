/**
 * Phase 9 Stage 1–2 — ACTIVE posting templates (v2).
 *
 * DEFINITIONS already registered v1 as DEFINED. These v2 registrations add
 * buildDraft implementations and become the ACTIVE templates for the engine.
 * Remaining catalogue entries stay DEFINED until later stages.
 */

import { createJournalDraft, createJournalLineDraft } from '../domain/journalDraft.js';
import { money } from '../domain/money.js';
import { AccountingEventType } from '../domain/enums.js';
import { PostingTemplateValidationError } from '../domain/errors.js';
import { registerTemplate, TemplateStatus } from './templateRegistry.js';

function draftBase({ command, sourceReference, lines, templateId, description }) {
  return createJournalDraft({
    description: command.description ?? description,
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: sourceReference ?? command.sourceReference,
    currency: command.currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: { ...command.metadata, templateId },
  });
}

/* ── Expense ─────────────────────────────────────────────────────────────── */

async function buildExpenseDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const meta = command.metadata ?? {};
  const base = money(String(meta.glBase ?? source.amount), currency);
  const tax = money(String(meta.glTax ?? source.taxAmount ?? '0'), currency);
  if (base.minor <= 0 && tax.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'expense amount must be positive' }]);
  }
  if (!source.expenseAccountId) {
    throw new PostingTemplateValidationError([{ path: 'expenseAccountId', message: 'required' }]);
  }

  const isAp = Boolean(source.supplierId && String(source.paymentStatus || '').trim() === 'Pending');
  const creditAccount = isAp
    ? await resolvePurpose('ACCOUNTS_PAYABLE')
    : meta.creditAccountId
      ? { id: meta.creditAccountId }
      : await resolvePurpose('CASH_ON_HAND');

  const lines = [
    createJournalLineDraft({
      accountId: source.expenseAccountId,
      debit: base.decimal,
      currency,
      sequence: 1,
      description: `Expense: ${source.category || source.description || 'Expense'}`,
      dimensions: { supplierId: source.supplierId ?? undefined },
    }),
  ];
  let seq = 2;
  if (tax.minor > 0) {
    const vat = meta.taxAccountId
      ? { id: meta.taxAccountId }
      : await resolvePurpose('VAT_INPUT');
    lines.push(
      createJournalLineDraft({
        accountId: vat.id,
        debit: tax.decimal,
        currency,
        sequence: seq++,
        description: 'VAT input — expense',
        dimensions: { supplierId: source.supplierId ?? undefined },
      })
    );
  }
  const credit = money(((base.minor + tax.minor) / 100).toFixed(2), currency);
  lines.push(
    createJournalLineDraft({
      accountId: creditAccount.id,
      credit: credit.decimal,
      currency,
      sequence: seq,
      description: isAp ? 'Accounts Payable' : 'Payment for expense',
      dimensions: { supplierId: source.supplierId ?? undefined },
    })
  );

  return draftBase({
    command,
    lines,
    templateId: 'CASH_EXPENSE',
    description: `Expense ${source.id}`,
  });
}

registerTemplate({
  templateId: 'CASH_EXPENSE',
  templateVersion: 2,
  eventType: AccountingEventType.EXPENSE_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Expense'],
  requiredPurposes: ['VAT_INPUT', 'ACCOUNTS_PAYABLE', 'CASH_ON_HAND'],
  requiredSourceFields: ['amount', 'expenseAccountId'],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'branchId', 'projectId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Expense approval per module policy.',
  reversalBehaviour: 'Expense reversal event.',
  description: 'Dr Expense (+ VAT Input), Cr Cash/Bank or Accounts Payable.',
  buildDraft: buildExpenseDraft,
});

/* ── Customer payment ────────────────────────────────────────────────────── */

async function buildCustomerPaymentDraft({ db, context, command, source, resolvePurpose }) {
  const currency = command.currency;
  const gross = money(String(source.amount), currency);
  if (gross.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'payment must be positive' }]);
  }
  const meta = command.metadata ?? {};
  const whtMinor = Math.round(Number(meta.withholdingAmount || 0) * 100);
  const cashMinor = whtMinor > 0 ? Math.max(0, gross.minor - whtMinor) : gross.minor;
  const cash = money((cashMinor / 100).toFixed(2), currency);

  const cashAcct = meta.cashAccountId
    ? { id: meta.cashAccountId }
    : await resolvePurpose('CASH_ON_HAND');
  const ar = await resolvePurpose('ACCOUNTS_RECEIVABLE');
  const customerId = command.dimensions.customerId ?? source.clientId ?? source.invoice?.clientId;

  const lines = [
    createJournalLineDraft({
      accountId: cashAcct.id,
      debit: cash.decimal,
      currency,
      sequence: 1,
      description: `Customer payment ${source.reference || source.id}`,
      dimensions: { customerId },
    }),
  ];

  if (whtMinor > 0) {
    let whtAcctId = meta.withholdingAccountId;
    if (!whtAcctId) {
      const { resolveWhtReceivableAccount } = await import('../../invoicePaymentWithholding.js');
      const whtAcct = await resolveWhtReceivableAccount(db, context?.tenantId || context?.businessId);
      if (!whtAcct?.id) {
        throw new PostingTemplateValidationError([
          { path: 'withholdingAmount', message: 'WHT receivable account (2041-03) not found' },
        ]);
      }
      whtAcctId = whtAcct.id;
    }
    lines.push(
      createJournalLineDraft({
        accountId: whtAcctId,
        debit: ((whtMinor) / 100).toFixed(2),
        currency,
        sequence: 2,
        description: 'Withholding tax withheld on customer payment',
        dimensions: { customerId },
      })
    );
  }

  lines.push(
    createJournalLineDraft({
      accountId: ar.id,
      credit: gross.decimal,
      currency,
      sequence: lines.length + 1,
      description: 'Accounts Receivable settlement',
      dimensions: { customerId },
    })
  );

  return draftBase({
    command,
    lines,
    templateId: 'CUSTOMER_PAYMENT',
    description: whtMinor > 0
      ? `Customer payment with WHT ${source.id}`
      : `Customer payment ${source.id}`,
  });
}

registerTemplate({
  templateId: 'CUSTOMER_PAYMENT',
  templateVersion: 2,
  eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Payment'],
  requiredPurposes: ['ACCOUNTS_RECEIVABLE', 'CASH_ON_HAND'],
  requiredSourceFields: ['amount', 'paymentMethod'],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['bankAccountId', 'branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'No posting approval; webhook idempotency mandatory.',
  reversalBehaviour: 'Payment reversal event mirrors lines.',
  description: 'Dr Cash/Bank (+ Dr WHT receivable when withheld), Cr Accounts Receivable.',
  buildDraft: buildCustomerPaymentDraft,
});

/* ── Invoice revenue recognition ──────────────────────────────────────────── */

async function buildInvoiceRevenueRecognitionDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(
    String(command.metadata?.recognizedNet ?? source.recognizedNet ?? command.totalAmount ?? '0'),
    currency
  );
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([
      { path: 'recognizedNet', message: 'recognized revenue must be positive' },
    ]);
  }
  const deferred = await resolvePurpose('DEFERRED_REVENUE');
  const revenue = await resolvePurpose('SALES_REVENUE');
  const customerId = command.dimensions.customerId ?? source.clientId ?? source.invoice?.clientId;
  const label = source.invoiceNumber || source.invoice?.invoiceNumber || source.reference || source.id;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: deferred.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: `Deferred revenue recognized${label ? ` — ${label}` : ''}`,
        dimensions: { customerId },
      }),
      createJournalLineDraft({
        accountId: revenue.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: `Sales revenue recognized${label ? ` — ${label}` : ''}`,
        dimensions: { customerId },
      }),
    ],
    templateId: 'INVOICE_REVENUE_RECOGNITION',
    description: `Invoice revenue recognition${label ? ` — ${label}` : ''}`,
  });
}

registerTemplate({
  templateId: 'INVOICE_REVENUE_RECOGNITION',
  templateVersion: 2,
  eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Invoice-Revenue'],
  requiredPurposes: ['DEFERRED_REVENUE', 'SALES_REVENUE'],
  requiredSourceFields: [],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'System-generated from an eligible invoice payment; no separate approval.',
  reversalBehaviour: 'Reverse through the corresponding revenue-unrecognition workflow, never by editing source payment.',
  description: 'Dr Deferred Revenue, Cr Sales Revenue when invoice cash collection earns revenue.',
  buildDraft: buildInvoiceRevenueRecognitionDraft,
});

/* ── Supplier bill (expense + mixed lines) ───────────────────────────────── */

async function buildSupplierBillDraft({ db, context, command, source, resolvePurpose }) {
  const currency = command.currency;
  const total = money(String(source.totalAmount ?? source.total ?? '0'), currency);
  const tax = money(String(source.taxAmount ?? '0'), currency);
  if (total.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'totalAmount', message: 'bill total must be positive' }]);
  }
  const ap = await resolvePurpose('ACCOUNTS_PAYABLE');
  const supplierId = command.dimensions.supplierId ?? source.supplierId;
  const items = Array.isArray(source.items) ? source.items : [];
  const expenseTotalMinor = total.minor - tax.minor;
  const lines = [];
  let seq = 1;

  const { isPurchasesGrniEnabled, billShouldClearGrni } = await import('@/lib/purchases/grniPolicy.js');
  const grniEnabled = await isPurchasesGrniEnabled(db, context?.tenantId || context?.businessId);
  const clearGrni = billShouldClearGrni(source, grniEnabled);

  if (clearGrni) {
    const grni = await resolvePurpose('GRNI');
    lines.push(
      createJournalLineDraft({
        accountId: grni.id,
        debit: ((expenseTotalMinor) / 100).toFixed(2),
        currency,
        sequence: seq++,
        description: `Clear GRNI — bill ${source.billNumber}`,
        dimensions: { supplierId },
      })
    );
  } else if (items.length > 0) {
    const allocatable = items.filter((i) => i.expenseAccountId || i.inventoryAccountId || i.accountId);
    const sumLine = allocatable.reduce((s, i) => s + Math.round(Number(i.lineTotal || 0) * 100), 0);
    for (const item of allocatable) {
      const acct = item.expenseAccountId || item.inventoryAccountId || item.accountId;
      const share = sumLine > 0
        ? Math.round((Math.round(Number(item.lineTotal || 0) * 100) / sumLine) * expenseTotalMinor)
        : 0;
      if (share <= 0) continue;
      lines.push(
        createJournalLineDraft({
          accountId: acct,
          debit: (share / 100).toFixed(2),
          currency,
          sequence: seq++,
          description: item.description || `Bill ${source.billNumber}`,
          dimensions: { supplierId },
        })
      );
    }
  }

  if (lines.length === 0) {
    const fallback = source._defaultDebitAccountId;
    if (!fallback) {
      throw new PostingTemplateValidationError([
        { path: 'items', message: 'bill requires expense/inventory line accounts' },
      ]);
    }
    lines.push(
      createJournalLineDraft({
        accountId: fallback,
        debit: ((expenseTotalMinor) / 100).toFixed(2),
        currency,
        sequence: seq++,
        description: `Bill ${source.billNumber}`,
        dimensions: { supplierId },
      })
    );
  }

  if (tax.minor > 0) {
    const vat = await resolvePurpose('VAT_INPUT');
    lines.push(
      createJournalLineDraft({
        accountId: vat.id,
        debit: tax.decimal,
        currency,
        sequence: seq++,
        description: `VAT input — bill ${source.billNumber}`,
        dimensions: { supplierId },
      })
    );
  }

  lines.push(
    createJournalLineDraft({
      accountId: ap.id,
      credit: total.decimal,
      currency,
      sequence: seq,
      description: `Accounts Payable — ${source.billNumber}`,
      dimensions: { supplierId },
    })
  );

  return draftBase({
    command,
    lines,
    templateId: 'SUPPLIER_BILL',
    description: `Supplier bill ${source.billNumber}`,
  });
}

registerTemplate({
  templateId: 'SUPPLIER_BILL',
  templateVersion: 2,
  eventType: AccountingEventType.SUPPLIER_BILL_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['SupplierBill'],
  requiredPurposes: ['ACCOUNTS_PAYABLE', 'VAT_INPUT'],
  requiredSourceFields: ['totalAmount', 'supplierId'],
  requiredDimensions: ['supplierId'],
  optionalDimensions: ['branchId', 'projectId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Bill approval per procurement policy before posting.',
  reversalBehaviour: 'Supplier credit or bill reversal event.',
  description: 'Matched inventory bills (GRNI on): Dr GRNI + VAT, Cr AP. Else Dr Expense/Inventory/Asset + VAT, Cr AP.',
  buildDraft: buildSupplierBillDraft,
});

/* ── Supplier payment ────────────────────────────────────────────────────── */

async function buildSupplierPaymentDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(String(source.totalAmount ?? source.amount ?? '0'), currency);
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'payment must be positive' }]);
  }
  const ap = await resolvePurpose('ACCOUNTS_PAYABLE');
  const meta = command.metadata ?? {};
  const cash = meta.cashAccountId
    ? { id: meta.cashAccountId }
    : await resolvePurpose('PRIMARY_BANK');
  const supplierId = command.dimensions.supplierId ?? source.supplierId;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: ap.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: `Payment to supplier`,
        dimensions: { supplierId },
      }),
      createJournalLineDraft({
        accountId: cash.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: `Payment via ${source.paymentMethod || 'bank'}`,
        dimensions: { supplierId },
      }),
    ],
    templateId: 'SUPPLIER_PAYMENT',
    description: `Supplier payment ${source.paymentNumber || source.id}`,
  });
}

registerTemplate({
  templateId: 'SUPPLIER_PAYMENT',
  templateVersion: 2,
  eventType: AccountingEventType.SUPPLIER_PAYMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['SupplierPayment'],
  requiredPurposes: ['ACCOUNTS_PAYABLE', 'PRIMARY_BANK'],
  requiredSourceFields: ['totalAmount', 'supplierId'],
  requiredDimensions: ['supplierId'],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Payment approval per treasury policy.',
  reversalBehaviour: 'Payment reversal event.',
  description: 'Dr Accounts Payable, Cr Cash/Bank.',
  buildDraft: buildSupplierPaymentDraft,
});

/* ── Bank charge ─────────────────────────────────────────────────────────── */

async function buildBankChargeDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(String(source.amount), currency);
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'charge must be positive' }]);
  }
  const meta = command.metadata ?? {};
  const expense = await resolvePurpose('BANK_CHARGES');
  const bank = meta.bankAccountId
    ? { id: meta.bankAccountId }
    : await resolvePurpose('PRIMARY_BANK');

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: expense.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: source.notes || 'Bank charge',
        dimensions: { bankAccountId: source.bankAccountId ?? command.dimensions.bankAccountId },
      }),
      createJournalLineDraft({
        accountId: bank.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: 'Bank charge',
        dimensions: { bankAccountId: source.bankAccountId ?? command.dimensions.bankAccountId },
      }),
    ],
    templateId: 'BANK_CHARGE',
    description: `Bank charge ${source.id}`,
  });
}

registerTemplate({
  templateId: 'BANK_CHARGE',
  templateVersion: 2,
  eventType: AccountingEventType.BANK_CHARGE_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Payment', 'BankCharge', 'BankTransaction'],
  requiredPurposes: ['BANK_CHARGES', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount'],
  requiredDimensions: [],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'No approval; sourced from bank / payment entry.',
  reversalBehaviour: 'Bank-charge reversal event.',
  description: 'Dr Bank Charges Expense, Cr Bank.',
  buildDraft: buildBankChargeDraft,
});

/* ── Interest income ─────────────────────────────────────────────────────── */

async function buildInterestIncomeDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(String(source.amount), currency);
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'interest must be positive' }]);
  }
  const meta = command.metadata ?? {};
  const income = await resolvePurpose('OTHER_INCOME');
  const bank = meta.bankAccountId
    ? { id: meta.bankAccountId }
    : await resolvePurpose('PRIMARY_BANK');

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: bank.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: 'Interest income',
        dimensions: { bankAccountId: source.bankAccountId ?? command.dimensions.bankAccountId },
      }),
      createJournalLineDraft({
        accountId: income.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: source.notes || 'Interest income',
        dimensions: { bankAccountId: source.bankAccountId ?? command.dimensions.bankAccountId },
      }),
    ],
    templateId: 'INTEREST_INCOME',
    description: `Interest income ${source.id}`,
  });
}

registerTemplate({
  templateId: 'INTEREST_INCOME',
  templateVersion: 2,
  eventType: AccountingEventType.INTEREST_INCOME_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Payment', 'InterestIncome', 'BankTransaction'],
  requiredPurposes: ['OTHER_INCOME', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount'],
  requiredDimensions: [],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'No approval; sourced from bank / payment entry.',
  reversalBehaviour: 'Interest reversal event.',
  description: 'Dr Bank, Cr Interest / Other Income.',
  buildDraft: buildInterestIncomeDraft,
});

/* ── Stage 3A — POS cash sale ─────────────────────────────────────────────── */

async function buildCashSaleDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const meta = command.metadata ?? {};
  const total = money(String(source.totalAmount ?? source.total ?? command.totalAmount), currency);
  const tax = money(String(source.taxAmount ?? command.taxAmount ?? '0'), currency);
  if (total.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'totalAmount', message: 'sale total must be positive' }]);
  }
  const net = money(((total.minor - tax.minor) / 100).toFixed(2), currency);
  const cash = meta.cashAccountId
    ? { id: meta.cashAccountId }
    : await resolvePurpose('CASH_ON_HAND');
  const revenue = await resolvePurpose('SALES_REVENUE');
  const branchId = command.dimensions.branchId ?? source.branchId;
  const label = source.saleNumber || source.id;

  const lines = [
    createJournalLineDraft({
      accountId: cash.id,
      debit: total.decimal,
      currency,
      sequence: 1,
      description: `Payment received for sale ${label}`,
      dimensions: { branchId, bankAccountId: meta.cashAccountId },
    }),
    createJournalLineDraft({
      accountId: revenue.id,
      credit: tax.minor > 0 ? net.decimal : total.decimal,
      currency,
      sequence: 2,
      description: `Revenue from sale ${label}`,
      dimensions: { branchId },
    }),
  ];
  if (tax.minor > 0) {
    const vat = await resolvePurpose('VAT_OUTPUT');
    lines.push(
      createJournalLineDraft({
        accountId: vat.id,
        credit: tax.decimal,
        currency,
        sequence: 3,
        description: `VAT output — sale ${label}`,
        dimensions: { branchId },
      })
    );
  }

  return draftBase({
    command,
    lines,
    templateId: 'CASH_SALE',
    description: `Sale ${label} — revenue`,
  });
}

registerTemplate({
  templateId: 'CASH_SALE',
  templateVersion: 2,
  eventType: AccountingEventType.INVENTORY_SOLD,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Sale'],
  requiredPurposes: ['CASH_ON_HAND', 'SALES_REVENUE', 'VAT_OUTPUT'],
  requiredSourceFields: ['totalAmount'],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'bankAccountId', 'customerId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'No posting approval; POS controls govern the source.',
  reversalBehaviour: 'Refund/void events generate mirrored reversals; cost recognition reversed separately.',
  description: 'Dr Cash/Bank/Mobile Money, Cr Sales Revenue, Cr VAT Output. Cost posts as COST_OF_SALES_RECOGNIZED.',
  buildDraft: buildCashSaleDraft,
});

/* ── Stage 3A — Cost of sales ─────────────────────────────────────────────── */

async function buildCostOfSalesDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(
    String(source.costAmount ?? source.cogsAmount ?? command.totalAmount ?? '0'),
    currency
  );
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'costAmount', message: 'COGS must be positive' }]);
  }
  const cogs = await resolvePurpose('COST_OF_SALES');
  const inventory = await resolvePurpose('INVENTORY');
  const label = source.saleNumber || source.invoiceNumber || source.id;
  const branchId = command.dimensions.branchId ?? source.branchId;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: cogs.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: `COGS for ${label}`,
        dimensions: { branchId },
      }),
      createJournalLineDraft({
        accountId: inventory.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: `Inventory reduction for ${label}`,
        dimensions: { branchId },
      }),
    ],
    templateId: 'COST_OF_SALES',
    description: `COGS — ${label}`,
  });
}

registerTemplate({
  templateId: 'COST_OF_SALES',
  templateVersion: 2,
  eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Sale', 'Sale-COGS', 'Invoice', 'Invoice-COGS'],
  requiredPurposes: ['COST_OF_SALES', 'INVENTORY'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'inventoryLocationId'],
  prohibitedDimensions: [],
  approvalRule: 'System-generated with the sale; no separate approval.',
  reversalBehaviour: 'Reversed together with the driving sale/invoice event.',
  description: 'Dr Cost of Sales, Cr Inventory. One cost recognition per sale/invoice event.',
  buildDraft: buildCostOfSalesDraft,
});

/* ── Stage 3A — Goods receipt (inventory) ─────────────────────────────────── */

async function buildInventoryReceivedDraft({ db, context, command, source, resolvePurpose }) {
  const currency = command.currency;
  const total = money(String(source.totalAmount ?? source.total ?? command.totalAmount), currency);
  if (total.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'totalAmount', message: 'receipt total must be positive' }]);
  }
  const inventory = await resolvePurpose('INVENTORY');
  const { isPurchasesGrniEnabled, receiptCreditPurpose } = await import('@/lib/purchases/grniPolicy.js');
  const grniEnabled = await isPurchasesGrniEnabled(db, context?.tenantId || context?.businessId);
  const creditPurpose = receiptCreditPurpose(grniEnabled);
  const creditAccount = await resolvePurpose(creditPurpose);
  const supplierId = command.dimensions.supplierId ?? source.supplierId;
  const label = source.receiptNumber || source.id;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: inventory.id,
        debit: total.decimal,
        currency,
        sequence: 1,
        description: 'Inventory received',
        dimensions: { supplierId },
      }),
      createJournalLineDraft({
        accountId: creditAccount.id,
        credit: total.decimal,
        currency,
        sequence: 2,
        description: grniEnabled
          ? 'Goods received not invoiced (GRNI)'
          : 'Amount due to supplier (legacy AP-at-receipt)',
        dimensions: { supplierId },
      }),
    ],
    templateId: 'INVENTORY_PURCHASE',
    description: `Goods receipt ${label}`,
  });
}

registerTemplate({
  templateId: 'INVENTORY_PURCHASE',
  templateVersion: 2,
  eventType: AccountingEventType.INVENTORY_RECEIVED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['GoodsReceipt'],
  requiredPurposes: ['INVENTORY', 'ACCOUNTS_PAYABLE'],
  requiredSourceFields: ['totalAmount'],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'inventoryLocationId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Procurement approval per module policy.',
  reversalBehaviour: 'Goods-return event.',
  description: 'Dr Inventory, Cr GRNI when purchasesGrniV2Enabled; else legacy Cr Accounts Payable.',
  buildDraft: buildInventoryReceivedDraft,
});

/* ── Stage 3A — Stock write-off / adjustment ──────────────────────────────── */

async function buildStockAdjustmentDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(String(source.amount ?? command.totalAmount ?? '0'), currency);
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'adjustment must be positive' }]);
  }
  const meta = command.metadata ?? {};
  const desc = command.description || source.description || 'Inventory write-off';
  const rawLines = meta.lines;

  if (Array.isArray(rawLines) && rawLines.length >= 2) {
    return draftBase({
      command,
      templateId: 'STOCK_ADJUSTMENT',
      description: desc,
      lines: rawLines.map((line, i) => {
        const d = Number(line.debitAmount ?? line.debit ?? 0);
        const c = Number(line.creditAmount ?? line.credit ?? 0);
        return createJournalLineDraft({
          accountId: line.accountId,
          debit: d > 0 ? d.toFixed(2) : undefined,
          credit: c > 0 ? c.toFixed(2) : undefined,
          currency,
          sequence: line.lineNumber || i + 1,
          description: line.description || desc,
        });
      }),
    });
  }

  const loss = meta.lossAccountId
    ? { id: meta.lossAccountId }
    : await resolvePurpose('INVENTORY_LOSS');
  const inventory = await resolvePurpose('INVENTORY');

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: loss.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: desc,
      }),
      createJournalLineDraft({
        accountId: inventory.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: 'Reduce inventory — write-off',
      }),
    ],
    templateId: 'STOCK_ADJUSTMENT',
    description: desc,
  });
}

registerTemplate({
  templateId: 'STOCK_ADJUSTMENT',
  templateVersion: 2,
  eventType: AccountingEventType.STOCK_ADJUSTMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['InventoryExpiryWriteOff', 'InventoryManualStockOut', 'InventoryTransaction'],
  requiredPurposes: ['INVENTORY_LOSS', 'INVENTORY'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['inventoryLocationId', 'branchId'],
  prohibitedDimensions: [],
  approvalRule: 'Inventory adjustment approval per stock policy.',
  reversalBehaviour: 'Restock / reverse adjustment event.',
  description: 'Dr Inventory Adjustment Loss, Cr Inventory.',
  buildDraft: buildStockAdjustmentDraft,
});

/* ── Stage 3B — Customer credit note ──────────────────────────────────────── */

async function buildCreditNoteDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const total = money(String(source.amount ?? source.total ?? command.totalAmount), currency);
  const tax = money(String(source.taxAmount ?? command.taxAmount ?? '0'), currency);
  if (total.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'amount', message: 'credit note must be positive' }]);
  }
  let returns;
  try {
    returns = await resolvePurpose('SALES_RETURNS');
  } catch {
    returns = await resolvePurpose('SALES_REVENUE');
  }
  const ar = await resolvePurpose('ACCOUNTS_RECEIVABLE');
  const customerId = command.dimensions.customerId ?? source.clientId;
  const label = source.noteNumber || source.id;
  const net = money(((total.minor - tax.minor) / 100).toFixed(2), currency);

  const lines = [
    createJournalLineDraft({
      accountId: returns.id,
      debit: tax.minor > 0 ? net.decimal : total.decimal,
      currency,
      sequence: 1,
      description: `Credit note ${label} — reduce revenue`,
      dimensions: { customerId },
    }),
  ];
  let seq = 2;
  if (tax.minor > 0) {
    const vat = await resolvePurpose('VAT_OUTPUT');
    lines.push(
      createJournalLineDraft({
        accountId: vat.id,
        debit: tax.decimal,
        currency,
        sequence: seq++,
        description: `VAT output adjustment — credit note ${label}`,
        dimensions: { customerId },
      })
    );
  }
  lines.push(
    createJournalLineDraft({
      accountId: ar.id,
      credit: total.decimal,
      currency,
      sequence: seq,
      description: `Credit note ${label} — reduce AR`,
      dimensions: { customerId },
    })
  );

  return draftBase({
    command,
    lines,
    templateId: 'CUSTOMER_CREDIT_NOTE',
    description: `Credit note ${label}`,
  });
}

registerTemplate({
  templateId: 'CUSTOMER_CREDIT_NOTE',
  templateVersion: 2,
  eventType: AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['CreditNote'],
  requiredPurposes: ['SALES_RETURNS', 'VAT_OUTPUT', 'ACCOUNTS_RECEIVABLE'],
  requiredSourceFields: ['amount'],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'Credit-note approval required by module policy.',
  reversalBehaviour: 'Reversal event; tax adjustment follows configured tax rules.',
  description: 'Dr Sales Returns (+ VAT Output adj), Cr Accounts Receivable.',
  buildDraft: buildCreditNoteDraft,
});

/* ── Stage 3B — Customer invoice refund ───────────────────────────────────── */

async function buildCustomerRefundDraft({ command, source, resolvePurpose }) {
  const currency = command.currency;
  const amount = money(String(source.refundAmount ?? source.amount ?? command.totalAmount), currency);
  if (amount.minor <= 0) {
    throw new PostingTemplateValidationError([{ path: 'refundAmount', message: 'refund must be positive' }]);
  }
  const meta = command.metadata ?? {};
  const ar = await resolvePurpose('ACCOUNTS_RECEIVABLE');
  const cash = meta.cashAccountId
    ? { id: meta.cashAccountId }
    : await resolvePurpose('CASH_ON_HAND');
  const customerId = command.dimensions.customerId ?? source.clientId ?? source.invoice?.clientId;
  const label = source.invoiceNumber || source.id;

  return draftBase({
    command,
    lines: [
      createJournalLineDraft({
        accountId: ar.id,
        debit: amount.decimal,
        currency,
        sequence: 1,
        description: `AR restored for refund — ${label}`,
        dimensions: { customerId },
      }),
      createJournalLineDraft({
        accountId: cash.id,
        credit: amount.decimal,
        currency,
        sequence: 2,
        description: `Cash/Bank refund — ${label}`,
        dimensions: { customerId, bankAccountId: meta.cashAccountId },
      }),
    ],
    templateId: 'CUSTOMER_REFUND',
    description: `Customer refund ${label}`,
  });
}

registerTemplate({
  templateId: 'CUSTOMER_REFUND',
  templateVersion: 2,
  eventType: AccountingEventType.CUSTOMER_REFUND_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['InvoiceRefund'],
  requiredPurposes: ['ACCOUNTS_RECEIVABLE', 'CASH_ON_HAND'],
  requiredSourceFields: [],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['bankAccountId', 'branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'Refund approval per receivables policy.',
  reversalBehaviour: 'Refund reversal event.',
  description: 'Dr Accounts Receivable, Cr Cash/Bank (restore AR reduced by payment).',
  buildDraft: buildCustomerRefundDraft,
});
