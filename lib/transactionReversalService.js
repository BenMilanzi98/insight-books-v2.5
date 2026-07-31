/**
 * Transaction Reversal Service
 *
 * Fresh-books Phase 2: financial reversals go through V2 reverseJournal
 * (JournalEntry architectureVersion ACCOUNTING_V2). No prisma.transaction.create
 * for GL and no Account.balance mutations.
 *
 * Operational reversal documents (negative invoice/sale/expense/payment rows)
 * may still be created for audit/workflow. GL is fail-closed: missing V2
 * journals throw NO_V2_JOURNAL_TO_REVERSE.
 */

import prisma from './prisma';
import { reverseSourceJournals } from './accountingV2/application/reverseSourceJournals.js';

/** Transaction rows sometimes store status with inconsistent casing (code paths / legacy data). */
const POSTED_GL_STATUSES = ['posted', 'Posted', 'POSTED'];

function isPayrollSourceType(sourceType) {
  return String(sourceType || '').toLowerCase() === 'payroll';
}

/**
 * GL rows for payroll sometimes use `Payroll` vs `payroll` for sourceType (legacy / imports).
 */
function buildPostedPayrollJournalWhere(tenantId, payrollId) {
  return {
    tenantId,
    OR: [
      { sourceType: 'Payroll' },
      { sourceType: 'payroll' },
      { sourceType: 'PAYROLL' },
    ],
    sourceId: payrollId,
    status: { in: POSTED_GL_STATUSES },
    isReversal: false,
  };
}

/**
 * @returns {Promise<{ kind: 'none' } | { kind: 'multiple', count: number } | { kind: 'empty_journal' } | { kind: 'posted' }>}
 */
async function resolvePostedPayrollJournalState(tenantId, payrollId) {
  const journals = await prisma.transaction.findMany({
    where: buildPostedPayrollJournalWhere(tenantId, payrollId),
    select: { id: true },
    orderBy: { date: 'asc' },
  });
  if (journals.length === 0) return { kind: 'none' };
  if (journals.length > 1) return { kind: 'multiple', count: journals.length };
  const lineCount = await prisma.transactionLine.count({
    where: { transactionId: journals[0].id },
  });
  if (lineCount === 0) return { kind: 'empty_journal' };
  return { kind: 'posted' };
}

/**
 * Validates if a transaction is eligible for reversal
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result with isValid and error message
 */
async function validateReversalEligibility({ transactionId, transactionType, tenantId }) {
  const errors = [];
  
  // Get the transaction based on type
  let transaction;
  let existingReversal;
  
  switch (transactionType) {
    case 'Invoice':
      transaction = await prisma.invoice.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (transaction) {
        existingReversal = await prisma.invoice.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    case 'Expense':
      transaction = await prisma.expense.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (transaction) {
        existingReversal = await prisma.expense.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    case 'Payment':
      transaction = await prisma.payment.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        },
        include: {
          allocations: true
        }
      });
      if (transaction) {
        existingReversal = await prisma.payment.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    case 'Sale':
      transaction = await prisma.sale.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (transaction) {
        existingReversal = await prisma.sale.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    case 'SupplierPayment':
      transaction = await prisma.supplierPayment.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (transaction) {
        existingReversal = await prisma.supplierPayment.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    case 'Transaction':
      transaction = await prisma.transaction.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (transaction) {
        existingReversal = await prisma.transaction.findFirst({
          where: { 
            reversedTransactionId: transactionId, 
            isReversal: true,
            tenantId: tenantId
          }
        });
      }
      break;
      
    default:
      return { isValid: false, error: `Unknown transaction type: ${transactionType}` };
  }
  
  // Check if transaction exists
  if (!transaction) {
    return { isValid: false, error: 'Transaction not found' };
  }
  
  // Verify tenant ownership
  if (transaction.tenantId !== tenantId) {
    return { isValid: false, error: 'Transaction does not belong to this tenant' };
  }
  
  // Check if already reversed
  if (existingReversal) {
    return { isValid: false, error: 'Transaction has already been reversed' };
  }
  
  // Check if transaction is itself a reversal
  if (transaction.isReversal) {
    return { isValid: false, error: 'Cannot reverse a transaction that is itself a reversal' };
  }
  
  // Type-specific validations
  if (transactionType === 'Invoice') {
    // Check invoice status
    if (transaction.status === 'draft') {
      return { isValid: false, error: 'Draft invoices cannot be reversed - delete or cancel instead' };
    }
    if (transaction.status === 'voided') {
      return { isValid: false, error: 'Voided invoices cannot be reversed' };
    }
    // Check if fully paid (reversing a paid invoice requires refund handling)
    const totalPaid = parseFloat(transaction.totalPaid || 0);
    const total = parseFloat(transaction.total || 0);
    if (totalPaid > 0 && totalPaid >= total) {
      return { isValid: false, error: 'Fully paid invoices require refund processing before reversal' };
    }
  }
  
  if (transactionType === 'Expense') {
    // Check expense status
    if (transaction.status === 'draft') {
      return { isValid: false, error: 'Draft expenses cannot be reversed' };
    }
    if (transaction.isDeleted) {
      return { isValid: false, error: 'Deleted expenses cannot be reversed' };
    }
  }
  
  if (transactionType === 'Sale') {
    // Check sale status
    if (transaction.status === 'draft') {
      return { isValid: false, error: 'Draft sales cannot be reversed' };
    }
  }
  
  if (transactionType === 'Payment') {
    // Check payment status
    if (transaction.status !== 'Completed') {
      return { isValid: false, error: 'Only completed payments can be reversed' };
    }
  }
  
  if (transactionType === 'Transaction') {
    const st = String(transaction.status || '').toLowerCase();
    if (st !== 'posted') {
      return { isValid: false, error: 'Only posted transactions can be reversed' };
    }
  }
  
  return {
    isValid: true,
    transaction,
    warnings: []
  };
}

/**
 * Validates the reversal reason
 * @param {string} reason - Reversal reason
 * @returns {Object} Validation result
 */
function validateReversalReason(reason) {
  if (!reason || reason.trim().length === 0) {
    return { isValid: false, error: 'Reversal reason is required' };
  }
  
  const trimmedReason = reason.trim();
  
  if (trimmedReason.length < 10) {
    return { isValid: false, error: 'Reversal reason must be at least 10 characters' };
  }
  
  if (trimmedReason.length > 1000) {
    return { isValid: false, error: 'Reversal reason cannot exceed 1000 characters' };
  }
  
  return { isValid: true, reason: trimmedReason };
}

/**
 * Checks if the accounting period is locked
 * @param {string} tenantId - Tenant ID
 * @param {Date} transactionDate - Transaction date to check
 * @returns {Object} Period lock status
 */
async function checkAccountingPeriodLock(tenantId, transactionDate) {
  // Check for any locked periods that would include this transaction date
  const lockedPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId,
      status: 'closed',
      startDate: { lte: transactionDate },
      endDate: { gte: transactionDate }
    }
  });
  
  if (lockedPeriod) {
    return {
      isLocked: true,
      periodName: lockedPeriod.name,
      error: `Cannot reverse transactions in closed accounting period: ${lockedPeriod.name}`
    };
  }
  
  return { isLocked: false };
}

/**
 * Builds a breakdown of payroll journal lines for reversal reporting (salary expense, PAYE/tax, NPS, deductions, etc.)
 * @param {Array} lines - TransactionLine[] with account included
 * @returns {Object} - { salaryExpense, payeTax, nps, otherDeductions, advanceReceivable, cash, byCategory }
 */
