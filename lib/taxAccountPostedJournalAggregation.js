import { isPayeTaxType } from '@/lib/payeExpenseSettlement';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { CIT_SOURCE_TYPE } from '@/lib/accountingV2/reporting/citProvisionService.js';
import {
  getMalawiTaxCatalogEntry,
  getMalawiTaxCatalogEntryByGlCode,
} from '@/lib/malawiTaxCatalog.js';

/** V2 journal sourceTypes that assess tax on the linked TaxType.accountId (liability credit). */
export const V2_TAX_ASSESSMENT_SOURCE_TYPES = Object.freeze([CIT_SOURCE_TYPE]);

/** True when this tax type is Corporate Income Tax (MW-CIT or versioned MW-CIT-*). */
export function isCorporateIncomeTaxType(taxType) {
  const id = String(taxType?.taxId || '').toUpperCase();
  const code = String(taxType?.taxCode || '').toUpperCase();
  const name = String(taxType?.taxName || '').toLowerCase();
  const matchesCatalogId = (value) => value === 'MW-CIT' || value.startsWith('MW-CIT-');
  return matchesCatalogId(id) || matchesCatalogId(code) || name.includes('corporate income tax');
}

function matchesCatalogTaxIdentity(taxType, catalogEntry) {
  if (!catalogEntry) return false;
  const id = String(taxType?.taxId || '').toUpperCase();
  const code = String(taxType?.taxCode || '').toUpperCase();
  const catalogId = String(catalogEntry.taxId || '').toUpperCase();
  const catalogCode = String(catalogEntry.taxCode || '').toUpperCase();
  const matches = (value, catalog) =>
    Boolean(catalog) && (value === catalog || value.startsWith(`${catalog}-`));
  return matches(id, catalogId) || matches(code, catalogCode);
}

function taxTypeStatusRank(taxType) {
  const status = String(taxType?.status || '').toLowerCase();
  if (status === 'active') return 0;
  if (status === 'inactive' || status === 'replaced') return 2;
  return 1;
}

/**
 * Whether this tax type is the canonical owner of its linked GL for account-level sweeps.
 * Prevents one CitProvision / Tax-* journal from being counted on every Active tax that
 * incorrectly shares the same accountId.
 */
export function isCanonicalOwnerOfLinkedTaxAccount(taxType, allTaxTypes = []) {
  if (!taxType?.accountId) return false;
  const accountCode = String(taxType.account?.accountCode || taxType.account?.code || '').trim();
  const catalogByGl = accountCode ? getMalawiTaxCatalogEntryByGlCode(accountCode) : null;
  if (catalogByGl) {
    if (!matchesCatalogTaxIdentity(taxType, catalogByGl)) return false;
    // Prefer the Active catalog-matching row when several versioned MW-CIT* share 2045-03.
    const siblings = (allTaxTypes || []).filter(
      (t) => t.accountId === taxType.accountId && matchesCatalogTaxIdentity(t, catalogByGl)
    );
    if (siblings.length <= 1) return true;
    const sorted = [...siblings].sort((a, b) => {
      const byStatus = taxTypeStatusRank(a) - taxTypeStatusRank(b);
      if (byStatus !== 0) return byStatus;
      return String(a.taxId || a.id).localeCompare(String(b.taxId || b.id));
    });
    return sorted[0]?.id === taxType.id;
  }

  const entry = getMalawiTaxCatalogEntry(taxType.taxId) || getMalawiTaxCatalogEntry(taxType.taxCode);
  if (entry?.glCode && accountCode && entry.glCode !== accountCode) {
    // Linked to someone else's leaf — do not claim account-level GL activity.
    return false;
  }

  const siblings = (allTaxTypes || []).filter((t) => t.accountId === taxType.accountId);
  if (siblings.length <= 1) return true;
  const sorted = [...siblings].sort((a, b) => {
    const byStatus = taxTypeStatusRank(a) - taxTypeStatusRank(b);
    if (byStatus !== 0) return byStatus;
    return String(a.taxId || a.id).localeCompare(String(b.taxId || b.id));
  });
  return sorted[0]?.id === taxType.id;
}

