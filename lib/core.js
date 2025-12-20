// lib/core.js
import prisma from './prisma';

export async function updateAccountBalance(
  tenantId,
  account,
  amount,
  operation = "add",
  db = prisma
) {
  // Update AccountBalance model
  const current = await db.accountBalance.findUnique({
    where: { tenantId_account: { tenantId, account } }
  });

  let newBalance = operation === "add" 
    ? (current?.balance || 0) + amount
    : (current?.balance || 0) - amount;

  // For capital accounts, ensure balance doesn't go below 0
  if (typeof account === 'string' && account.includes('capital')) {
    newBalance = Math.max(0, newBalance);
  } else if (typeof account === 'string') {
    // For other accounts, also prevent negative balances
    newBalance = Math.max(0, newBalance);
  }

  await db.accountBalance.upsert({
    where: { tenantId_account: { tenantId, account } },
    update: { balance: newBalance },
    create: { tenantId, account, balance: newBalance }
  });

  // Also update the Account model balance if account is an ID
  try {
    await db.account.update({
      where: { id: account },
      data: { balance: newBalance }
    });
  } catch (error) {
    // If account is not an ID, it might be a string identifier, so we skip Account model update
    console.log('Account model update skipped - account might be a string identifier');
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
