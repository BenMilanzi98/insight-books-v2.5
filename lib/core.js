// lib/core.js
import prisma from './prisma';

/**
 * @deprecated Legacy payment-method mirror balances. New financial postings must use
 * postGlEntry → updateAccountBalanceOnTransaction. Phase 5 removes direct callers.
 */
export async function updateAccountBalance(
  tenantId,
  account,
  amount,
  operation = "add",
  db = prisma
) {
  // Check if account is an Account model ID (CUID format) or a payment method key
  const isAccountId = typeof account === 'string' && account.length > 20 && !account.includes('_');
  
  let currentBalance = 0;
  let accountRecord = null;
  
  // If it's an account ID, try to get balance from Account model first (more reliable)
  if (isAccountId) {
    try {
      accountRecord = await db.account.findUnique({
        where: { id: account, tenantId },
        select: { id: true, balance: true, type: true, name: true }
      });
      if (accountRecord) {
        currentBalance = accountRecord.balance || 0;
      }
    } catch (error) {
      // Account not found, will use AccountBalance instead
    }
  }
  
  // If we don't have balance from Account model, try AccountBalance
  if (!accountRecord) {
    const accountBalanceRecord = await db.accountBalance.findUnique({
      where: { tenantId_account: { tenantId, account } }
    });
    if (accountBalanceRecord) {
      currentBalance = accountBalanceRecord.balance || 0;
    }
  }

  // Calculate new balance
  let newBalance = operation === "add" 
    ? currentBalance + amount
    : currentBalance - amount;

  // For capital accounts, ensure balance doesn't go below 0
  const isCapitalAccount = accountRecord 
    ? (accountRecord.type === 'EQUITY' && accountRecord.name?.toLowerCase().includes('capital'))
    : (typeof account === 'string' && account.includes('capital'));
    
  if (isCapitalAccount) {
    newBalance = Math.max(0, newBalance);
  } else if (typeof account === 'string') {
    // For other accounts, also prevent negative balances
    newBalance = Math.max(0, newBalance);
  }

  // Update AccountBalance model
  await db.accountBalance.upsert({
    where: { tenantId_account: { tenantId, account } },
    update: { balance: newBalance },
    create: { tenantId, account, balance: newBalance }
  });

  // Also update the Account model balance if account is an ID
  if (isAccountId && accountRecord) {
    try {
      await db.account.update({
        where: { id: account },
        data: { balance: newBalance }
      });
    } catch (error) {
      console.error('Error updating Account model balance:', error);
    }
  }
}

export async function updateAccountBalanceById(tenantId, accountId, amount, operation = "add") {
  // Update Account model balance
  const account = await prisma.account.findUnique({
    where: { id: accountId, tenantId }
  });

  if (!account) {
    throw new Error('Account not found');
  }

  let newBalance = operation === "add" 
    ? (account.balance || 0) + amount
    : (account.balance || 0) - amount;

  // For capital accounts, ensure balance doesn't go below 0
  if (account.type === 'EQUITY' && account.name.toLowerCase().includes('capital')) {
    newBalance = Math.max(0, newBalance);
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { balance: newBalance }
  });

  // Also update AccountBalance model
  await prisma.accountBalance.upsert({
    where: { tenantId_account: { tenantId, account: accountId } },
    update: { balance: newBalance },
    create: { tenantId, account: accountId, balance: newBalance }
  });

  return newBalance;
}

