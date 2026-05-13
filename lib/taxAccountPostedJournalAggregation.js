import { isPayeTaxType } from '@/lib/payeExpenseSettlement';

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
      const creditAmount = Number(line.creditAmount || 0);
      const debitAmount = Number(line.debitAmount || 0);
      const taxAmt = isLiability ? creditAmount : debitAmount;
      if (taxAmt > 0) {
        totals.totalCollected += taxAmt;
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
    totals[field] += amount;
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
      netAmount: hx.creditAmount - hx.debitAmount,
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

      const debitAmount = Number(line.debitAmount || 0);
      const creditAmount = Number(line.creditAmount || 0);

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