function buildPayrollReversalBreakdown(lines) {
  const byCategory = {
    salaryExpense: 0,
    payeTax: 0,
    nps: 0,
    otherDeductions: 0,
    advanceReceivable: 0,
    cash: 0
  };
  for (const line of lines || []) {
    const desc = (line.description || '').toLowerCase();
    const accountName = (line.account?.accountName || '').toLowerCase();
    const debit = parseFloat(line.debitAmount ?? 0) || 0;
    const credit = parseFloat(line.creditAmount ?? 0) || 0;
    const amount = Math.max(debit, credit);
    if (desc.includes('payroll expense') || (accountName && (accountName.includes('salary') && accountName.includes('expense')))) {
      byCategory.salaryExpense += amount;
    } else if (desc.includes('paye') || accountName.includes('paye')) {
      byCategory.payeTax += amount;
    } else if (desc.includes('nps') || accountName.includes('nps') || accountName.includes('pension')) {
      byCategory.nps += amount;
    } else if (desc.includes('advance') && (desc.includes('deduction') || desc.includes('receivable'))) {
      byCategory.advanceReceivable += amount;
    } else if (desc.includes('other payroll deduction') || desc.includes('deductions payable')) {
      byCategory.otherDeductions += amount;
    } else if (desc.includes('net pay') || desc.includes('overtime') || desc.includes('cash')) {
      byCategory.cash += amount;
    } else if (credit > 0 && (accountName.includes('paye') || accountName.includes('tax') || accountName.includes('liability'))) {
      byCategory.payeTax += amount;
    } else if (credit > 0 && (accountName.includes('pension') || accountName.includes('nps'))) {
      byCategory.nps += amount;
    } else if (credit > 0 && accountName.includes('deduction')) {
      byCategory.otherDeductions += amount;
    } else if (debit > 0 && accountName.includes('expense')) {
      byCategory.salaryExpense += amount;
    } else if (credit > 0) {
      byCategory.cash += amount;
    }
  }
  return {
    ...byCategory,
    byCategory,
    deductionsAndTaxReversed: {
      payeTax: byCategory.payeTax,
      nps: byCategory.nps,
      otherDeductions: byCategory.otherDeductions,
      advanceReceivable: byCategory.advanceReceivable
    }
  };
}

/**
 * Reverses all payroll-related side effects when a payroll journal transaction is reversed:
 * - Salary advance deductions (restore advance outstanding amounts)
 * - Gratuity accrual (subtract accrued amount from gratuity account)
 * - Marks payroll expense and payment records as reversed
 * @param {Object} tx - Prisma transaction client
 * @param {Object} params - { payrollId, reversalTransactionId, userId, tenantId, reason }
 * @returns {Object} - Summary of what was reversed (for audit and API response)
 */
async function reversePayrollSideEffects(tx, { payrollId, reversalTransactionId, userId, tenantId, reason }) {
  // Payroll has no @@unique([id, tenantId]) — only `id` is unique. Use findFirst for tenant-scoped lookup.
  const payroll = await tx.payroll.findFirst({
    where: { id: payrollId, tenantId },
    include: { employee: { include: { gratuityAccount: true } } }
  });
  if (!payroll) {
    console.warn(`reversePayrollSideEffects: Payroll ${payrollId} not found, skipping side effects`);
    return null;
  }
  if (payroll.status === 'Reversed') {
    return null; // Already reversed, avoid double-reverse
  }

  const now = new Date();
  const summary = {
    advanceDeductionsReversed: 0,
    advanceDeductionsAmount: 0,
    gratuityReversed: 0,
    expensesReversed: 0,
    paymentsReversed: 0
  };

  // Mark payroll entry as Reversed
  await tx.payroll.update({
    where: { id: payrollId },
    data: { status: 'Reversed' }
  });

  // 1. Reverse advance deductions: restore SalaryAdvance totalDeducted and outstandingAmount
  const advanceDeductions = await tx.advanceDeduction.findMany({
    where: { payrollId }
  });
  for (const ad of advanceDeductions) {
    const advance = await tx.salaryAdvance.findUnique({
      where: { id: ad.salaryAdvanceId }
    });
    if (advance) {
      const newTotalDeducted = Math.max(0, (advance.totalDeducted || 0) - ad.amount);
      const newOutstanding = Math.max(0, advance.amount - newTotalDeducted);
      const newStatus = newOutstanding <= 0 ? advance.status : 'Active';
      await tx.salaryAdvance.update({
        where: { id: advance.id },
        data: {
          totalDeducted: newTotalDeducted,
          outstandingAmount: newOutstanding,
          status: newStatus
        }
      });
      summary.advanceDeductionsReversed += 1;
      summary.advanceDeductionsAmount += ad.amount;
    }
  }

  // 2. Reverse gratuity accrual
  const gratuityAccrued = Number(payroll.gratuityAccruedAmount) || 0;
  const gratuityAccount = payroll.employee?.gratuityAccount;
  if (gratuityAccrued > 0 && gratuityAccount) {
    const newTotalAccrued = Math.max(0, (gratuityAccount.totalAccrued || 0) - gratuityAccrued);
    const newOutstanding = Math.max(0, newTotalAccrued - (gratuityAccount.totalPaid || 0));
    await tx.gratuityAccount.update({
      where: { id: gratuityAccount.id },
      data: {
        totalAccrued: newTotalAccrued,
        outstandingAmount: newOutstanding
      }
    });
    summary.gratuityReversed = gratuityAccrued;
  }

  // 3. Mark all payroll-related expenses as reversed (salary expense, PAYE/tax, NPS, deductions, net pay)
  // Prefer explicit linkage: payroll-created expenses set `originalReference = <payrollId>`.
  // Fall back to legacy heuristic matching only if no linked expenses exist (older data).
  const linkedExpenses = await tx.expense.findMany({
    where: {
      tenantId,
      originalReference: payrollId,
      isReversal: false,
      isDeleted: false,
    },
    select: { id: true }
  });

  let expenseIds = linkedExpenses.map((e) => e.id);

  if (expenseIds.length === 0) {
    // Legacy fallback (best-effort): try to match by employee + rough text markers.
    const PAYROLL_DASHBOARD_EXPENSE_PREFIX = 'payrollDashboardExpense:';
    const dashboardExpenseMarker = `${PAYROLL_DASHBOARD_EXPENSE_PREFIX}${payrollId}`;
    const periodStr = `${payroll.periodStart.toLocaleDateString()} - ${payroll.periodEnd.toLocaleDateString()}`;
    const employeeName = payroll.employee?.name || '';
    const payrollExpenseDescriptions = [
      'Net Pay -',
      'PAYE Tax -',
      'Employer NPS -',
      'Overtime -',
      'NPS -',
      'Pension -',
      'Deduction -',
      'PAYE -',
      'Salaries -'
    ];
    const legacyExpenses = await tx.expense.findMany({
      where: {
        tenantId,
        employeeId: payroll.employeeId,
        isReversal: false,
        isDeleted: false,
        OR: [
          ...payrollExpenseDescriptions.map(prefix => ({
            description: { contains: prefix, mode: 'insensitive' }
          })),
          { notes: { contains: dashboardExpenseMarker, mode: 'insensitive' } },
          ...(employeeName ? [{ description: { contains: employeeName, mode: 'insensitive' } }] : []),
          ...(periodStr ? [{ notes: { contains: periodStr, mode: 'insensitive' } }] : [])
        ]
      },
      select: { id: true }
    });
    expenseIds = legacyExpenses.map((e) => e.id);
  }
  summary.expensesReversed = expenseIds.length;
  if (expenseIds.length > 0) {
    await tx.expense.updateMany({
      where: { id: { in: expenseIds } },
      data: {
        isReversal: true,
        reversedTransactionId: reversalTransactionId,
        reversalReason: reason,
        reversedAt: now,
        reversedById: userId
      }
    });

    // 4. Mark related payments as reversed
    const paymentResult = await tx.payment.updateMany({
      where: { expenseId: { in: expenseIds } },
      data: {
        isReversal: true,
        reversedTransactionId: reversalTransactionId,
        reversalReason: reason,
        reversedAt: now,
        reversedById: userId
      }
    });
    summary.paymentsReversed = paymentResult.count ?? 0;
  }
  return summary;
}

