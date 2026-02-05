/**
 * Reversal Validation Utilities
 * 
 * Comprehensive validation for transaction reversals including:
 * - Reversal reason validation
 * - Transaction eligibility checks
 * - Impact calculation for preview
 * - Edge case handling
 */

/**
 * Validates reversal reason according to business rules
 * @param {string} reason - The reversal reason to validate
 * @returns {Object} Validation result with isValid and error/sanitizedReason
 */
function validateReversalReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return {
      isValid: false,
      error: 'Reversal reason is required'
    };
  }

  const trimmedReason = reason.trim();

  // Minimum length check
  if (trimmedReason.length < 10) {
    return {
      isValid: false,
      error: 'Reversal reason must be at least 10 characters long'
    };
  }

  // Maximum length check
  if (trimmedReason.length > 1000) {
    return {
      isValid: false,
      error: 'Reversal reason cannot exceed 1000 characters'
    };
  }

  // Check for offensive or inappropriate content (basic sanitization)
  const offensivePatterns = [
    /test/i,
    /^n\/a$/i,
    /^\s*$/,
    /pending/i
  ];

  for (const pattern of offensivePatterns) {
    if (pattern.test(trimmedReason)) {
      return {
        isValid: false,
        error: 'Reversal reason must provide specific details about the reversal'
      };
    }
  }

  return {
    isValid: true,
    reason: trimmedReason
  };
}

/**
 * Validates transaction eligibility for reversal
 * @param {Object} transaction - Transaction object to validate
 * @returns {Object} Eligibility result with isEligible and reasons array
 */
function validateTransactionEligibility(transaction) {
  const reasons = [];
  let warnings = [];

  if (!transaction) {
    return {
      isEligible: false,
      reasons: ['Transaction not found'],
      warnings: []
    };
  }

  // Check if already reversed
  if (transaction.isReversal) {
    reasons.push('Transaction is already a reversal');
  }

  // Check for existing reversal
  if (transaction.reversedTransactionId) {
    reasons.push('Transaction has already been reversed');
  }

  // Type-specific validations
  switch (transaction.sourceType || transaction.constructor?.name) {
    case 'Invoice':
      if (transaction.status === 'draft') {
        reasons.push('Draft invoices cannot be reversed');
      }
      if (transaction.status === 'voided') {
        reasons.push('Voided invoices cannot be reversed');
      }
      if (transaction.totalPaid > 0 && transaction.totalPaid < transaction.total) {
        warnings.push('Invoice has partial payments - all payments will be reversed');
      }
      if (transaction.totalPaid >= transaction.total && transaction.totalPaid > 0) {
        reasons.push('Fully paid invoices require refund processing before reversal');
      }
      break;

    case 'Expense':
      if (transaction.status === 'draft') {
        reasons.push('Draft expenses cannot be reversed');
      }
      if (transaction.isDeleted) {
        reasons.push('Deleted expenses cannot be reversed');
      }
      break;

    case 'Sale':
      if (transaction.status === 'draft') {
        reasons.push('Draft sales cannot be reversed');
      }
      break;

    case 'Payment':
      if (transaction.status !== 'Completed' && transaction.status !== 'Reversed') {
        reasons.push('Only completed payments can be reversed');
      }
      break;

    case 'Transaction':
      if (transaction.status !== 'posted') {
        reasons.push('Only posted transactions can be reversed');
      }
      break;
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
    warnings
  };
}

/**
 * Calculates the reversal impact on various account types
 * @param {Object} transaction - Original transaction
 * @param {string} transactionType - Type of transaction
 * @returns {Object} Impact analysis
 */
function calculateReversalImpact(transaction, transactionType) {
  const impact = {
    accounts: [],
    taxes: [],
    inventory: [],
    payments: [],
    warnings: [],
    summary: {
      originalAmount: 0,
      reversalAmount: 0,
      netEffect: 0,
      accountsAffected: 0
    }
  };

  if (!transaction) {
    return impact;
  }

  switch (transactionType) {
    case 'Invoice':
      impact.summary.originalAmount = transaction.total || 0;
      impact.summary.reversalAmount = -(transaction.total || 0);
      impact.summary.netEffect = 0;

      if (transaction.taxAmount) {
        impact.taxes.push({
          type: 'Sales Tax',
          original: transaction.taxAmount,
          reversal: -transaction.taxAmount,
          net: 0
        });
      }

      if (transaction.totalPaid > 0) {
        impact.warnings.push({
          type: 'PAYMENT_IMPACT',
          message: `${transaction.totalPaid} in payments will be reversed`,
          severity: 'high'
        });
      }
      break;

    case 'Expense':
      impact.summary.originalAmount = transaction.amount || 0;
      impact.summary.reversalAmount = -(transaction.amount || 0);
      impact.summary.netEffect = 0;

      if (transaction.paidAmount && transaction.paidAmount > 0) {
        impact.warnings.push({
          type: 'PAYMENT_IMPACT',
          message: `Expense has ${transaction.paidAmount} in payments that will be reversed`,
          severity: 'medium'
        });
      }
      break;

    case 'Sale':
      impact.summary.originalAmount = transaction.total || 0;
      impact.summary.reversalAmount = -(transaction.total || 0);
      impact.summary.netEffect = 0;

      impact.warnings.push({
        type: 'COGS_IMPACT',
        message: 'COGS entries will be reversed',
        severity: 'high'
      });

      if (transaction.items && transaction.items.length > 0) {
        impact.inventory.push({
          type: 'RESTOCK',
          items: transaction.items.map(item => ({
            productId: item.productId,
            description: item.description,
            quantity: -(item.quantity || 0)
          }))
        });
      }
      break;

    case 'Payment':
      impact.summary.originalAmount = transaction.amount || 0;
      impact.summary.reversalAmount = -(transaction.amount || 0);
      impact.summary.netEffect = 0;

      if (transaction.allocations && transaction.allocations.length > 0) {
        impact.payments = transaction.allocations.map(alloc => ({
          accountId: alloc.paymentAccountId,
          originalAmount: alloc.amount,
          reversalAmount: -alloc.amount
        }));
      }
      break;

    case 'Transaction':
      if (transaction.lines) {
        impact.accounts = transaction.lines.map(line => ({
          accountId: line.accountId,
          accountName: line.account?.name || 'Unknown',
          originalDebit: line.debitAmount || 0,
          originalCredit: line.creditAmount || 0,
          reversalDebit: line.creditAmount || 0,
          reversalCredit: line.debitAmount || 0
        }));
        impact.summary.accountsAffected = transaction.lines.length;
        impact.summary.originalAmount = transaction.lines.reduce(
          (sum, l) => sum + (l.debitAmount || 0) + (l.creditAmount || 0), 0
        );
        impact.summary.reversalAmount = -impact.summary.originalAmount;
      }
      break;
  }

  return impact;
}