export async function processCapitalTransfer(tenantId, sourceAccountId, destinationAccountId, amount, description) {
  // Validate accounts - check both Account and PaymentAccount models
  const [sourceAccount, destinationAccount, sourcePaymentAccount, destinationPaymentAccount] = await Promise.all([
    prisma.account.findFirst({ 
      where: { 
        id: sourceAccountId, 
        tenantId,
        isActive: true 
      } 
    }),
    prisma.account.findFirst({ 
      where: { 
        id: destinationAccountId, 
        tenantId,
        isActive: true 
      } 
    }),
    // Also check PaymentAccount model
    prisma.paymentAccount.findFirst({
      where: {
        id: sourceAccountId,
        tenantId,
        isActive: true
      }
    }),
    prisma.paymentAccount.findFirst({
      where: {
        id: destinationAccountId,
        tenantId,
        isActive: true
      }
    })
  ]);

  // Determine which model to use for source and destination
  const source = sourceAccount || sourcePaymentAccount;
  const destination = destinationAccount || destinationPaymentAccount;

  if (!source || !destination) {
    const missing = [];
    if (!source) missing.push('source');
    if (!destination) missing.push('destination');
    throw new Error(`Account(s) not found or inactive: ${missing.join(', ')}`);
  }

  // Get actual account balance from transactions (not just Account.balance field)
  const { getAccountBalanceDetails } = await import('./accountBalanceService');
  let sourceBalance = 0;
  let destinationBalance = 0;

  try {
    if (sourceAccount) {
      const sourceDetails = await getAccountBalanceDetails(sourceAccountId, tenantId);
      sourceBalance = sourceDetails.balance || 0;
    } else if (sourcePaymentAccount) {
      // For PaymentAccount, check AccountBalance table or use currentBalance
      const accountBalance = await prisma.accountBalance.findFirst({
        where: {
          tenantId,
          account: sourcePaymentAccount.id
        }
      });
      sourceBalance = accountBalance?.balance || sourcePaymentAccount.currentBalance || 0;
    }
  } catch (error) {
    console.warn('Could not get source account balance, using stored balance:', error.message);
    sourceBalance = sourceAccount?.balance || sourcePaymentAccount?.currentBalance || 0;
  }

  try {
    if (destinationAccount) {
      const destDetails = await getAccountBalanceDetails(destinationAccountId, tenantId);
      destinationBalance = destDetails.balance || 0;
    } else if (destinationPaymentAccount) {
      const accountBalance = await prisma.accountBalance.findFirst({
        where: {
          tenantId,
          account: destinationPaymentAccount.id
        }
      });
      destinationBalance = accountBalance?.balance || destinationPaymentAccount.currentBalance || 0;
    }
  } catch (error) {
    console.warn('Could not get destination account balance, using stored balance:', error.message);
    destinationBalance = destinationAccount?.balance || destinationPaymentAccount?.currentBalance || 0;
  }

  // Validate sufficient balance
  if (sourceBalance < amount) {
    throw new Error(`Insufficient balance in source account. Available: ${sourceBalance}, Required: ${amount}`);
  }

  // Process the transfer using a transaction
  return await prisma.$transaction(async (tx) => {
    // Calculate new balances
    let newSourceBalance = sourceBalance - amount;
    let newDestinationBalance = destinationBalance + amount;

    // For capital accounts, ensure balance doesn't go below 0
    const isCapitalAccount = sourceAccount && (
      sourceAccount.accountType === 'Equity' || 
      sourceAccount.accountType === 'EQUITY' ||
      (sourceAccount.accountName && sourceAccount.accountName.toLowerCase().includes('capital'))
    );
    
    if (isCapitalAccount) {
      newSourceBalance = Math.max(0, newSourceBalance);
    }

    // Update source account (decrease balance)
    if (sourceAccount) {
      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: newSourceBalance }
      });
    } else if (sourcePaymentAccount) {
      await tx.paymentAccount.update({
        where: { id: sourceAccountId },
        data: { currentBalance: newSourceBalance }
      });
    }

    // Update destination account (increase balance)
    if (destinationAccount) {
      await tx.account.update({
        where: { id: destinationAccountId },
        data: { balance: newDestinationBalance }
      });
    } else if (destinationPaymentAccount) {
      await tx.paymentAccount.update({
        where: { id: destinationAccountId },
        data: { currentBalance: newDestinationBalance }
      });
    }

    // Update AccountBalance models for both accounts
    await tx.accountBalance.upsert({
      where: { tenantId_account: { tenantId, account: sourceAccountId } },
      update: { balance: newSourceBalance },
      create: { tenantId, account: sourceAccountId, balance: newSourceBalance }
    });

    await tx.accountBalance.upsert({
      where: { tenantId_account: { tenantId, account: destinationAccountId } },
      update: { balance: newDestinationBalance },
      create: { tenantId, account: destinationAccountId, balance: newDestinationBalance }
    });

    return {
      sourceAccount: sourceAccount ? { ...sourceAccount, balance: newSourceBalance } : { ...sourcePaymentAccount, currentBalance: newSourceBalance },
      destinationAccount: destinationAccount ? { ...destinationAccount, balance: newDestinationBalance } : { ...destinationPaymentAccount, currentBalance: newDestinationBalance }
    };
  });
}