/**
 * Tax-Invoice postings on the tax liability/asset (matches /api/tax-accounts/balances).
 * Mutates totals and invoicesAccountedFor; optionally records history rows.
 */
export async function applyTaxInvoicePostedLines(prisma, user, taxType, dateFilter, ctx) {
  const { totals, invoicesAccountedFor, pushHistory } = ctx;
  const isLiability = taxType.account?.accountType === 'Liability';
  if (!taxType.accountId) return;

  const dateClause =
    dateFilter && Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  try {
    const taxInvoiceTxns = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'posted',
        sourceType: 'Tax-Invoice',
        ...dateClause,
        lines: {
          some: { accountId: taxType.accountId },
        },
      },
      select: {
        id: true,
        date: true,
        reference: true,
        description: true,
        sourceType: true,
        sourceId: true,
        createdBy: { select: { name: true } },
        lines: {
          where: { accountId: taxType.accountId },
          select: { debitAmount: true, creditAmount: true, description: true },
        },
      },
    });

    for (const txn of taxInvoiceTxns) {
      const line = txn.lines[0];
      if (!line) continue;
      const creditAmount = parseMoney(line.creditAmount);
      const debitAmount = parseMoney(line.debitAmount);
      const taxAmt = isLiability ? creditAmount : debitAmount;
      if (taxAmt > 0) {
        totals.totalCollected = addMoney(totals.totalCollected, taxAmt);
        if (txn.sourceId) invoicesAccountedFor.add(txn.sourceId);
        if (pushHistory) {
          pushHistory({
            id: txn.id,
            reference: txn.reference,
            date: txn.date,
            description: txn.description || line.description || 'Tax-Invoice',
            sourceType: txn.sourceType,
            sourceId: txn.sourceId,
            transactionType: 'collected',
            debitAmount: isLiability ? 0 : taxAmt,
            creditAmount: isLiability ? taxAmt : 0,
            netAmount: isLiability ? taxAmt : -taxAmt,
            createdBy: txn.createdBy?.name || 'System',
            runningBalance: 0,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Tax balance detail: Tax-Invoice transaction query failed', taxType.taxId, err?.message);
  }
}

/**
 * Full posted-journal sweep on the tax account for the period (parity with balances route).
 * Mutates totals; fills payePayrollIdsCoveredByGl and payeTaxPaymentRows for PAYE payment cap logic.
 */
export async function applyPostedJournalSweepOnAccount(
  prisma,
  user,
  taxType,
  dateFilter,
  {
    totals,
    salesAccountedFor,
    pushHistory,
    payeTaxPaymentRows,
    payePayrollIdsCoveredByGl,
  }
) {
  if (!taxType.accountId) return;

  const isPAYE = isPayeTaxType(taxType);

  const accountTypeNorm = (taxType.account?.accountType || '').toString().trim().toLowerCase();
  const isLiability = accountTypeNorm === 'liability';
  const isAsset = accountTypeNorm === 'asset';

  const bump = (field, amount, tx, line, hx) => {
    totals[field] = addMoney(totals[field], amount);
    if (!pushHistory || !hx) return;
    pushHistory({
      id: tx.id,
      reference: tx.reference,
      date: tx.date,
      description: tx.description || line?.description || tx.sourceType,
      sourceType: tx.sourceType,
      sourceId: tx.sourceId,
      transactionType: hx.type,
      debitAmount: hx.debitAmount,
      creditAmount: hx.creditAmount,
      netAmount: subtractMoney(hx.creditAmount, hx.debitAmount),
      createdBy: tx.createdBy?.name || 'System',
      runningBalance: 0,
    });
  };

  const dateClause =
    dateFilter && Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'posted',
        ...dateClause,
        lines: {
          some: { accountId: taxType.accountId },
        },
      },
      select: {
        id: true,
        date: true,
        reference: true,
        description: true,
        sourceType: true,
        sourceId: true,
        isReversal: true,
        reversedTransactionId: true,
        createdBy: { select: { name: true } },
        lines: {
          where: { accountId: taxType.accountId },
          select: { debitAmount: true, creditAmount: true, description: true },
        },
      },
    });

    const payePayrollTxnIdToPayrollId = new Map();
    if (isPAYE) {
      for (const t of transactions) {
        if (t.sourceType === 'Payroll' && t.sourceId) {
          payePayrollTxnIdToPayrollId.set(t.id, t.sourceId);
        }
      }
    }

    const taxExpenseSourceIds = [
      ...new Set(
        transactions.filter((t) => t.sourceType === 'Tax-Expense' && t.sourceId).map((t) => t.sourceId)
      ),
    ];
    let deletedExpenseTaxSourceIds = new Set();
    if (taxExpenseSourceIds.length > 0) {
      const deletedExpenses = await prisma.expense.findMany({
        where: {
          id: { in: taxExpenseSourceIds },
          tenantId: user.tenantId,
          isDeleted: true,
        },
        select: { id: true },
      });
      deletedExpenseTaxSourceIds = new Set(deletedExpenses.map((e) => e.id));
    }

    const invoiceIdsWithCompoundTaxInvoiceVoid = new Set(
      transactions
        .filter((t) => t.sourceType === 'Tax-Invoice-Void')
        .map((t) => t.sourceId)
        .filter(Boolean)
    );

    for (const tx of transactions) {
      const line = tx.lines[0];
      if (!line) continue;

      const debitAmount = parseMoney(line.debitAmount);
      const creditAmount = parseMoney(line.creditAmount);

      if (isPAYE && tx.sourceType === 'Payroll') {
        if (tx.sourceId) payePayrollIdsCoveredByGl.add(tx.sourceId);
        if (isLiability) {
          if (creditAmount > 0) {
            bump(
              'totalCollected',
              creditAmount,
              tx,
              line,
              {
                type: 'collected',
                debitAmount: 0,
                creditAmount,
              }
            );
          } else if (debitAmount > 0) {
            bump(
              'totalRefunded',
              debitAmount,
              tx,
              line,
              {
                type: 'refunded',
                debitAmount,
                creditAmount: 0,
              }
            );
          }
        }
        continue;
      }

      if (isPAYE && tx.sourceType === 'Transaction' && tx.isReversal) {
        const reversedPayrollId = payePayrollTxnIdToPayrollId.get(tx.reversedTransactionId);
        if (reversedPayrollId) payePayrollIdsCoveredByGl.add(reversedPayrollId);
        if (isLiability && debitAmount > 0) {
          bump('totalRefunded', debitAmount, tx, line, {
            type: 'refunded',
            debitAmount,
            creditAmount: 0,
          });
          continue;
        }
        if (isAsset && creditAmount > 0) {
          bump('totalRefunded', creditAmount, tx, line, {
            type: 'refunded',
            debitAmount: 0,
            creditAmount,
          });
          continue;
        }
      }

      if (tx.sourceType === 'Tax-Expense' && tx.sourceId && deletedExpenseTaxSourceIds.has(tx.sourceId)) {
        continue;
      }

      if (tx.sourceType === 'TaxPayment') {
        const paymentAmount = isLiability ? debitAmount : creditAmount;
        if (paymentAmount > 0) {
          if (isPAYE) {
            payeTaxPaymentRows.push({ date: tx.date, amount: paymentAmount, tx });
          } else {
            bump('totalPaid', paymentAmount, tx, line, {
              type: 'paid',
              debitAmount: isLiability ? paymentAmount : 0,
              creditAmount: isAsset ? paymentAmount : 0,
            });
          }
        }
      } else if (tx.sourceType === 'Tax-SupplierPayment') {
        const paidAmt = isLiability ? debitAmount : creditAmount;
        if (paidAmt > 0) {
          bump('totalPaid', paidAmt, tx, line, {
            type: 'paid',
            debitAmount: isLiability ? paidAmt : 0,
            creditAmount: isAsset ? paidAmt : 0,
          });
        }
      } else if (tx.sourceType === 'Tax-Sale') {
        if (tx.sourceId && !salesAccountedFor.has(tx.sourceId)) {
          if (isLiability && creditAmount > 0) {
            bump('totalCollected', creditAmount, tx, line, {
              type: 'collected',
              debitAmount: 0,
              creditAmount,
            });
          } else if (isAsset && debitAmount > 0) {
            bump('totalCollected', debitAmount, tx, line, {
              type: 'collected',
              debitAmount,
              creditAmount: 0,
            });
          }
        }
      } else if (
        tx.sourceType === 'Tax-SaleRefund' ||
        tx.sourceType === 'Tax-SaleVoid' ||
        tx.sourceType === 'Tax-InvoiceRefund' ||
        tx.sourceType === 'Tax-InvoiceVoid' ||
        tx.sourceType === 'Tax-Invoice-Void' ||
        tx.sourceType === 'Tax-Reversal'
      ) {
        if (
          tx.sourceType === 'Tax-InvoiceVoid' &&
          tx.sourceId &&
          invoiceIdsWithCompoundTaxInvoiceVoid.has(tx.sourceId)
        ) {
          continue;
        }
        if (isLiability && debitAmount > 0) {
          bump('totalRefunded', debitAmount, tx, line, {
            type: 'refunded',
            debitAmount,
            creditAmount: 0,
          });
        } else if (isAsset && creditAmount > 0) {
          bump('totalRefunded', creditAmount, tx, line, {
            type: 'refunded',
            debitAmount: 0,
            creditAmount,
          });
        }
      } else if (
        tx.sourceType?.startsWith('Tax-') &&
        tx.sourceType !== 'Tax-Invoice' &&
        tx.sourceType !== 'Tax-Invoice-Void' &&
        tx.sourceType !== 'Tax-InvoiceVoid' &&
        tx.sourceType !== 'Tax-InvoiceRefund' &&
        tx.sourceType !== 'Tax-SupplierPayment' &&
        tx.sourceType !== 'Tax-Reversal'
      ) {
        if (isLiability) {
          if (creditAmount > 0) {
            bump('totalCollected', creditAmount, tx, line, {
              type: 'collected',
              debitAmount: 0,
              creditAmount,
            });
          } else if (debitAmount > 0) {
            bump('totalRefunded', debitAmount, tx, line, {
              type: 'refunded',
              debitAmount,
              creditAmount: 0,
            });
          }
        } else if (isAsset) {
          if (debitAmount > 0) {
            bump('totalCollected', debitAmount, tx, line, {
              type: 'collected',
              debitAmount,
              creditAmount: 0,
            });
          } else if (creditAmount > 0) {
            bump('totalRefunded', creditAmount, tx, line, {
              type: 'refunded',
              debitAmount: 0,
              creditAmount,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Tax balance detail: posted journal sweep failed', taxType.taxId, err?.message);
  }
}

/**
 * Include Accounting V2 provision journals (e.g. CitProvision → Cr CIT payable)
 * in tax-account Collected / Refunded totals. Legacy Transaction sweeps miss these.
 *
 * Mutates `totals` ({ totalCollected, totalPaid, totalRefunded }).
 * Optional `addToBreakdown(date, field, amount)` and `pushHistory(row)`.
 */
export async function applyV2TaxProvisionJournalsOnAccount(
  prisma,
  user,
  taxType,
  dateFilter,
  { totals, pushHistory = null, addToBreakdown = null, allTaxTypes = [] } = {}
) {
  if (!taxType?.accountId || !totals) return;
  if (!prisma?.journalEntryLine?.findMany) return;
  // CitProvision belongs only to Corporate Income Tax — never every Active tax on a shared GL.
  if (!isCorporateIncomeTaxType(taxType)) return;
  if (!isCanonicalOwnerOfLinkedTaxAccount(taxType, allTaxTypes)) return;

  const accountTypeNorm = (taxType.account?.accountType || '').toString().trim().toLowerCase();
  const isAsset = accountTypeNorm === 'asset';
  const treatAsLiability =
    accountTypeNorm === 'liability' ||
    (!isAsset &&
      String(taxType.account?.accountCode || '')
        .trim()
        .startsWith('2045'));

  const dateClause =
    dateFilter && Object.keys(dateFilter).length > 0
      ? {
          OR: [
            { postingDate: dateFilter },
            { AND: [{ postingDate: null }, { entryDate: dateFilter }] },
          ],
        }
      : {};

  try {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: taxType.accountId,
        journalEntry: {
          tenantId: user.tenantId,
          architectureVersion: 'ACCOUNTING_V2',
          status: 'Posted',
          sourceType: { in: [...V2_TAX_ASSESSMENT_SOURCE_TYPES] },
          reversedByJournalId: null,
          ...dateClause,
        },
      },
      select: {
        id: true,
        debitAmount: true,
        creditAmount: true,
        description: true,
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            referenceNumber: true,
            postingDate: true,
            entryDate: true,
            description: true,
            sourceType: true,
            sourceId: true,
            entryType: true,
            reversalStatus: true,
          },
        },
      },
    });

    for (const line of lines) {
      const je = line.journalEntry;
      if (!je) continue;
      const debitAmount = parseMoney(line.debitAmount);
      const creditAmount = parseMoney(line.creditAmount);
      const date = je.postingDate || je.entryDate || new Date();
      const isReversalJournal =
        String(je.reversalStatus || '').toUpperCase() === 'REVERSAL' ||
        String(je.entryType || '').toLowerCase() === 'reversal';

      const applyAmount = (field, amount, hxType) => {
        if (!(amount > 0)) return;
        totals[field] = addMoney(totals[field], amount);
        const breakdownField =
          field === 'totalCollected' ? 'collected' : field === 'totalPaid' ? 'paid' : 'refunded';
        if (typeof addToBreakdown === 'function') addToBreakdown(date, breakdownField, amount);
        if (typeof pushHistory !== 'function') return;

        const debit =
          hxType === 'collected'
            ? treatAsLiability
              ? 0
              : amount
            : treatAsLiability
              ? amount
              : 0;
        const credit =
          hxType === 'collected'
            ? treatAsLiability
              ? amount
              : 0
            : treatAsLiability
              ? 0
              : amount;
        pushHistory({
          id: je.id,
          reference: je.journalNumber || je.referenceNumber || je.sourceId,
          date,
          description: je.description || line.description || je.sourceType,
          sourceType: je.sourceType,
          sourceId: je.sourceId,
          transactionType: hxType,
          debitAmount: debit,
          creditAmount: credit,
          netAmount: subtractMoney(credit, debit),
          createdBy: 'System',
          runningBalance: 0,
        });
      };

      if (isReversalJournal) {
        if (treatAsLiability && debitAmount > 0) applyAmount('totalRefunded', debitAmount, 'refunded');
        else if (!treatAsLiability && creditAmount > 0) {
          applyAmount('totalRefunded', creditAmount, 'refunded');
        }
        continue;
      }

      if (treatAsLiability) {
        if (creditAmount > 0) applyAmount('totalCollected', creditAmount, 'collected');
        else if (debitAmount > 0) applyAmount('totalRefunded', debitAmount, 'refunded');
      } else if (debitAmount > 0) {
        applyAmount('totalCollected', debitAmount, 'collected');
      } else if (creditAmount > 0) {
        applyAmount('totalRefunded', creditAmount, 'refunded');
      }
    }
  } catch (err) {
    console.warn('Tax balance: V2 provision journal sweep failed', taxType.taxId, err?.message);
  }
}