/**
 * Checks for locked accounting periods
 * @param {Object} params - Parameters
 * @returns {Object} Period lock status
 */
async function checkLockedPeriod(tenantId, transactionDate, prisma) {
  try {
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: 'closed',
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate }
      }
    });

    if (period) {
      return {
        isLocked: true,
        periodName: period.name,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        error: `Cannot reverse transactions in closed accounting period: ${period.name}`
      };
    }

    return { isLocked: false };
  } catch (error) {
    // If accounting period table doesn't exist, allow reversal
    return { isLocked: false };
  }
}

/**
 * Validates reversal request completeness
 * @param {Object} request - Reversal request data
 * @returns {Object} Validation result
 */
function validateReversalRequest(request) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!request.transactionId) {
    errors.push('Transaction ID is required');
  }

  if (!request.transactionType) {
    errors.push('Transaction type is required');
  }

  if (!request.reversalReason) {
    errors.push('Reversal reason is required');
  }

  // Validate transaction type
  const validTypes = [
    'Invoice',
    'Expense', 
    'Payment',
    'Sale',
    'SupplierPayment',
    'Transaction'
  ];

  if (request.transactionType && !validTypes.includes(request.transactionType)) {
    errors.push(`Invalid transaction type: ${request.transactionType}`);
  }

  // Validate user authorization
  if (!request.userId) {
    errors.push('User authentication is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generates a comprehensive reversal preview
 * @param {Object} params - Parameters
 * @returns {Object} Preview with all relevant information
 */
async function getReversalPreview({ transactionId, transactionType, tenantId, prisma }) {
  // Get the transaction
  let transaction;

  switch (transactionType) {
    case 'Invoice':
      transaction = await prisma.invoice.findUnique({
        where: { id: transactionId },
        include: { items: true, client: true, payments: true }
      });
      break;
    case 'Expense':
      transaction = await prisma.expense.findUnique({
        where: { id: transactionId }
      });
      break;
    case 'Payment':
      transaction = await prisma.payment.findUnique({
        where: { id: transactionId },
        include: { allocations: true }
      });
      break;
    case 'Sale':
      transaction = await prisma.sale.findUnique({
        where: { id: transactionId },
        include: { items: true, payments: true }
      });
      break;
    case 'SupplierPayment':
      transaction = await prisma.supplierPayment.findUnique({
        where: { id: transactionId },
        include: { allocations: true }
      });
      break;
    case 'Transaction':
      transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { lines: { include: { account: true } } }
      });
      break;
  }

  if (!transaction) {
    return {
      found: false,
      error: 'Transaction not found'
    };
  }

  // Calculate eligibility
  const eligibility = validateTransactionEligibility(transaction);

  // Calculate impact
  const impact = calculateReversalImpact(transaction, transactionType);

  // Check period lock
  const transactionDate = transaction.date || transaction.issueDate || transaction.paymentDate;
  const periodLock = await checkLockedPeriod(tenantId, transactionDate, prisma);

  return {
    found: true,
    transaction: {
      id: transaction.id,
      type: transactionType,
      date: transactionDate,
      amount: transaction.total || transaction.amount || 0,
      status: transaction.status,
      reference: transaction.invoiceNumber || transaction.saleNumber || transaction.reference || null,
      description: transaction.description || transaction.notes || null,
      ...(transaction.client && { client: { id: transaction.client.id, name: transaction.client.name } }),
      ...(transaction.supplier && { supplier: { id: transaction.supplier.id, name: transaction.supplier.supplierName } })
    },
    eligibility,
    impact,
    periodLock,
    canReverse: eligibility.isEligible && !periodLock.isLocked
  };
}

module.exports = {
  validateReversalReason,
  validateTransactionEligibility,
  calculateReversalImpact,
  checkLockedPeriod,
  validateReversalRequest,
  getReversalPreview
};