/**
 * Creates a reversal for a journal linked to an archive Transaction row.
 * Fresh-books: reverses V2 JournalEntry by sourceType/sourceId (fail-closed).
 * @param {Object} params - Reversal parameters
 * @returns {Object} Reversal result
 */
async function createTransactionReversal({
  transactionId,
  reversalReason,
  userId,
  tenantId,
  reversalDate = new Date(),
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const eligibility = await validateReversalEligibility({
    transactionId,
    transactionType: 'Transaction',
    tenantId,
  });

  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }

  const originalTransaction = eligibility.transaction;
  const isPayrollJournal = isPayrollSourceType(originalTransaction.sourceType);
  const effectiveReversalDate =
    reversalDate instanceof Date && !Number.isNaN(reversalDate.getTime())
      ? reversalDate
      : new Date();

  const periodCheckDate = isPayrollJournal ? effectiveReversalDate : originalTransaction.date;
  const periodCheck = await checkAccountingPeriodLock(tenantId, periodCheckDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const isSaleCogsSubJournal =
    originalTransaction.sourceType === 'Sale-COGS' ||
    (originalTransaction.sourceType === 'Sale' &&
      /\bcogs\b/i.test(originalTransaction.description || ''));

  const sourceTypes = [];
  if (originalTransaction.sourceType) {
    sourceTypes.push(originalTransaction.sourceType);
    if (!isSaleCogsSubJournal) {
      if (isPayrollJournal) {
        sourceTypes.push('Tax-Payroll');
      } else if (['Invoice', 'Sale', 'Expense'].includes(originalTransaction.sourceType)) {
        sourceTypes.push(`Tax-${originalTransaction.sourceType}`);
      }
    }
  } else {
    sourceTypes.push('Transaction', 'ManualJournal', 'JournalEntry');
  }

  const sourceIdBase = originalTransaction.sourceId || originalTransaction.id;
  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes,
    sourceIds: [sourceIdBase],
    requireJournals: true,
    postingDate: effectiveReversalDate.toISOString().slice(0, 10),
  });

  const primaryReversalId =
    v2.reversed[0]?.result?.journalEntryId ||
    v2.reversed[0]?.originalJournalId ||
    null;

  let payrollReversalSummary = null;
  await prisma.$transaction(async (tx) => {
    if (isPayrollJournal && originalTransaction.sourceId) {
      const originalLines = await tx.transactionLine.findMany({
        where: { transactionId: originalTransaction.id },
        include: { account: true },
      });
      originalLines.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
      const breakdown = buildPayrollReversalBreakdown(originalLines);
      const sideEffectsSummary = await reversePayrollSideEffects(tx, {
        payrollId: originalTransaction.sourceId,
        reversalTransactionId: primaryReversalId,
        userId,
        tenantId,
        reason: reasonValidation.reason,
      });
      payrollReversalSummary = {
        payrollId: originalTransaction.sourceId,
        journalReversed: {
          salaryExpense: breakdown.salaryExpense,
          payeTax: breakdown.payeTax,
          nps: breakdown.nps,
          otherDeductions: breakdown.otherDeductions,
          advanceReceivable: breakdown.advanceReceivable,
          cash: breakdown.cash,
        },
        deductionsAndTaxReversed: breakdown.deductionsAndTaxReversed,
        sideEffects: sideEffectsSummary || {},
      };
    }

    const auditDetails = {
      originalTransactionId: originalTransaction.id,
      reversalTransactionId: primaryReversalId,
      reversalReason: reasonValidation.reason,
      originalAmount: originalTransaction.amount || 0,
      reversalAmount: -(originalTransaction.amount || 0),
      taxReversals: [],
      cogsJournalOnlyReversal: Boolean(isSaleCogsSubJournal),
      v2JournalReversals: v2.reversed.map((r) => ({
        originalJournalId: r.originalJournalId,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
      })),
      v2JournalsSkipped: v2.skippedAlreadyReversed,
    };
    if (payrollReversalSummary) {
      auditDetails.payrollReversalSummary = payrollReversalSummary;
    }

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Transaction',
        entityId: originalTransaction.id,
        userId,
        tenantId,
        details: JSON.stringify(auditDetails),
      },
    });
  });

  return {
    reversal: {
      id: primaryReversalId,
      v2: true,
      journalsReversed: v2.reversed.length,
    },
    taxReversals: [],
    payrollReversalSummary,
    v2JournalReversals: v2.reversed,
  };
}

/**
 * Creates a reversal for an invoice
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal invoice
 */
async function createInvoiceReversal({
  invoiceId,
  reversalReason,
  userId,
  tenantId
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const eligibility = await validateReversalEligibility({
    transactionId: invoiceId,
    transactionType: 'Invoice',
    tenantId
  });

  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }

  const originalInvoice = eligibility.transaction;

  const periodCheck = await checkAccountingPeriodLock(tenantId, originalInvoice.issueDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  // Fail-closed V2 reverse before operational document work.
  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes: ['Invoice', 'Invoice-COGS', 'Tax-Invoice'],
    sourceIds: [invoiceId],
    requireJournals: true,
  });

  const invoiceGlReversals = v2.reversed.map((r) => ({
    originalTransactionId: r.originalJournalId,
    reversalTransactionId: r.result?.journalEntryId || null,
    description: `${r.sourceType}:${r.sourceId}`,
  }));

  const reversalInvoiceNumber = await generateReversalReference('INV-REV', tenantId);

  const reversalInvoice = await prisma.$transaction(async (tx) => {
    const reversal = await tx.invoice.create({
      data: {
        invoiceNumber: reversalInvoiceNumber,
        clientId: originalInvoice.clientId,
        createdById: userId,
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: -originalInvoice.subtotal,
        taxAmount: -originalInvoice.taxAmount,
        total: -originalInvoice.total,
        status: 'posted',
        notes: `REVERSAL: ${originalInvoice.invoiceNumber} - ${reasonValidation.reason}`,
        tenantId,
        discount: -originalInvoice.discount,
        originalTotal: originalInvoice.total,
        remainingBalance: -originalInvoice.total,
        totalDiscountAmount: -originalInvoice.totalDiscountAmount,
        totalPaid: 0,
        branchId: originalInvoice.branchId,
        isReversal: true,
        reversedTransactionId: originalInvoice.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });

    const originalItems = await tx.invoiceItem.findMany({
      where: { invoiceId: originalInvoice.id },
      include: {
        product: {
          select: { id: true, isService: true }
        }
      }
    });

    for (const item of originalItems) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: reversal.id,
          description: `REVERSAL: ${item.description}`,
          quantity: -item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          amount: -item.amount,
          productId: item.productId,
          discountAmount: -item.discountAmount,
          discountRate: item.discountRate,
          netAmount: -item.netAmount
        }
      });

      if (item.productId && item.product && !item.product.isService) {
        const qty = Number(item.quantity) || 0;
        if (qty > 0) {
          try {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockLevel: { increment: qty } }
            });
            try {
              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  type: 'reversal_restoration',
                  quantity: Math.round(qty),
                  notes: `Reversal restoration for invoice ${originalInvoice.invoiceNumber}: ${reasonValidation.reason}`,
                  userId,
                  tenantId
                }
              });
            } catch (invTxErr) {
              console.warn('Could not create inventory transaction for invoice reversal:', invTxErr?.message);
            }
          } catch (invErr) {
            console.error(`Error restoring inventory for product ${item.productId} on invoice reversal:`, invErr);
          }
        }
      }
    }

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Invoice',
        entityId: originalInvoice.id,
        userId,
        tenantId,
        details: JSON.stringify({
          originalInvoiceId: originalInvoice.id,
          reversalInvoiceId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalInvoice.total,
          reversalAmount: -originalInvoice.total,
          originalTaxAmount: originalInvoice.taxAmount,
          reversedTaxAmount: -originalInvoice.taxAmount,
          taxReversals: [],
          invoiceGlReversals,
          v2JournalsSkipped: v2.skippedAlreadyReversed,
        })
      }
    });

    return {
      reversal,
      taxReversals: [],
      invoiceGlReversals,
    };
  });

  return reversalInvoice;
}

