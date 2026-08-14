// lib/core.js
import prisma from './prisma';

/**
 * @deprecated Fresh-books V2: Account.balance / AccountBalance are not financial SoT.
 * @throws {{code: 'LEGACY_BALANCE_MUTATION_DISABLED'}}
 */
export async function updateAccountBalance(
  _tenantId,
  _account,
  _amount,
  _operation = "add",
  _db = prisma
) {
  const err = new Error(
    'Legacy Account.balance mutations are disabled (fresh-books V2 cutover). Use V2 journal posting/reversal.'
  );
  err.code = 'LEGACY_BALANCE_MUTATION_DISABLED';
  throw err;
}

/**
 * @deprecated Fresh-books V2: Account.balance is not financial SoT.
 * @throws {{code: 'LEGACY_BALANCE_MUTATION_DISABLED'}}
 */
export async function updateAccountBalanceById(_tenantId, _accountId, _amount, _operation = "add") {
  const err = new Error(
    'Legacy Account.balance mutations are disabled (fresh-books V2 cutover). Use V2 journal posting/reversal.'
  );
  err.code = 'LEGACY_BALANCE_MUTATION_DISABLED';
  throw err;
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

  // Get actual account balance — PaymentAccounts use posted GL (same as /payments UI)
  const { getAccountBalanceDetails } = await import('./accountBalanceService');
  const { resolvePaymentAccountSpendableBalance } = await import('./paymentAccountPostedGlBalance');
  let sourceBalance = 0;
  let destinationBalance = 0;

  try {
    if (sourceAccount) {
      const sourceDetails = await getAccountBalanceDetails(sourceAccountId, tenantId);
      sourceBalance = sourceDetails.balance || 0;
      if (sourceAccount.balance != null) {
        const stored = parseFloat(sourceAccount.balance);
        if (!Number.isNaN(stored) && stored > sourceBalance) sourceBalance = stored;
      }
    } else if (sourcePaymentAccount) {
      sourceBalance = await resolvePaymentAccountSpendableBalance(
        tenantId,
        sourcePaymentAccount,
        prisma
      );
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
      destinationBalance = await resolvePaymentAccountSpendableBalance(
        tenantId,
        destinationPaymentAccount,
        prisma
      );
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
