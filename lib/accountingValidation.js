// lib/accountingValidation.js
/**
 * Accounting Validation Utilities
 * Ensures all accounting entries follow double-entry principles
 */

/**
 * Validate that transaction lines balance (total debits = total credits)
 * @param {Array} lines - Array of transaction lines with debitAmount and creditAmount
 * @returns {Object} Validation result with isValid, totalDebits, totalCredits, difference
 */
export function validateTransactionBalance(lines) {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return {
      isValid: false,
      error: 'Transaction must have at least one line',
      totalDebits: 0,
      totalCredits: 0,
      difference: 0
    };
  }

  // Calculate totals
  const totalDebits = lines.reduce((sum, line) => {
    const debit = parseFloat(line.debitAmount || 0);
    return sum + (isNaN(debit) ? 0 : debit);
  }, 0);

  const totalCredits = lines.reduce((sum, line) => {
    const credit = parseFloat(line.creditAmount || 0);
    return sum + (isNaN(credit) ? 0 : credit);
  }, 0);

  const difference = Math.abs(totalDebits - totalCredits);
  const tolerance = 0.01; // Allow 0.01 rounding tolerance

  return {
    isValid: difference <= tolerance,
    totalDebits,
    totalCredits,
    difference,
    error: difference > tolerance 
      ? `Transaction does not balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      : null
  };
}

/**
 * Validate account exists and is active
 * @param {Object} account - Account object
 * @returns {Object} Validation result
 */
export function validateAccount(account) {
  if (!account) {
    return {
      isValid: false,
      error: 'Account is required'
    };
  }

  if (!account.isActive) {
    return {
      isValid: false,
      error: `Account ${account.accountName || account.name} is inactive`
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Validate that all transaction lines reference valid accounts
 * @param {Array} lines - Array of transaction lines
 * @param {Array} accounts - Array of account objects (from database)
 * @returns {Object} Validation result
 */
export function validateAccountReferences(lines, accounts) {
  if (!lines || !Array.isArray(lines)) {
    return {
      isValid: false,
      error: 'Transaction lines are required',
      invalidAccounts: []
    };
  }

  const accountMap = new Map(accounts.map(acc => [acc.id, acc]));
  const invalidAccounts = [];

  for (const line of lines) {
    if (!line.accountId) {
      invalidAccounts.push({
        lineNumber: line.lineNumber,
        error: 'Account ID is required'
      });
      continue;
    }

    const account = accountMap.get(line.accountId);
    if (!account) {
      invalidAccounts.push({
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        error: 'Account not found'
      });
    } else if (!account.isActive) {
      invalidAccounts.push({
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        accountName: account.accountName || account.name,
        error: 'Account is inactive'
      });
    }
  }

  return {
    isValid: invalidAccounts.length === 0,
    error: invalidAccounts.length > 0 
      ? `Invalid account references: ${invalidAccounts.map(a => a.error).join(', ')}`
      : null,
    invalidAccounts
  };
}

/**
 * Validate transaction before creation
 * @param {Object} transactionData - Transaction data with lines
 * @param {Array} accounts - Array of account objects
 * @returns {Object} Validation result
 */
export function validateTransaction(transactionData, accounts = []) {
  const errors = [];
  const warnings = [];

  // Validate lines exist
  if (!transactionData.lines || !Array.isArray(transactionData.lines) || transactionData.lines.length < 2) {
    errors.push('Transaction must have at least 2 lines (double-entry requirement)');
  }

  // Validate balance
  if (transactionData.lines) {
    const balanceValidation = validateTransactionBalance(transactionData.lines);
    if (!balanceValidation.isValid) {
      errors.push(balanceValidation.error);
    }
  }

  // Validate account references if accounts provided
  if (accounts.length > 0 && transactionData.lines) {
    const accountValidation = validateAccountReferences(transactionData.lines, accounts);
    if (!accountValidation.isValid) {
      errors.push(accountValidation.error);
    }
  }

  // Validate required fields
  if (!transactionData.date) {
    errors.push('Transaction date is required');
  }

  if (!transactionData.description) {
    errors.push('Transaction description is required');
  }

  if (!transactionData.tenantId) {
    errors.push('Tenant ID is required');
  }

  // Validate line numbers are unique and sequential
  if (transactionData.lines) {
    const lineNumbers = transactionData.lines.map(l => l.lineNumber).sort((a, b) => a - b);
    const expectedNumbers = Array.from({ length: lineNumbers.length }, (_, i) => i + 1);
    if (JSON.stringify(lineNumbers) !== JSON.stringify(expectedNumbers)) {
      warnings.push('Line numbers should be sequential starting from 1');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    hasWarnings: warnings.length > 0
  };
}

/**
 * Validate balance sheet equation: Assets = Liabilities + Equity
 * @param {Object} balances - Object with assetTotal, liabilityTotal, equityTotal
 * @returns {Object} Validation result
 */
export function validateBalanceSheetEquation(balances) {
  const { assetTotal = 0, liabilityTotal = 0, equityTotal = 0 } = balances;
  
  const leftSide = assetTotal;
  const rightSide = liabilityTotal + equityTotal;
  const difference = Math.abs(leftSide - rightSide);
  const tolerance = 0.01;

  return {
    isValid: difference <= tolerance,
    assetTotal,
    liabilityTotal,
    equityTotal,
    rightSideTotal: rightSide,
    difference,
    error: difference > tolerance
      ? `Balance sheet does not balance. Assets: ${assetTotal.toFixed(2)}, Liabilities + Equity: ${rightSide.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      : null
  };
}

/**
 * Calculate account balance from transaction lines
 * @param {String} accountId - Account ID
 * @param {Array} transactionLines - Array of TransactionLine objects
 * @param {Number} openingBalance - Opening balance for the account
 * @returns {Number} Current balance
 */
export function calculateAccountBalance(accountId, transactionLines, openingBalance = 0) {
  const accountLines = transactionLines.filter(line => line.accountId === accountId);
  
  const totalDebits = accountLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
  const totalCredits = accountLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);

  // For asset/expense accounts: balance = opening + debits - credits
  // For liability/equity/revenue accounts: balance = opening + credits - debits
  // We'll determine this based on the account type, but for now use a simple calculation
  // The account's normalBalance field should be used to determine the correct calculation
  
  return openingBalance + totalDebits - totalCredits;
}