/**
 * Creates a reversal for an expense
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal expense and journal entry
 */
async function createExpenseReversal({
  expenseId,
  reversalReason,
  userId,
  tenantId
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const eligibility = await validateReversalEligibility({
    transactionId: expenseId,
    transactionType: 'Expense',
    tenantId
  });

  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }

  const originalExpense = eligibility.transaction;

  const periodCheck = await checkAccountingPeriodLock(tenantId, originalExpense.date);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes: ['Expense', 'Tax-Expense'],
    sourceIds: [expenseId],
    requireJournals: true,
  });

  const originalJournalEntryId = v2.reversed[0]?.originalJournalId || null;
  const journalEntryId =
    v2.reversed[0]?.result?.journalEntryId || null;

  const reversalResult = await prisma.$transaction(async (tx) => {
    const reversal = await tx.expense.create({
      data: {
        description: `REVERSAL: ${originalExpense.description}`,
        amount: -originalExpense.amount,
        date: new Date(),
        category: originalExpense.category,
        status: 'approved',
        notes: `REVERSAL: ${originalExpense.id} - ${reasonValidation.reason}`,
        tenantId,
        sourceAccountId: originalExpense.sourceAccountId,
        paymentMethod: originalExpense.paymentMethod,
        branchId: originalExpense.branchId,
        employeeId: originalExpense.employeeId,
        supplierId: originalExpense.supplierId,
        submittedById: userId,
        isReversal: true,
        reversedTransactionId: originalExpense.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Expense',
        entityId: originalExpense.id,
        userId,
        tenantId,
        details: JSON.stringify({
          originalExpenseId: originalExpense.id,
          reversalExpenseId: reversal.id,
          originalJournalEntryId,
          reversalJournalEntryId: journalEntryId,
          reversalReason: reasonValidation.reason,
          originalAmount: originalExpense.amount,
          reversalAmount: -originalExpense.amount,
          taxReversals: [],
          v2JournalReversals: v2.reversed.map((r) => r.originalJournalId),
          v2JournalsSkipped: v2.skippedAlreadyReversed,
        })
      }
    });

    return {
      reversal,
      journalEntry: { id: journalEntryId },
      taxReversals: []
    };
  });

  return {
    reversal: reversalResult.reversal,
    taxReversals: [],
    journalEntryId,
    originalJournalEntryId,
  };
}

/**
 * Creates a reversal for a payment
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal payment
 */
async function createPaymentReversal({
  paymentId,
  reversalReason,
  userId,
  tenantId
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const eligibility = await validateReversalEligibility({
    transactionId: paymentId,
    transactionType: 'Payment',
    tenantId
  });

  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }

  const originalPayment = eligibility.transaction;

  const periodCheck = await checkAccountingPeriodLock(tenantId, originalPayment.paymentDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes: ['Payment'],
    sourceIds: [originalPayment.id],
    requireJournals: true,
  });

  const reversalRef = await generateReversalReference('PAY-REV', tenantId);

  const reversalPayment = await prisma.$transaction(async (tx) => {
    const reversal = await tx.payment.create({
      data: {
        invoiceId: originalPayment.invoiceId,
        amount: -originalPayment.amount,
        paymentDate: new Date(),
        paymentMethod: originalPayment.paymentMethod,
        reference: reversalRef,
        notes: `REVERSAL: ${originalPayment.reference || originalPayment.id} - ${reasonValidation.reason}`,
        status: 'Reversed',
        tenantId,
        destinationAccount: originalPayment.destinationAccount,
        sourceAccount: originalPayment.sourceAccount,
        type: originalPayment.type,
        expenseId: originalPayment.expenseId,
        saleId: originalPayment.saleId,
        branchId: originalPayment.branchId,
        isReversal: true,
        reversedTransactionId: originalPayment.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });

    if (originalPayment.allocations && originalPayment.allocations.length > 0) {
      for (const alloc of originalPayment.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: reversal.id,
            paymentAccountId: alloc.paymentAccountId,
            amount: -alloc.amount
          }
        });
      }
    }

    await tx.payment.update({
      where: { id: originalPayment.id },
      data: { status: 'Reversed' }
    });

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Payment',
        entityId: originalPayment.id,
        userId,
        tenantId,
        details: JSON.stringify({
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalPayment.amount,
          reversalAmount: -originalPayment.amount,
          v2JournalReversals: v2.reversed.map((r) => r.originalJournalId),
          v2JournalsSkipped: v2.skippedAlreadyReversed,
        })
      }
    });

    return reversal;
  });

  return {
    reversal: reversalPayment,
    taxReversals: [],
    v2JournalReversals: v2.reversed,
  };
}

/**
 * Creates a reversal for a sale
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal sale
 */
