/**
 * Transaction Reversal Service
 * 
 * Implements accounting-safe transaction reversal functionality.
 * All reversals create new transactions with opposite entries, preserving
 * the original transaction for audit purposes.
 * 
 * Key Principles:
 * - No hard deletes - original transactions remain unchanged
 * - Equal and opposite entries for complete financial negation
 * - Mandatory reversal reason for audit trail
 * - Bi-directional traceability between original and reversal
 * - Proper journal entries (Transaction + TransactionLines) are created
 * - Account balances are updated when reversals are created
 */

import prisma from './prisma';
import { generateReferenceNumber } from './journalService';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';
import { createExpenseJournalEntry } from './transactionJournalHelpers';

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
    // Check transaction status
    if (transaction.status !== 'posted') {
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
    const amount = line.debitAmount || line.creditAmount || 0;
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
    } else if (line.creditAmount > 0 && (accountName.includes('paye') || accountName.includes('tax') || accountName.includes('liability'))) {
      byCategory.payeTax += amount;
    } else if (line.creditAmount > 0 && (accountName.includes('pension') || accountName.includes('nps'))) {
      byCategory.nps += amount;
    } else if (line.creditAmount > 0 && accountName.includes('deduction')) {
      byCategory.otherDeductions += amount;
    } else if (line.debitAmount > 0 && accountName.includes('expense')) {
      byCategory.salaryExpense += amount;
    } else if (line.creditAmount > 0) {
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
  const payroll = await tx.payroll.findUnique({
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

  // 3. Mark payroll expenses as reversed (same employee, period end date, known descriptions) – includes PAYE/tax and other deduction expense records
  const payrollExpenseDescriptions = ['Net Pay -', 'PAYE Tax -', 'Employer NPS -', 'Overtime -'];
  const payrollExpenses = await tx.expense.findMany({
    where: {
      tenantId,
      employeeId: payroll.employeeId,
      date: payroll.periodEnd,
      isReversal: false,
      isDeleted: false,
      OR: payrollExpenseDescriptions.map(prefix => ({
        description: { startsWith: prefix }
      }))
    }
  });
  const expenseIds = payrollExpenses.map(e => e.id);
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
 * Creates a reversal transaction for a journal transaction
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal transaction
 */
async function createTransactionReversal({ 
  transactionId, 
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
    transactionId,
    transactionType: 'Transaction',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalTransaction = eligibility.transaction;
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalTransaction.date);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Get original transaction lines
  const originalLines = await prisma.transactionLine.findMany({
    where: { transactionId: originalTransaction.id },
    include: { account: true }
  });
  
  if (originalLines.length === 0) {
    throw new Error('Original transaction has no journal entries to reverse');
  }
  
  // Find tax transactions linked to this transaction
  // Tax transactions have sourceType like 'Tax-Sale', 'Tax-Invoice', 'Tax-Expense'
  // For Transaction type, we need to check if the original transaction has a sourceId
  // and look for tax transactions with that sourceId, or check by transaction reference
  let taxTransactions = [];
  
  if (originalTransaction.sourceId && originalTransaction.sourceType) {
    // If the transaction has a source (Invoice, Sale, Expense), find tax transactions for that source
    const sourceType = originalTransaction.sourceType;
    if (['Invoice', 'Sale', 'Expense'].includes(sourceType)) {
      taxTransactions = await prisma.transaction.findMany({
        where: {
          tenantId,
          sourceType: `Tax-${sourceType}`,
          sourceId: originalTransaction.sourceId,
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
  } else {
    // For standalone transactions, check if any tax transactions reference this transaction
    // by checking transactions that might be linked via description or reference
    taxTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        sourceType: { startsWith: 'Tax-' },
        description: { contains: originalTransaction.reference || originalTransaction.id },
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
  
  console.log('🔍 Found tax transactions to reverse:', {
    count: taxTransactions.length,
    taxTransactions: taxTransactions.map(t => ({
      id: t.id,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      description: t.description,
      taxAmount: t.lines?.[0]?.debitAmount || t.lines?.[0]?.creditAmount || 0
    }))
  });
  
  // Generate new reference number
  const reversalNumber = await generateReversalReference('TRX-REV', tenantId);
  
  // Create reversal transaction with opposite entries
  const reversalTransaction = await prisma.$transaction(async (tx) => {
    // Create the reversal transaction
    const reversal = await tx.transaction.create({
      data: {
        date: new Date(),
        description: `REVERSAL: ${originalTransaction.description}`,
        tenantId,
        reference: reversalNumber,
        status: 'posted',
        createdById: userId,
        entryType: 'Reversal',
        notes: `Reversal of transaction: ${originalTransaction.reference || originalTransaction.id}`,
        postedById: userId,
        postedDate: new Date(),
        sourceId: originalTransaction.id,
        sourceType: 'Transaction',
        branchId: originalTransaction.branchId,
        isReversal: true,
        reversedTransactionId: originalTransaction.id,
        reversalReason: reasonValidation.reason,
        reversedAt: new Date(),
        reversedById: userId
      }
    });
    
    // Create opposite journal entries for main transaction
    for (const line of originalLines) {
      const reversalLine = await tx.transactionLine.create({
        data: {
          transactionId: reversal.id,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          // Swap debit and credit
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          description: `REVERSAL: ${line.description || originalTransaction.description}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Update account balance for reversed line
      await updateAccountBalanceOnTransaction(
        line.accountId,
        reversalLine.debitAmount,
        reversalLine.creditAmount,
        tx
      );
    }
    
    // Reverse tax transactions
    const reversedTaxTransactions = [];
    for (const taxTx of taxTransactions) {
      const taxReversalNumber = await generateReversalReference('TAX-REV', tenantId);
      
      // Create reversal transaction for tax
      const taxReversal = await tx.transaction.create({
        data: {
          date: new Date(),
          description: `REVERSAL: ${taxTx.description}`,
          tenantId,
          reference: taxReversalNumber,
          status: 'posted',
          createdById: userId,
          entryType: 'Reversal',
          notes: `Reversal of tax transaction: ${taxTx.reference || taxTx.id} - ${reasonValidation.reason}`,
          postedById: userId,
          postedDate: new Date(),
          sourceId: taxTx.id,
          sourceType: `Tax-Reversal`,
          branchId: taxTx.branchId || originalTransaction.branchId,
          isReversal: true,
          reversedTransactionId: taxTx.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId
        }
      });
      
      // Create opposite journal entries for tax transaction
      for (const taxLine of taxTx.lines) {
        const taxReversalLine = await tx.transactionLine.create({
          data: {
            transactionId: taxReversal.id,
            lineNumber: taxLine.lineNumber,
            accountId: taxLine.accountId,
            // Swap debit and credit to reverse tax
            debitAmount: taxLine.creditAmount,
            creditAmount: taxLine.debitAmount,
            description: `REVERSAL: ${taxLine.description || taxTx.description}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Update tax account balance
        await updateAccountBalanceOnTransaction(
          taxLine.accountId,
          taxReversalLine.debitAmount,
          taxReversalLine.creditAmount,
          tx
        );
      }
      
      reversedTaxTransactions.push({
        originalTaxTransactionId: taxTx.id,
        reversalTaxTransactionId: taxReversal.id,
        taxAccountId: taxTx.lines[0]?.accountId,
        taxAccountName: taxTx.lines[0]?.account?.accountName,
        taxAmount: taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0
      });
    }
    
    // If this transaction is a payroll journal, reverse all payroll side effects and build deduction/tax summary
    let payrollReversalSummary = null;
    if (originalTransaction.sourceType === 'Payroll' && originalTransaction.sourceId) {
      const breakdown = buildPayrollReversalBreakdown(originalLines);
      const sideEffectsSummary = await reversePayrollSideEffects(tx, {
        payrollId: originalTransaction.sourceId,
        reversalTransactionId: reversal.id,
        userId,
        tenantId,
        reason: reasonValidation.reason
      });
      payrollReversalSummary = {
        payrollId: originalTransaction.sourceId,
        journalReversed: {
          salaryExpense: breakdown.salaryExpense,
          payeTax: breakdown.payeTax,
          nps: breakdown.nps,
          otherDeductions: breakdown.otherDeductions,
          advanceReceivable: breakdown.advanceReceivable,
          cash: breakdown.cash
        },
        deductionsAndTaxReversed: breakdown.deductionsAndTaxReversed,
        sideEffects: sideEffectsSummary || {}
      };
    }
    
    // Create audit log entry
    const auditDetails = {
      originalTransactionId: originalTransaction.id,
      reversalTransactionId: reversal.id,
      reversalReason: reasonValidation.reason,
      originalAmount: originalTransaction.amount || 0,
      reversalAmount: -(originalTransaction.amount || 0),
      taxReversals: reversedTaxTransactions
    };
    if (payrollReversalSummary) {
      auditDetails.payrollReversalSummary = payrollReversalSummary;
    }
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Transaction',
        entityId: originalTransaction.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify(auditDetails)
      }
    });
    
    return {
      reversal,
      taxReversals: reversedTaxTransactions,
      payrollReversalSummary
    };
  });
  
  return reversalTransaction;
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
  // Validate reversal reason
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }
  
  // Validate eligibility
  const eligibility = await validateReversalEligibility({
    transactionId: invoiceId,
    transactionType: 'Invoice',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalInvoice = eligibility.transaction;
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalInvoice.issueDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Find tax transactions linked to this invoice
  const taxTransactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'Tax-Invoice',
      sourceId: invoiceId,
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
  
  console.log('🔍 Found tax transactions for invoice reversal:', {
    invoiceId,
    count: taxTransactions.length,
    taxTransactions: taxTransactions.map(t => ({
      id: t.id,
      description: t.description,
      taxAmount: t.lines?.[0]?.debitAmount || t.lines?.[0]?.creditAmount || 0
    }))
  });
  
  // Generate new invoice number for reversal
  const reversalInvoiceNumber = await generateReversalReference('INV-REV', tenantId);
  
  // Create reversal invoice using transaction
  const reversalInvoice = await prisma.$transaction(async (tx) => {
    // Create reversal invoice
    const reversal = await tx.invoice.create({
      data: {
        invoiceNumber: reversalInvoiceNumber,
        clientId: originalInvoice.clientId,
        createdById: userId,
        issueDate: new Date(),
        dueDate: new Date(),
        subtotal: -originalInvoice.subtotal,  // Negative amounts
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
    
    // Create reversal invoice items (negative quantities/amounts)
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
      
      // Restore stock that was deducted when the invoice was posted (non-service products only)
      if (item.productId && item.product && !item.product.isService) {
        const qty = Number(item.quantity) || 0;
        if (qty > 0) {
          try {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockLevel: {
                  increment: qty
                }
              }
            });
            try {
              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  type: 'reversal_restoration',
                  quantity: Math.round(qty),
                  notes: `Reversal restoration for invoice ${originalInvoice.invoiceNumber}: ${reasonValidation.reason}`,
                  userId: userId,
                  tenantId: tenantId
                }
              });
            } catch (invTxErr) {
              console.warn('Could not create inventory transaction for invoice reversal:', invTxErr?.message);
            }
          } catch (invErr) {
            console.error(`Error restoring inventory for product ${item.productId} on invoice reversal:`, invErr);
            // Continue with other items
          }
        }
      }
    }
    
    // Reverse tax transactions
    const reversedTaxTransactions = [];
    for (const taxTx of taxTransactions) {
      const taxReversalNumber = await generateReversalReference('TAX-REV', tenantId);
      
      // Create reversal transaction for tax
      const taxReversal = await tx.transaction.create({
        data: {
          date: new Date(),
          description: `REVERSAL: ${taxTx.description}`,
          tenantId,
          reference: taxReversalNumber,
          status: 'posted',
          createdById: userId,
          entryType: 'Reversal',
          notes: `Reversal of tax transaction for invoice ${originalInvoice.invoiceNumber} - ${reasonValidation.reason}`,
          postedById: userId,
          postedDate: new Date(),
          sourceId: taxTx.id,
          sourceType: 'Tax-Reversal',
          branchId: taxTx.branchId || originalInvoice.branchId,
          isReversal: true,
          reversedTransactionId: taxTx.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId
        }
      });
      
      // Create opposite journal entries for tax transaction
      for (const taxLine of taxTx.lines) {
        const taxReversalLine = await tx.transactionLine.create({
          data: {
            transactionId: taxReversal.id,
            lineNumber: taxLine.lineNumber,
            accountId: taxLine.accountId,
            // Swap debit and credit to reverse tax
            debitAmount: taxLine.creditAmount,
            creditAmount: taxLine.debitAmount,
            description: `REVERSAL: ${taxLine.description || taxTx.description}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Update tax account balance
        await updateAccountBalanceOnTransaction(
          taxLine.accountId,
          taxReversalLine.debitAmount,
          taxReversalLine.creditAmount,
          tx
        );
      }
      
      reversedTaxTransactions.push({
        originalTaxTransactionId: taxTx.id,
        reversalTaxTransactionId: taxReversal.id,
        taxAccountId: taxTx.lines[0]?.accountId,
        taxAccountName: taxTx.lines[0]?.account?.accountName,
        taxAmount: taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0
      });
    }
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Invoice',
        entityId: originalInvoice.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalInvoiceId: originalInvoice.id,
          reversalInvoiceId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalInvoice.total,
          reversalAmount: -originalInvoice.total,
          originalTaxAmount: originalInvoice.taxAmount,
          reversedTaxAmount: -originalInvoice.taxAmount,
          taxReversals: reversedTaxTransactions
        })
      }
    });
    
    return {
      reversal,
      taxReversals: reversedTaxTransactions
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
  // Validate reversal reason
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }
  
  // Validate eligibility
  const eligibility = await validateReversalEligibility({
    transactionId: expenseId,
    transactionType: 'Expense',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalExpense = eligibility.transaction;
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalExpense.date);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Find the original journal entry (Transaction) created for this expense
  const originalJournalEntry = await prisma.transaction.findFirst({
    where: {
      tenantId,
      sourceType: 'Expense',
      sourceId: expenseId,
      status: 'posted',
      isReversal: false
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  if (!originalJournalEntry) {
    throw new Error('Original journal entry not found for this expense. Cannot reverse.');
  }
  
  // Find tax transactions linked to this expense
  const taxTransactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'Tax-Expense',
      sourceId: expenseId,
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
  
  console.log('🔍 Found tax transactions for expense reversal:', {
    expenseId,
    count: taxTransactions.length,
    taxTransactions: taxTransactions.map(t => ({
      id: t.id,
      description: t.description,
      taxAmount: t.lines?.[0]?.debitAmount || t.lines?.[0]?.creditAmount || 0
    }))
  });
  
  // Create reversal expense and journal entry
  const reversalResult = await prisma.$transaction(async (tx) => {
    // Create reversal expense with negative amount
    const reversal = await tx.expense.create({
      data: {
        description: `REVERSAL: ${originalExpense.description}`,
        amount: -originalExpense.amount,  // Negative amount
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
    
    // Create reversal journal entry (Transaction with opposite TransactionLines)
    const reversalDate = new Date();
    const reversalReference = await generateReferenceNumber(tx, tenantId, reversalDate);
    
    const reversalTransaction = await tx.transaction.create({
      data: {
        tenantId,
        date: reversalDate,
        reference: reversalReference,
        description: `REVERSAL: Expense - ${originalExpense.description}`,
        entryType: 'Reversal',
        status: 'posted',
        sourceType: 'Expense',
        sourceId: reversal.id,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        branchId: originalExpense.branchId,
        isReversal: true,
        reversedTransactionId: originalJournalEntry.id,
        reversalReason: reasonValidation.reason,
        reversedAt: reversalDate,
        reversedById: userId,
        notes: `Reversal of expense: ${originalExpense.id} - ${reasonValidation.reason}`,
        lines: {
          create: originalJournalEntry.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            // Swap debit and credit for reversal
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            description: `REVERSAL: ${line.description || originalExpense.description}`
          }))
        }
      },
      include: {
        lines: {
          include: {
            account: true
          }
        }
      }
    });
    
    // Update account balances for each reversed line
    for (const line of reversalTransaction.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        line.debitAmount,
        line.creditAmount,
        tx
      );
    }
    
    // Reverse tax transactions
    const reversedTaxTransactions = [];
    for (const taxTx of taxTransactions) {
      const taxReversalNumber = await generateReversalReference('TAX-REV', tenantId);
      
      // Create reversal transaction for tax
      const taxReversal = await tx.transaction.create({
        data: {
          date: new Date(),
          description: `REVERSAL: ${taxTx.description}`,
          tenantId,
          reference: taxReversalNumber,
          status: 'posted',
          createdById: userId,
          entryType: 'Reversal',
          notes: `Reversal of tax transaction for expense - ${reasonValidation.reason}`,
          postedById: userId,
          postedDate: new Date(),
          sourceId: taxTx.id,
          sourceType: 'Tax-Reversal',
          branchId: taxTx.branchId || originalExpense.branchId,
          isReversal: true,
          reversedTransactionId: taxTx.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId
        }
      });
      
      // Create opposite journal entries for tax transaction
      for (const taxLine of taxTx.lines) {
        const taxReversalLine = await tx.transactionLine.create({
          data: {
            transactionId: taxReversal.id,
            lineNumber: taxLine.lineNumber,
            accountId: taxLine.accountId,
            // Swap debit and credit to reverse tax
            debitAmount: taxLine.creditAmount,
            creditAmount: taxLine.debitAmount,
            description: `REVERSAL: ${taxLine.description || taxTx.description}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Update tax account balance
        await updateAccountBalanceOnTransaction(
          taxLine.accountId,
          taxReversalLine.debitAmount,
          taxReversalLine.creditAmount,
          tx
        );
      }
      
      reversedTaxTransactions.push({
        originalTaxTransactionId: taxTx.id,
        reversalTaxTransactionId: taxReversal.id,
        taxAccountId: taxTx.lines[0]?.accountId,
        taxAccountName: taxTx.lines[0]?.account?.accountName,
        taxAmount: taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0
      });
    }
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Expense',
        entityId: originalExpense.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalExpenseId: originalExpense.id,
          reversalExpenseId: reversal.id,
          originalJournalEntryId: originalJournalEntry.id,
          reversalJournalEntryId: reversalTransaction.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalExpense.amount,
          reversalAmount: -originalExpense.amount,
          taxReversals: reversedTaxTransactions
        })
      }
    });
    
    return {
      reversal,
      journalEntry: reversalTransaction,
      taxReversals: reversedTaxTransactions
    };
  });
  
  // Return consistent structure
  return {
    reversal: reversalResult.reversal,
    taxReversals: reversalResult.taxReversals || []
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
  // Validate reversal reason
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }
  
  // Validate eligibility
  const eligibility = await validateReversalEligibility({
    transactionId: paymentId,
    transactionType: 'Payment',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalPayment = eligibility.transaction;
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalPayment.paymentDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Generate new reference number for reversal payment
  const reversalRef = await generateReversalReference('PAY-REV', tenantId);
  
  // Create reversal payment
  const reversalPayment = await prisma.$transaction(async (tx) => {
    // Create reversal payment with negative amount
    const reversal = await tx.payment.create({
      data: {
        invoiceId: originalPayment.invoiceId,
        amount: -originalPayment.amount,  // Negative amount
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
    
    // If payment had allocations, create opposite allocations
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
    
    // Update original payment status
    await tx.payment.update({
      where: { id: originalPayment.id },
      data: { status: 'Reversed' }
    });
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Payment',
        entityId: originalPayment.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalPayment.amount,
          reversalAmount: -originalPayment.amount
        })
      }
    });
    
    return reversal;
  });
  
  // Return consistent structure (payments don't have tax reversals)
  return {
    reversal: reversalPayment,
    taxReversals: []
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
  // Validate reversal reason
  const reasonValidation = validateReversalReason(reversalReason);
  if (!reasonValidation.isValid) {
    throw new Error(reasonValidation.error);
  }
  
  // Validate eligibility
  const eligibility = await validateReversalEligibility({
    transactionId: saleId,
    transactionType: 'Sale',
    tenantId
  });
  
  if (!eligibility.isValid) {
    throw new Error(eligibility.error);
  }
  
  const originalSale = eligibility.transaction;
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalSale.saleDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Find tax transactions linked to this sale
  const taxTransactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'Tax-Sale',
      sourceId: saleId,
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
  
  console.log('🔍 Found tax transactions for sale reversal:', {
    saleId,
    count: taxTransactions.length,
    taxTransactions: taxTransactions.map(t => ({
      id: t.id,
      description: t.description,
      taxAmount: t.lines?.[0]?.debitAmount || t.lines?.[0]?.creditAmount || 0
    }))
  });
  
  // Generate new sale number for reversal
  const reversalSaleNumber = await generateReversalReference('SL-REV', tenantId);
  
  // Create reversal sale
  const reversalSale = await prisma.$transaction(async (tx) => {
    // Create reversal sale with negative amounts
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
    
    // Create reversal sale items and restore inventory
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
      
      // Restore inventory for non-custom, non-service products
      if (!item.isCustom && item.productId && item.product && !item.product.isService) {
        try {
          // Restore product stock
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockLevel: {
                increment: item.quantity
              }
            }
          });
          
          // Create inventory transaction for audit trail (quantity stored as Int)
          try {
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId,
                type: 'reversal_restoration',
                quantity: Math.round(Math.max(0, item.quantity)),
                notes: `Reversal restoration for sale ${originalSale.saleNumber}: ${reasonValidation.reason}`,
                userId: userId,
                tenantId: tenantId
              }
            });
          } catch (invTxError) {
            console.warn('Could not create inventory transaction for reversal:', invTxError.message);
            // Continue - inventory was restored
          }
        } catch (inventoryError) {
          console.error(`Error restoring inventory for product ${item.productId}:`, inventoryError);
          // Continue with other items even if one fails
        }
      }
    }
    
    // Find and reverse journal entries (revenue and COGS) created for this sale
    const originalJournalEntries = await tx.transaction.findMany({
      where: {
        tenantId,
        sourceType: 'Sale',
        sourceId: originalSale.id,
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
    
    console.log('🔍 Found journal entries for sale reversal:', {
      saleId: originalSale.id,
      count: originalJournalEntries.length,
      entries: originalJournalEntries.map(e => ({
        id: e.id,
        description: e.description,
        entryType: e.entryType,
        linesCount: e.lines.length
      }))
    });
    
    // Reverse each journal entry
    const reversedJournalEntries = [];
    for (const journalEntry of originalJournalEntries) {
      const { generateReferenceNumber } = await import('@/lib/journalService');
      const reversalReference = await generateReferenceNumber(tx, tenantId, new Date());
      
      // Create reversal transaction
      const reversalJournalEntry = await tx.transaction.create({
        data: {
          tenantId,
          date: new Date(),
          reference: reversalReference,
          description: `REVERSAL: ${journalEntry.description}`,
          entryType: 'Reversal',
          status: 'posted',
          sourceType: 'Sale',
          sourceId: reversal.id,
          createdById: userId,
          postedById: userId,
          postedDate: new Date(),
          branchId: journalEntry.branchId || originalSale.branchId,
          isReversal: true,
          reversedTransactionId: journalEntry.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId,
          notes: `Reversal of journal entry for sale ${originalSale.saleNumber} - ${reasonValidation.reason}`,
          lines: {
            create: journalEntry.lines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              // Swap debit and credit to reverse
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              description: `REVERSAL: ${line.description || journalEntry.description}`
            }))
          }
        },
        include: {
          lines: {
            include: {
              account: true
            }
          }
        }
      });
      
      // Update account balances for each reversed line
      for (const line of reversalJournalEntry.lines) {
        await updateAccountBalanceOnTransaction(
          line.accountId,
          line.debitAmount,
          line.creditAmount,
          tx
        );
      }
      
      reversedJournalEntries.push({
        originalJournalEntryId: journalEntry.id,
        reversalJournalEntryId: reversalJournalEntry.id,
        description: journalEntry.description
      });
    }
    
    // Reverse any payments linked to this sale
    const originalPayments = await tx.payment.findMany({
      where: {
        saleId: originalSale.id,
        tenantId,
        status: 'Completed'
      },
      include: {
        allocations: {
          include: {
            paymentAccount: true
          }
        }
      }
    });
    
    console.log('🔍 Found payments for sale reversal:', {
      saleId: originalSale.id,
      count: originalPayments.length
    });
    
    const reversedPayments = [];
    for (const payment of originalPayments) {
      // Create reversal payment
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
      
      // Update original payment status
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
    
    // Reverse tax transactions
    const reversedTaxTransactions = [];
    for (const taxTx of taxTransactions) {
      const taxReversalNumber = await generateReversalReference('TAX-REV', tenantId);
      
      // Create reversal transaction for tax
      const taxReversal = await tx.transaction.create({
        data: {
          date: new Date(),
          description: `REVERSAL: ${taxTx.description}`,
          tenantId,
          reference: taxReversalNumber,
          status: 'posted',
          createdById: userId,
          entryType: 'Reversal',
          notes: `Reversal of tax transaction for sale ${originalSale.saleNumber} - ${reasonValidation.reason}`,
          postedById: userId,
          postedDate: new Date(),
          sourceId: taxTx.id,
          sourceType: 'Tax-Reversal',
          branchId: taxTx.branchId || originalSale.branchId,
          isReversal: true,
          reversedTransactionId: taxTx.id,
          reversalReason: reasonValidation.reason,
          reversedAt: new Date(),
          reversedById: userId
        }
      });
      
      // Create opposite journal entries for tax transaction
      for (const taxLine of taxTx.lines) {
        const taxReversalLine = await tx.transactionLine.create({
          data: {
            transactionId: taxReversal.id,
            lineNumber: taxLine.lineNumber,
            accountId: taxLine.accountId,
            // Swap debit and credit to reverse tax
            debitAmount: taxLine.creditAmount,
            creditAmount: taxLine.debitAmount,
            description: `REVERSAL: ${taxLine.description || taxTx.description}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Update tax account balance
        await updateAccountBalanceOnTransaction(
          taxLine.accountId,
          taxReversalLine.debitAmount,
          taxReversalLine.creditAmount,
          tx
        );
      }
      
      reversedTaxTransactions.push({
        originalTaxTransactionId: taxTx.id,
        reversalTaxTransactionId: taxReversal.id,
        taxAccountId: taxTx.lines[0]?.accountId,
        taxAccountName: taxTx.lines[0]?.account?.accountName,
        taxAmount: taxTx.lines[0]?.debitAmount || taxTx.lines[0]?.creditAmount || 0
      });
    }
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Sale',
        entityId: originalSale.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalSaleId: originalSale.id,
          reversalSaleId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalSale.total,
          reversalAmount: -originalSale.total,
          originalTaxAmount: originalSale.taxAmount,
          reversedTaxAmount: -originalSale.taxAmount,
          journalEntriesReversed: reversedJournalEntries.length,
          paymentsReversed: reversedPayments.length,
          taxReversals: reversedTaxTransactions,
          inventoryRestored: originalItems.filter(item => !item.isCustom && item.productId).length
        })
      }
    });
    
    return {
      reversal,
      taxReversals: reversedTaxTransactions
    };
  });
  
  return reversalSale;
}

/**
 * Creates a reversal for a supplier payment
 * @param {Object} params - Reversal parameters
 * @returns {Object} Created reversal supplier payment
 */
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
  
  // Check accounting period
  const periodCheck = await checkAccountingPeriodLock(tenantId, originalPayment.paymentDate);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }
  
  // Generate new payment number for reversal
  const reversalPaymentNumber = await generateReversalReference('SP-REV', tenantId);
  
  // Create reversal supplier payment
  const reversalPayment = await prisma.$transaction(async (tx) => {
    // Create reversal with negative amount
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
    
    // Create opposite allocations
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
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'SupplierPayment',
        entityId: originalPayment.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalPayment.totalAmount,
          reversalAmount: -originalPayment.totalAmount
        })
      }
    });
    
    return reversal;
  });
  
  // Return consistent structure (supplier payments don't have tax reversals)
  return {
    reversal: reversalPayment,
    taxReversals: []
  };
}

/**
 * Gets reversal details for a transaction
 * @param {Object} params - Query parameters
 * @returns {Object} Reversal details
 */
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
        if (original?.reversedTransactionId) {
          try {
            reversal = await prisma.invoice.findFirst({
              where: { 
                id: original.reversedTransactionId,
                tenantId: tenantId
              }
            });
          } catch (reversalError) {
            console.error('Error querying reversal invoice:', reversalError);
            // Continue without reversal if query fails
          }
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
      if (original?.reversedTransactionId) {
        reversal = await prisma.expense.findFirst({
          where: { 
            id: original.reversedTransactionId,
            tenantId: tenantId
          }
        });
      }
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
      if (original?.reversedTransactionId) {
        reversal = await prisma.payment.findFirst({
          where: { 
            id: original.reversedTransactionId,
            tenantId: tenantId
          }
        });
      }
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
      if (original?.reversedTransactionId) {
        reversal = await prisma.sale.findFirst({
          where: { 
            id: original.reversedTransactionId,
            tenantId: tenantId
          }
        });
      }
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
      if (original?.reversedTransactionId) {
        reversal = await prisma.supplierPayment.findFirst({
          where: { 
            id: original.reversedTransactionId,
            tenantId: tenantId
          }
        });
      }
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
      if (original?.reversedTransactionId) {
        reversal = await prisma.transaction.findFirst({
          where: { 
            id: original.reversedTransactionId,
            tenantId: tenantId
          },
          include: { lines: true }
        });
      }
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
        if (transaction.sourceType === 'Payroll' && lines.length > 0) {
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

  const journalTransaction = await prisma.transaction.findFirst({
    where: {
      tenantId,
      sourceType: 'Payroll',
      sourceId: payrollId,
      status: 'posted',
      isReversal: false,
      reversedTransactionId: null
    },
    include: { lines: true }
  });
  if (!journalTransaction) {
    throw new Error(
      'No posted journal transaction found for this payroll. Reversal cannot be performed without GL entries (prevents partial state).'
    );
  }
  if (!journalTransaction.lines || journalTransaction.lines.length === 0) {
    throw new Error('Payroll journal transaction has no lines; cannot reverse.');
  }

  const periodCheck = await checkAccountingPeriodLock(tenantId, journalTransaction.date);
  if (periodCheck.isLocked) {
    throw new Error(periodCheck.error);
  }

  const result = await createTransactionReversal({
    transactionId: journalTransaction.id,
    reversalReason: reasonValidation.reason,
    userId,
    tenantId
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
