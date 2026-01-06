// lib/core.js
import prisma from './prisma';

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
  // Validate accounts
  const [sourceAccount, destinationAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: sourceAccountId, tenantId } }),
    prisma.account.findUnique({ where: { id: destinationAccountId, tenantId } })
  ]);

  if (!sourceAccount || !destinationAccount) {
    throw new Error('One or both accounts not found');
  }

  if (sourceAccount.balance < amount) {
    throw new Error('Insufficient balance in source account');
  }

  // Process the transfer using a transaction
  return await prisma.$transaction(async (tx) => {
    // Calculate new balances
    let newSourceBalance = sourceAccount.balance - amount;
    let newDestinationBalance = (destinationAccount.balance || 0) + amount;

    // For capital accounts, ensure balance doesn't go below 0
    if (sourceAccount.type === 'EQUITY' && sourceAccount.name.toLowerCase().includes('capital')) {
      newSourceBalance = Math.max(0, newSourceBalance);
    }

    // Update source account (decrease balance)
    await tx.account.update({
      where: { id: sourceAccountId },
      data: { balance: newSourceBalance }
    });

    // Update destination account (increase balance)
    await tx.account.update({
      where: { id: destinationAccountId },
      data: { balance: newDestinationBalance }
    });

    // Update AccountBalance models
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
      sourceAccount: { ...sourceAccount, balance: newSourceBalance },
      destinationAccount: { ...destinationAccount, balance: newDestinationBalance }
    };
  });
}