async function createSaleReversal({
  saleId,
  reversalReason,
  userId,
  tenantId
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const eligibility = await validateReversalEligibility({
    transactionId: saleId,
    transactionType: 'Sale',
    tenantId
  });

  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }

  const originalSale = eligibility.transaction;

  const periodCheck = await checkAccountingPeriodLock(tenantId, originalSale.saleDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes: ['Sale', 'Sale-COGS', 'Tax-Sale'],
    sourceIds: [saleId],
    requireJournals: true,
  });

  const reversalSaleNumber = await generateReversalReference('SL-REV', tenantId);

  const reversalSale = await prisma.$transaction(async (tx) => {
    const reversal = await tx.sale.create({
      data: {
        saleNumber: reversalSaleNumber,
        clientId: originalSale.clientId,
        createdById: userId,
        saleDate: new Date(),
        subtotal: -originalSale.subtotal,
        taxRate: originalSale.taxRate,
        taxAmount: -originalSale.taxAmount,
        total: -originalSale.total,
        status: 'cancelled',
        notes: `REVERSAL: ${originalSale.saleNumber} - ${reasonValidation.reason}`,
        paymentMethod: originalSale.paymentMethod,
        tenantId,
        discount: -originalSale.discount,
        totalDiscountAmount: -originalSale.totalDiscountAmount,
        totalTaxAmount: -originalSale.totalTaxAmount,
        branchId: originalSale.branchId,
        isReversal: true,
        reversedTransactionId: originalSale.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });

    const originalItems = await tx.saleItem.findMany({
      where: { saleId: originalSale.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            stockLevel: true,
            isService: true
          }
        }
      }
    });

    for (const item of originalItems) {
      await tx.saleItem.create({
        data: {
          saleId: reversal.id,
          productId: item.productId,
          description: `REVERSAL: ${item.description}`,
          quantity: -item.quantity,
          unitPrice: item.unitPrice,
          amount: -item.amount,
          customProductData: item.customProductData,
          discount: -item.discount,
          discountAmount: -item.discountAmount,
          isCustom: item.isCustom,
          taxAmount: -item.taxAmount,
          taxDescription: item.taxDescription,
          taxRate: item.taxRate
        }
      });

      if (!item.isCustom && item.productId && item.product && !item.product.isService) {
        try {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockLevel: { increment: item.quantity } }
          });
          try {
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId,
                type: 'reversal_restoration',
                quantity: Math.round(Math.max(0, item.quantity)),
                notes: `Reversal restoration for sale ${originalSale.saleNumber}: ${reasonValidation.reason}`,
                userId,
                tenantId
              }
            });
          } catch (invTxError) {
            console.warn('Could not create inventory transaction for reversal:', invTxError.message);
          }
        } catch (inventoryError) {
          console.error(`Error restoring inventory for product ${item.productId}:`, inventoryError);
        }
      }
    }

    const originalPayments = await tx.payment.findMany({
      where: {
        saleId: originalSale.id,
        tenantId,
        status: 'Completed'
      },
      include: {
        allocations: {
          include: { paymentAccount: true }
        }
      }
    });

    const reversedPayments = [];
    for (const payment of originalPayments) {
      const reversalPaymentRef = await generateReversalReference('PAY-REV', tenantId);
      const reversalPayment = await tx.payment.create({
        data: {
          saleId: reversal.id,
          amount: -payment.amount,
          paymentDate: new Date(),
          paymentMethod: payment.paymentMethod,
          reference: reversalPaymentRef,
          notes: `REVERSAL: ${payment.reference || payment.id} - ${reasonValidation.reason}`,
          status: 'Reversed',
          tenantId,
          destinationAccount: payment.destinationAccount,
          sourceAccount: payment.sourceAccount,
          type: payment.type,
          branchId: payment.branchId,
          isReversal: true,
          reversedTransactionId: payment.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId,
          allocations: {
            create: payment.allocations.map(alloc => ({
              paymentAccountId: alloc.paymentAccountId,
              amount: -alloc.amount
            }))
          }
        }
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'Reversed' }
      });
      reversedPayments.push({
        originalPaymentId: payment.id,
        reversalPaymentId: reversalPayment.id,
        amount: payment.amount
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Sale',
        entityId: originalSale.id,
        userId,
        tenantId,
        details: JSON.stringify({
          originalSaleId: originalSale.id,
          reversalSaleId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalSale.total,
          reversalAmount: -originalSale.total,
          originalTaxAmount: originalSale.taxAmount,
          reversedTaxAmount: -originalSale.taxAmount,
          journalEntriesReversed: v2.reversed.length,
          paymentsReversed: reversedPayments.length,
          taxReversals: [],
          v2JournalReversals: v2.reversed.map((r) => r.originalJournalId),
          v2JournalsSkipped: v2.skippedAlreadyReversed,
          inventoryRestored: originalItems.filter(item => !item.isCustom && item.productId).length
        })
      }
    });

    return {
      reversal,
      taxReversals: []
    };
  });

  return reversalSale;
}

/**
 * Reverses posted V2 GL for a sale refund/void (revenue, COGS, tax).
 * Does not create a reversal sale record.
 * Note: V2 reverseJournal uses its own posting boundary (root prisma), not the
 * caller's interactive `tx`. Operational work in `tx` remains separate.
 *
 * @param {Object} params
 * @param {import('@prisma/client').Prisma.TransactionClient} [params.tx] unused for GL (API compat)
 * @param {string} params.saleId
 * @param {string} params.saleNumber
 * @param {string} params.userId
 * @param {string} params.tenantId
 * @param {string} params.reversalReason
 * @param {'refund'|'void'} [params.context='refund']
 * @returns {Promise<{ reversedJournals: number, reversedTax: number, journalReversalIds: string[], taxReversalIds: string[], fallbackTaxEntries: number }>}
 */
export async function reverseSaleGlForRefundInTx({
  saleId,
  saleNumber,
  userId,
  tenantId,
  reversalReason,
  context = 'refund',
}) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const periodCheck = await checkAccountingPeriodLock(tenantId, new Date());
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error || 'Accounting period is locked.');
  }

  const reasonLabel =
    context === 'void'
      ? `VOID: ${reasonValidation.reason}`
      : `REFUND: ${reasonValidation.reason}`;

  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonLabel,
    sourceTypes: ['Sale', 'Sale-COGS', 'Tax-Sale'],
    sourceIds: [saleId],
    requireJournals: true,
  });

  const journalReversalIds = v2.reversed.map(
    (r) => r.result?.journalEntryId || r.originalJournalId
  );

  return {
    reversedJournals: v2.reversed.length,
    reversedTax: 0,
    journalReversalIds,
    taxReversalIds: [],
    fallbackTaxEntries: 0,
    saleNumber,
    skippedAlreadyReversed: v2.skippedAlreadyReversed,
  };
}

