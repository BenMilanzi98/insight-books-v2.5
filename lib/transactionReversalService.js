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
    
    // Create opposite journal entries
    for (const line of originalLines) {
      await tx.transactionLine.create({
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
    }
    
    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'TRANSACTION_REVERSED',
        entityType: 'Transaction',
        entityId: originalTransaction.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          originalTransactionId: originalTransaction.id,
          reversalTransactionId: reversal.id,
          reversalReason: reasonValidation.reason,
          originalAmount: originalTransaction.amount || 0,
          reversalAmount: -(originalTransaction.amount || 0)
        })
      }
    });
    
    return reversal;
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
      where: { invoiceId: originalInvoice.id }
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
          reversalAmount: -originalInvoice.total
        })
      }
    });
    
    return reversal;
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
          reversalAmount: -originalExpense.amount
        })
      }
    });
    
    return {
      expense: reversal,
      journalEntry: reversalTransaction
    };
  });
  
  return reversalResult;
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
  
  return reversalPayment;
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
    
    // Create reversal sale items
    const originalItems = await tx.saleItem.findMany({
      where: { saleId: originalSale.id }
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
          reversalAmount: -originalSale.total
        })
      }
    });
    
    return reversal;
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
  
  return reversalPayment;
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
        include: { lines: true }
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
    
    return {
      original,
      reversal,
      isReversed: !!reversal,
      auditRecords
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
        if (!isNaN(invoiceTax) && invoiceTax > 0) {
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
        impact.originalAmount = saleTotal;
        impact.reversalAmount = -saleTotal;
        impact.netEffect = 0;
        
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
        impact.affectedAccounts = lines.map(l => ({
          accountId: l.accountId,
          accountName: l.account?.name,
          originalDebit: l.debitAmount,
          originalCredit: l.creditAmount,
          reversalDebit: l.creditAmount,
          reversalCredit: l.debitAmount
        }));
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
  generateReversalReference
};