async function createSupplierPaymentReversal({
  supplierPaymentId,
  reversalReason,
  userId,
  tenantId
}) {
  // Validate reversal reason
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }
  
  // Validate eligibility
  const eligibility = await validateReversalEligibility({
    transactionId: supplierPaymentId,
    transactionType: 'SupplierPayment',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalPayment = eligibility.transaction;

  const periodCheck = await checkAccountingPeriodLock(tenantId, originalPayment.paymentDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const v2 = await reverseSourceJournals({
    tenantId,
    userId,
    reason: reasonValidation.reason,
    sourceTypes: ['SupplierPayment', 'Tax-SupplierPayment'],
    sourceIds: [supplierPaymentId],
    requireJournals: true,
  });

  const reversalPaymentNumber = await generateReversalReference('SP-REV', tenantId);

  const reversalPayment = await prisma.$transaction(async (tx) => {
    const reversal = await tx.supplierPayment.create({
      data: {
        paymentNumber: reversalPaymentNumber,
        tenantId,
        supplierId: originalPayment.supplierId,
        paymentDate: new Date(),
        paymentMethod: originalPayment.paymentMethod,
        bankAccountId: originalPayment.bankAccountId,
        referenceNumber: `REV-${originalPayment.referenceNumber || originalPayment.id}`,
        totalAmount: -originalPayment.totalAmount,
        currency: originalPayment.currency,
        exchangeRate: originalPayment.exchangeRate,
        notes: `REVERSAL: ${originalPayment.paymentNumber} - ${reasonValidation.reason}`,
        createdById: userId,
        isReversal: true,
        reversedTransactionId: originalPayment.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });

    const originalAllocations = await tx.supplierPaymentAllocation.findMany({
      where: { paymentId: originalPayment.id }
    });

    for (const alloc of originalAllocations) {
      await tx.supplierPaymentAllocation.create({
        data: {
          tenantId,
          paymentId: reversal.id,
          billId: alloc.billId,
          amount: -alloc.amount
        }
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'SupplierPayment',
        entityId: originalPayment.id,
        userId,
        tenantId,
        details: JSON.stringify({
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalPayment.totalAmount,
          reversalAmount: -originalPayment.totalAmount,
          v2JournalReversals: v2.reversed.map((r) => r.originalJournalId),
          v2JournalsSkipped: v2.skippedAlreadyReversed,
        })
      }
    });

    return reversal;
  });

  return {
    reversal: reversalPayment,
    taxReversals: [],
    v2JournalReversals: v2.reversed,
  };
}

/**
 * Gets reversal details for a transaction
 * @param {Object} params - Query parameters
 * @returns {Object} Reversal details
 */
/** Child reversal docs point at the original via reversedTransactionId (not the reverse). */
async function findChildReversalDoc(model, transactionId, tenantId, include) {
  const where = {
    reversedTransactionId: transactionId,
    isReversal: true,
    tenantId,
  };
  if (include) {
    return model.findFirst({ where, include });
  }
  return model.findFirst({ where });
}

async function getReversalDetails({ transactionId, transactionType, tenantId }) {
  try {
    let original, reversal;
    
    switch (transactionType) {
      case 'Invoice':
        try {
          original = await prisma.invoice.findFirst({
            where: { 
              id: transactionId,
              tenantId: tenantId
            },
            include: { 
              items: true, 
              client: true, 
              payments: true 
            }
          });
        } catch (queryError) {
          console.error('Error querying invoice:', queryError);
          // Try without includes if the query fails
          original = await prisma.invoice.findFirst({
            where: { 
              id: transactionId,
              tenantId: tenantId
            }
          });
        }
        if (!original) {
          throw new Error('Invoice not found or access denied');
        }
        try {
          reversal = await findChildReversalDoc(prisma.invoice, transactionId, tenantId);
        } catch (reversalError) {
          console.error('Error querying reversal invoice:', reversalError);
        }
        break;
      
    case 'Expense':
      original = await prisma.expense.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        }
      });
      if (!original) {
        throw new Error('Expense not found or access denied');
      }
      reversal = await findChildReversalDoc(prisma.expense, transactionId, tenantId);
      break;
      
    case 'Payment':
      original = await prisma.payment.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        },
        include: { allocations: true }
      });
      if (!original) {
        throw new Error('Payment not found or access denied');
      }
      reversal = await findChildReversalDoc(prisma.payment, transactionId, tenantId);
      break;
      
    case 'Sale':
      original = await prisma.sale.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        },
        include: { items: true, payments: true }
      });
      if (!original) {
        throw new Error('Sale not found or access denied');
      }
      reversal = await findChildReversalDoc(prisma.sale, transactionId, tenantId);
      break;
      
    case 'SupplierPayment':
      original = await prisma.supplierPayment.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        },
        include: { allocations: true }
      });
      if (!original) {
        throw new Error('Supplier payment not found or access denied');
      }
      reversal = await findChildReversalDoc(prisma.supplierPayment, transactionId, tenantId);
      break;
      
    case 'Transaction':
      original = await prisma.transaction.findFirst({
        where: { 
          id: transactionId,
          tenantId: tenantId
        },
        include: { lines: { include: { account: true } } }
      });
      if (!original) {
        throw new Error('Transaction not found or access denied');
      }
      reversal = await findChildReversalDoc(prisma.transaction, transactionId, tenantId, {
        lines: true,
      });
      break;

      
    default:
      throw new Error(`Unknown transaction type: ${transactionType}`);
  }
  
    // Get audit trail
    let auditRecords = [];
    try {
      auditRecords = await prisma.auditLog.findMany({
        where: {
          tenantId,
          action: 'TRANSACTION_REVERSED',
          entityId: transactionId
        },
        orderBy: { timestamp: 'desc' }
      });
    } catch (auditError) {
      console.error('Error fetching audit records:', auditError);
      // Continue without audit records rather than failing
    }
    
    // Find tax reversals for this transaction
    let taxReversals = [];
    try {
      // Find original tax transactions
      let originalTaxTransactions = [];
      if (transactionType === 'Invoice') {
        originalTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Invoice',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
      } else if (transactionType === 'Sale') {
        originalTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Sale',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
      } else if (transactionType === 'Expense') {
        originalTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Expense',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
      }
      
      // Find reversal transactions for each tax transaction
      for (const taxTx of originalTaxTransactions) {
        const taxReversal = await prisma.transaction.findFirst({
          where: {
            tenantId,
            reversedTransactionId: taxTx.id,
            isReversal: true
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
        
        if (taxReversal) {
          taxReversals.push({
            originalTaxTransaction: {
              id: taxTx.id,
              reference: taxTx.reference,
              description: taxTx.description,
              date: taxTx.date,
              taxAccount: taxTx.lines[0]?.account,
              taxAmount: taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0
            },
            reversalTaxTransaction: {
              id: taxReversal.id,
              reference: taxReversal.reference,
              description: taxReversal.description,
              date: taxReversal.date,
              taxAccount: taxReversal.lines[0]?.account,
              reversedTaxAmount: taxReversal.lines[0]?.debitAmount || taxReversal.lines[0]?.creditAmount || 0
            }
          });
        }
      }
    } catch (taxError) {
      console.error('Error fetching tax reversals:', taxError);
      // Continue without tax reversals rather than failing
    }
    
    // For Payroll transactions, include deductions and tax breakdown so they are explicitly returned
    let payrollReversalBreakdown = null;
    if (transactionType === 'Transaction' && original?.sourceType === 'Payroll' && original?.lines?.length) {
      payrollReversalBreakdown = buildPayrollReversalBreakdown(original.lines);
    }
    
    return {
      original,
      reversal,
      isReversed: !!reversal,
      taxReversals,
      auditRecords,
      ...(payrollReversalBreakdown && { payrollReversalBreakdown, deductionsAndTaxReversed: payrollReversalBreakdown.deductionsAndTaxReversed })
    };
  } catch (error) {
    console.error('Error in getReversalDetails:', error);
    console.error('Transaction ID:', transactionId);
    console.error('Transaction Type:', transactionType);
    console.error('Tenant ID:', tenantId);
    throw error;
  }
}

/**
 * Lists all reversible transactions for a tenant
 * @param {Object} params - Query parameters
 * @returns {Array} List of reversible transactions
 */
async function listReversibleTransactions({ 
  tenantId, 
  transactionType, 
  startDate, 
  endDate,
  page = 1,
  limit = 50
}) {
  const where = {
    tenantId,
    isReversal: false  // Only show non-reversed transactions
  };
  
  // Add type filter
  if (transactionType) {
    where.sourceType = transactionType;
  }
  
  // Add date range filter
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  
  // For document-based transactions (Invoice, Expense, Sale, Payment)
  // we need to query separately
  const result = {
    transactions: [],
    invoices: [],
    expenses: [],
    payments: [],
    sales: [],
    supplierPayments: [],
    total: 0
  };
  
  if (!transactionType || transactionType === 'Transaction') {
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenantId,
          status: 'posted',
          isReversal: false,
          reversedTransactionId: null
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { lines: true }
      }),
      prisma.transaction.count({
        where: {
          tenantId,
          status: 'posted',
          isReversal: false,
          reversedTransactionId: null
        }
      })
    ]);
    result.transactions = items;
    result.total += total;
  }
  
  if (!transactionType || transactionType === 'Invoice') {
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['posted', 'partial', 'paid'] },
          isReversal: false
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { client: true, items: true }
      }),
      prisma.invoice.count({
        where: {
          tenantId,
          status: { in: ['posted', 'partial', 'paid'] },
          isReversal: false
        }
      })
    ]);
    result.invoices = items;
    result.total += total;
  }
  
  if (!transactionType || transactionType === 'Expense') {
    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where: {
          tenantId,
          status: 'approved',
          isReversal: false,
          isDeleted: false
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.expense.count({
        where: {
          tenantId,
          status: 'approved',
          isReversal: false,
          isDeleted: false
        }
      })
    ]);
    result.expenses = items;
    result.total += total;
  }
  
  if (!transactionType || transactionType === 'Payment') {
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where: {
          tenantId,
          status: 'Completed',
          isReversal: false
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.payment.count({
        where: {
          tenantId,
          status: 'Completed',
          isReversal: false
        }
      })
    ]);
    result.payments = items;
    result.total += total;
  }
  
  if (!transactionType || transactionType === 'Sale') {
    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where: {
          tenantId,
          status: 'completed',
          isReversal: false
        },
        orderBy: { saleDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.sale.count({
        where: {
          tenantId,
          status: 'completed',
          isReversal: false
        }
      })
    ]);
    result.sales = items;
    result.total += total;
  }
  
  if (!transactionType || transactionType === 'SupplierPayment') {
    const [items, total] = await Promise.all([
      prisma.supplierPayment.findMany({
        where: {
          tenantId,
          isReversal: false
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: true }
      }),
      prisma.supplierPayment.count({
        where: {
          tenantId,
          isReversal: false
        }
      })
    ]);
    result.supplierPayments = items;
    result.total += total;
  }
  
  return result;
}

/**
 * Generates a unique reversal reference number
 * @param {string} prefix - Reference prefix
 * @param {string} tenantId - Tenant ID
 * @returns {string} Generated reference number
 */
async function generateReversalReference(prefix, tenantId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculates the financial impact of a reversal
 * @param {Object} params - Query parameters
 * @returns {Object} Impact details
 */
async function calculateReversalImpact({ transactionId, transactionType, tenantId }) {
  try {
    const eligibility = await validateReversalEligibility({
      transactionId,
      transactionType,
      tenantId
    });
    
    if (!eligibility.isValid) {
      throw new Error(eligibility.error);
    }
    
    const transaction = eligibility.transaction;
    if (!transaction) {
      throw new Error('Transaction not found after eligibility check');
    }
    
    const warnings = [];
    
    // Calculate impact based on type
    let impact = {
      originalAmount: 0,
      reversalAmount: 0,
      netEffect: 0,
      affectedAccounts: [],
      affectedTaxes: [],
      affectedInventory: [],
      warnings: []
    };
    
    switch (transactionType) {
      case 'Invoice':
        const invoiceTotal = parseFloat(transaction.total || 0);
        const invoiceTax = parseFloat(transaction.taxAmount || 0);
        impact.originalAmount = invoiceTotal;
        impact.reversalAmount = -invoiceTotal;
        impact.netEffect = 0;
        
        // Find tax transactions for this invoice
        const invoiceTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Invoice',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
        
        if (invoiceTaxTransactions.length > 0) {
          for (const taxTx of invoiceTaxTransactions) {
            const taxAmount = taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0;
            const taxAccount = taxTx.lines[0]?.account;
            impact.affectedTaxes.push({
              type: taxAccount?.accountName || 'Tax',
              taxAccountId: taxAccount?.id,
              taxAccountName: taxAccount?.accountName,
              original: taxAmount,
              reversal: -taxAmount,
              net: 0,
              taxTransactionId: taxTx.id
            });
          }
        } else if (!isNaN(invoiceTax) && invoiceTax > 0) {
          // Fallback: use invoice tax amount if tax transactions not found
          impact.affectedTaxes.push({
            type: 'Sales Tax',
            original: invoiceTax,
            reversal: -invoiceTax,
            net: 0
          });
        }
        break;
      
      case 'Expense':
        const expenseAmount = parseFloat(transaction.amount || 0);
        impact.originalAmount = expenseAmount;
        impact.reversalAmount = -expenseAmount;
        impact.netEffect = 0;
        
        // Find tax transactions for this expense
        const expenseTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Expense',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
        
        if (expenseTaxTransactions.length > 0) {
          for (const taxTx of expenseTaxTransactions) {
            const taxAmount = taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0;
            const taxAccount = taxTx.lines[0]?.account;
            impact.affectedTaxes.push({
              type: taxAccount?.accountName || 'Tax',
              taxAccountId: taxAccount?.id,
              taxAccountName: taxAccount?.accountName,
              original: taxAmount,
              reversal: -taxAmount,
              net: 0,
              taxTransactionId: taxTx.id
            });
          }
        }
        break;
        
      case 'Payment':
        const paymentAmount = parseFloat(transaction.amount || 0);
        impact.originalAmount = paymentAmount;
        impact.reversalAmount = -paymentAmount;
        impact.netEffect = 0;
        
        // Check for allocated amounts (only if allocations relation was included)
        if (transaction.allocations && Array.isArray(transaction.allocations) && transaction.allocations.length > 0) {
          warnings.push('Payment has allocations - all allocations will be reversed');
        }
        break;
        
      case 'Sale':
        const saleTotal = parseFloat(transaction.total || 0);
        const saleTax = parseFloat(transaction.taxAmount || 0);
        impact.originalAmount = saleTotal;
        impact.reversalAmount = -saleTotal;
        impact.netEffect = 0;
        
        // Find tax transactions for this sale
        const saleTaxTransactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            sourceType: 'Tax-Sale',
            sourceId: transactionId,
            status: 'posted',
            isReversal: false
          },
          include: {
            lines: {
              include: {
                account: true
              }
            }
          }
        });
        
        if (saleTaxTransactions.length > 0) {
          for (const taxTx of saleTaxTransactions) {
            const taxAmount = taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0;
            const taxAccount = taxTx.lines[0]?.account;
            impact.affectedTaxes.push({
              type: taxAccount?.accountName || 'Tax',
              taxAccountId: taxAccount?.id,
              taxAccountName: taxAccount?.accountName,
              original: taxAmount,
              reversal: -taxAmount,
              net: 0,
              taxTransactionId: taxTx.id
            });
          }
        } else if (!isNaN(saleTax) && saleTax > 0) {
          // Fallback: use sale tax amount if tax transactions not found
          impact.affectedTaxes.push({
            type: 'Sales Tax',
            original: saleTax,
            reversal: -saleTax,
            net: 0
          });
        }
        
        // Check for COGS impact
        warnings.push('Sale reversal will reverse COGS entries');
        
        // Check for inventory impact (only if relation was included)
        if (transaction.inventoryBatchConsumptions && Array.isArray(transaction.inventoryBatchConsumptions) && transaction.inventoryBatchConsumptions.length > 0) {
          warnings.push('Sale reversal will restore inventory');
          impact.affectedInventory.push({
            action: 'RESTOCK',
            quantity: transaction.inventoryBatchConsumptions.reduce((sum, c) => sum + (c.quantity || 0), 0)
          });
        }
        break;
        
      case 'Transaction':
        const lines = await prisma.transactionLine.findMany({
          where: { transactionId },
          include: { account: true }
        });
        
        impact.originalAmount = lines.reduce((sum, l) => sum + l.debitAmount + l.creditAmount, 0);
        impact.reversalAmount = -impact.originalAmount;
        impact.netEffect = 0;
        impact.affectedAccounts = lines.map(l => ({
          accountId: l.accountId,
          accountName: l.account?.accountName || l.account?.name,
          originalDebit: l.debitAmount,
          originalCredit: l.creditAmount,
          reversalDebit: l.creditAmount,
          reversalCredit: l.debitAmount
        }));
        // For Payroll transactions, return deductions and tax (PAYE) explicitly in impact
        if (isPayrollSourceType(transaction.sourceType) && lines.length > 0) {
          const breakdown = buildPayrollReversalBreakdown(lines);
          impact.deductionsAndTaxReversed = breakdown.deductionsAndTaxReversed;
          impact.payrollReversalBreakdown = breakdown;
          if (breakdown.payeTax > 0) {
            impact.affectedTaxes.push({
              type: 'PAYE / Tax',
              original: breakdown.payeTax,
              reversal: -breakdown.payeTax,
              net: 0
            });
          }
          if (breakdown.nps > 0) {
            impact.affectedTaxes.push({
              type: 'NPS / Pension',
              original: breakdown.nps,
              reversal: -breakdown.nps,
              net: 0
            });
          }
          // Linked auto-posted tax journals (Tax-Payroll) — reversed together with createTransactionReversal
          if (transaction.sourceId) {
            const payrollTaxTransactions = await prisma.transaction.findMany({
              where: {
                tenantId,
                sourceType: 'Tax-Payroll',
                sourceId: transaction.sourceId,
                status: 'posted',
                isReversal: false
              },
              include: { lines: { include: { account: true } } }
            });
            for (const taxTx of payrollTaxTransactions) {
              const t0 = taxTx.lines?.[0];
              const taxAmount = Math.max(
                parseFloat(t0?.debitAmount ?? 0) || 0,
                parseFloat(t0?.creditAmount ?? 0) || 0
              );
              const taxAccount = t0?.account;
              impact.affectedTaxes.push({
                type: taxAccount?.accountName || 'Tax-Payroll',
                taxAccountId: taxAccount?.id,
                taxAccountName: taxAccount?.accountName,
                original: taxAmount,
                reversal: -taxAmount,
                net: 0,
                taxTransactionId: taxTx.id
              });
            }
          }
        }
        break;
        
      case 'SupplierPayment':
        const supplierPaymentAmount = parseFloat(transaction.amount || transaction.totalAmount || 0);
        impact.originalAmount = supplierPaymentAmount;
        impact.reversalAmount = -supplierPaymentAmount;
        impact.netEffect = 0;
        
        // Check for allocated amounts (only if allocations relation was included)
        if (transaction.allocations && Array.isArray(transaction.allocations) && transaction.allocations.length > 0) {
          warnings.push('Supplier payment has allocations - all allocations will be reversed');
        }
        break;
        
      default:
        throw new Error(`Unknown transaction type: ${transactionType}`);
    }
    
    impact.warnings = warnings;
    
    return impact;
  } catch (error) {
    console.error('Error in calculateReversalImpact:', error);
    console.error('Transaction ID:', transactionId);
    console.error('Transaction Type:', transactionType);
    console.error('Tenant ID:', tenantId);
    throw error;
  }
}

/**
 * Dedicated payroll reversal: reverses all payroll GL entries, restores balances,
 * maintains audit history, and prevents partial reversals (all-or-nothing in one transaction).
 * Use this instead of reversing the journal transaction directly when reversing by payroll entry.
 *
 * Full scope:
 * - GL: salary expense, PAYE/tax liabilities, staff payable, NPS/pension, deductions, cash
 * - Side effects (reversePayrollSideEffects): salary advance deductions restored, gratuity accrual
 *   reversed, payroll-related Expense and Payment records marked as reversed
 *
 * @param {Object} params - { payrollId, reversalReason, userId, tenantId }
 * @returns {Object} { reversal, payrollReversalSummary, taxReversals, audit }
 */
async function reversePayroll({ payrollId, reversalReason, userId, tenantId }) {
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }

  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, tenantId },
    include: { employee: { select: { id: true, name: true } } }
  });
  if (!payroll) {
    throw new Error('Payroll record not found or access denied');
  }
  if (payroll.status === 'Reversed') {
    throw new Error('This payroll has already been reversed');
  }

  const payrollJournals = await prisma.transaction.findMany({
    where: buildPostedPayrollJournalWhere(tenantId, payrollId),
    include: { lines: true },
    orderBy: { date: 'asc' },
  });
  if (payrollJournals.length === 0) {
    throw new Error(
      'No posted journal transaction found for this payroll. Reversal cannot be performed without GL entries (prevents partial state).'
    );
  }
  if (payrollJournals.length > 1) {
    throw new Error(
      'Multiple payroll journals found for this payroll; resolve duplicates before reversing.'
    );
  }
  const journalTransaction = payrollJournals[0];
  const existingJournalReversal = await prisma.transaction.findFirst({
    where: {
      tenantId,
      isReversal: true,
      reversedTransactionId: journalTransaction.id
    }
  });
  if (existingJournalReversal) {
    throw new Error('This payroll journal has already been reversed');
  }
  if (!journalTransaction.lines || journalTransaction.lines.length === 0) {
    throw new Error('Payroll journal transaction has no lines; cannot reverse.');
  }

  const reversalDate = new Date();
  const periodCheck = await checkAccountingPeriodLock(tenantId, reversalDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const result = await createTransactionReversal({
    transactionId: journalTransaction.id,
    reversalReason: reasonValidation.reason,
    userId,
    tenantId,
    reversalDate
  });

  await prisma.auditLog.create({
    data: {
      action: 'PAYROLL_REVERSAL',
      entityType: 'PAYROLL',
      entityId: payrollId,
      userId,
      tenantId,
      details: JSON.stringify({
        payrollId,
        employeeId: payroll.employeeId,
        employeeName: payroll.employee?.name,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        originalJournalTransactionId: journalTransaction.id,
        reversalTransactionId: result.reversal?.id,
        reversalReason: reasonValidation.reason,
        payrollReversalSummary: result.payrollReversalSummary || null,
        taxReversalsCount: (result.taxReversals || []).length,
        message: 'Dedicated payroll reversal completed: all GL entries reversed, balances restored, no partial reversal.'
      })
    }
  });

  return {
    reversal: result.reversal,
    payrollReversalSummary: result.payrollReversalSummary,
    taxReversals: result.taxReversals || [],
    audit: {
      payrollId,
      employeeId: payroll.employeeId,
      employeeName: payroll.employee?.name,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      reversalTransactionId: result.reversal?.id,
      reversalReason: reasonValidation.reason
    }
  };
}

export {
  POSTED_GL_STATUSES,
  buildPostedPayrollJournalWhere,
  resolvePostedPayrollJournalState,
  validateReversalEligibility,
  validateReversalReason,
  checkAccountingPeriodLock,
  createTransactionReversal,
  createInvoiceReversal,
  createExpenseReversal,
  createPaymentReversal,
  createSaleReversal,
  createSupplierPaymentReversal,
  getReversalDetails,
  listReversibleTransactions,
  calculateReversalImpact,
  generateReversalReference,
  reversePayroll
};
