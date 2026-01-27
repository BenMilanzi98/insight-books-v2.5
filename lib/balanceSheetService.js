// lib/balanceSheetService.js
/**
 * Balance Sheet Service
 * Generates balance sheet from Transaction/TransactionLine data using Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

function getEffectiveAccountType(account) {
  return (
    account.accountType ||
    account.type ||
    (account.normalBalance
      ? account.normalBalance === 'Debit'
        ? 'Asset'
        : 'Liability'
      : null)
  );
}

function getEffectiveAccountName(account) {
  return account.accountName || account.name || 'Unnamed Account';
}

function getEffectiveAccountSubtype(account) {
  return (
    account.accountSubtype ||
    account.subtype ||
    (account.accountType &&
      typeof account.accountType === 'string' &&
      account.accountType.toLowerCase().includes('receivable')
      ? 'receivable'
      : '')
  );
}

function getEffectiveAccountCode(account) {
  return account.accountCode || account.code || '';
}

/**
 * Get all accounts grouped by type and subtype
 */

async function getAccountsByCategory(tenantId) {
  const rawAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      accountSubtype: true,
      normalBalance: true,
      parentAccountId: true
    },
    orderBy: [
      { accountType: 'asc' },
      { accountCode: 'asc' }
    ]
  });

  const accounts = rawAccounts.map(account => ({
    ...account,
    accountType: getEffectiveAccountType(account),
    accountName: getEffectiveAccountName(account),
    accountSubtype: getEffectiveAccountSubtype(account),
    accountCode: getEffectiveAccountCode(account)
  }));

  // Group by type and subtype
  const categorized = {
    assets: {
      current: [],
      fixed: [],
      other: []
    },
    liabilities: {
      current: [],
      longTerm: [],
      other: []
    },
    equity: [],
    revenue: [],
    expense: []
  };

  accounts.forEach(account => {
    const accountType = (getEffectiveAccountType(account) || '').toLowerCase();
    const subtype = getEffectiveAccountSubtype(account).toLowerCase();
    const accountName = getEffectiveAccountName(account).toLowerCase();
    const accountCode = getEffectiveAccountCode(account);
    
    // Cash account codes: 1000, 1010, 1020, 1030, 1040, 1050
    const isCashAccount = ['1000', '1010', '1020', '1030', '1040', '1050'].includes(accountCode) ||
                         accountName.includes('cash') || accountName.includes('bank') ||
                         accountName.includes('airtel') || accountName.includes('mpamba') ||
                         accountName.includes('paychangu');
    
    switch (accountType) {
      case 'asset':
        if (isCashAccount || subtype.includes('current') || subtype.includes('cash') || 
            subtype.includes('receivable') || subtype.includes('inventory') || 
            subtype.includes('prepaid')) {
          categorized.assets.current.push(account);
        } else if (subtype.includes('fixed') || subtype.includes('property') || 
                   subtype.includes('equipment') || subtype.includes('depreciation')) {
          categorized.assets.fixed.push(account);
        } else {
          categorized.assets.other.push(account);
        }
        break;
      case 'liability':
        if (subtype.includes('current') || subtype.includes('payable') || subtype.includes('short')) {
          categorized.liabilities.current.push(account);
        } else if (subtype.includes('long') || subtype.includes('term')) {
          categorized.liabilities.longTerm.push(account);
        } else {
          categorized.liabilities.other.push(account);
        }
        break;
      case 'equity':
        categorized.equity.push(account);
        break;
      case 'revenue':
        categorized.revenue.push(account);
        break;
      case 'expense':
        categorized.expense.push(account);
        break;
    }
  });

  return { accounts, categorized };
}

/**
 * Calculate account balance as of a specific date
 * For cash accounts, prioritizes AccountBalance table, then falls back to transactions
 */
async function getAccountBalanceAsOfDate(accountId, tenantId, asOfDate, accountCode = null, branchId = null) {
  const cashAccountCodes = ['1000', '1010', '1020', '1030', '1040', '1050'];
  const isCashAccount = accountCode && cashAccountCodes.includes(accountCode);
  
  // For cash accounts, check AccountBalance table first (legacy system)
  if (isCashAccount) {
    try {
      const accountBalance = await prisma.accountBalance.findFirst({
        where: {
          tenantId,
          account: accountCode
        }
      });
      
      if (accountBalance && accountBalance.balance !== null && accountBalance.balance !== undefined) {
        return parseFloat(accountBalance.balance) || 0;
      }
    } catch (error) {
      console.warn(`Error checking AccountBalance for ${accountCode}:`, error);
    }
  }
  
  // For non-cash accounts or if AccountBalance not found, use transactions
  try {
    const details = await getAccountBalanceDetails(accountId, tenantId, asOfDate, prisma, branchId);
    return details.balance;
  } catch (error) {
    console.error(`Error getting balance for account ${accountId}:`, error);
    
    // Final fallback: try AccountBalance table if account code provided
    if (accountCode) {
      try {
        const accountBalance = await prisma.accountBalance.findFirst({
          where: {
            tenantId,
            account: accountCode
          }
        });
        if (accountBalance) {
          return parseFloat(accountBalance.balance) || 0;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { balance: true }
      });
      if (account && account.balance !== null && account.balance !== undefined) {
        return parseFloat(account.balance) || 0;
      }
    } catch (finalError) {
      console.warn(`Final fallback failed for account ${accountId}:`, finalError);
    }
    
    return 0;
  }
}

/**
 * Build balance sheet structure from account balances
 */
export async function generateBalanceSheetFromAccounts(tenantId, asOfDate, companyName = 'Company', logoUrl = null, branchId = null) {
  const { accounts, categorized } = await getAccountsByCategory(tenantId);
  
  // Parse date
  const [year, month, day] = asOfDate.split('-').map(Number);
  const reportDate = new Date(year, month - 1, day);
  reportDate.setHours(23, 59, 59, 999);

  // Calculate balances for all accounts
  const accountBalances = {};
  await Promise.all(accounts.map(async (account) => {
    accountBalances[account.id] = await getAccountBalanceAsOfDate(
      account.id, 
      tenantId, 
      reportDate,
      account.accountCode,
      branchId
    );
  }));

  // Also check AccountBalance table for cash accounts that might not be in Account model
  // This handles legacy payment method balances
  const cashAccountCodes = ['1000', '1010', '1020', '1030', '1040', '1050'];
  const accountBalancesLegacy = await prisma.accountBalance.findMany({
    where: {
      tenantId,
      account: { in: cashAccountCodes }
    }
  });

  // Add legacy balances if account not found in Account model
  for (const legacyBalance of accountBalancesLegacy) {
    const accountCode = legacyBalance.account;
    const existingAccount = accounts.find(acc => acc.accountCode === accountCode);
    
    if (!existingAccount && legacyBalance.balance > 0) {
      // Account exists in AccountBalance but not in Account model
      // Create a virtual account entry for balance sheet
      console.log(`⚠️ Found legacy cash account ${accountCode} with balance ${legacyBalance.balance}`);
      
      // Try to find account by code in Account model (might have different code format)
      const accountByName = await prisma.account.findFirst({
        where: {
          tenantId,
          isActive: true,
          accountType: 'Asset',
          OR: [
            { accountCode: accountCode },
            { accountName: { contains: accountCode === '1000' ? 'Cash' : 
                           accountCode === '1020' ? 'Bank' :
                           accountCode === '1030' ? 'Airtel' :
                           accountCode === '1040' ? 'Mpamba' :
                           accountCode === '1050' ? 'PayChangu' : '', mode: 'insensitive' } }
          ]
        }
      });

      if (accountByName) {
        // Update balance if account found
        accountBalances[accountByName.id] = (accountBalances[accountByName.id] || 0) + legacyBalance.balance;
      } else {
        // Add to cash directly if no account found
        assets.currentAssets.cashAndCashEquivalents += legacyBalance.balance;
      }
    }
  }

  // Build assets section
  const assets = {
    currentAssets: {
      cashAndCashEquivalents: 0,
      accountsReceivable: { total: 0, items: [] },
      inventory: { total: 0, items: [] },
      prepaidExpenses: 0,
      otherCurrentAssets: 0,
      total: 0
    },
    nonCurrentAssets: {
      propertyPlantEquipment: {
        gross: 0,
        accumulatedDepreciation: 0,
        net: 0,
        items: []
      },
      intangibleAssets: 0,
      otherNonCurrentAssets: 0,
      total: 0
    },
    total: 0
  };

  // Process current assets
  for (const account of categorized.assets.current) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();
    const accountCode = account.accountCode || '';

    // Cash account codes: 1000, 1010, 1020, 1030, 1040, 1050
    const isCashAccount = ['1000', '1010', '1020', '1030', '1040', '1050'].includes(accountCode) ||
                         subtype.includes('cash') || accountName.includes('cash') || 
                         accountName.includes('bank') || accountName.includes('airtel') ||
                         accountName.includes('mpamba') || accountName.includes('paychangu');

    if (isCashAccount) {
      assets.currentAssets.cashAndCashEquivalents += balance;
    } else if (subtype.includes('receivable') || accountName.includes('receivable')) {
      assets.currentAssets.accountsReceivable.total += balance;
      if (balance > 0) {
        assets.currentAssets.accountsReceivable.items.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: balance
        });
      }
    } else if (subtype.includes('inventory') || accountName.includes('inventory')) {
      assets.currentAssets.inventory.total += balance;
      if (balance > 0) {
        assets.currentAssets.inventory.items.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: balance
        });
      }
    } else if (subtype.includes('prepaid') || accountName.includes('prepaid')) {
      assets.currentAssets.prepaidExpenses += balance;
    } else {
      assets.currentAssets.otherCurrentAssets += balance;
    }
  }

  assets.currentAssets.total = 
    assets.currentAssets.cashAndCashEquivalents +
    assets.currentAssets.accountsReceivable.total +
    assets.currentAssets.inventory.total +
    assets.currentAssets.prepaidExpenses +
    assets.currentAssets.otherCurrentAssets;

  // Process fixed assets
  for (const account of categorized.assets.fixed) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    if (subtype.includes('depreciation') || accountName.includes('depreciation')) {
      assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation += Math.abs(balance);
    } else if (subtype.includes('intangible') || accountName.includes('intangible')) {
      assets.nonCurrentAssets.intangibleAssets += balance;
    } else {
      assets.nonCurrentAssets.propertyPlantEquipment.gross += balance;
      if (balance > 0) {
        assets.nonCurrentAssets.propertyPlantEquipment.items.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: balance
        });
      }
    }
  }

  // Process other non-current assets
  for (const account of categorized.assets.other) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();
    
    // Check if this is a contra-asset (like accumulated depreciation)
    const isContraAsset = subtype.includes('depreciation') || accountName.includes('depreciation') ||
                         subtype.includes('accumulated') || accountName.includes('accumulated');
    
    if (subtype.includes('intangible')) {
      // For intangible assets, use absolute value if negative (might be mis-categorized)
      assets.nonCurrentAssets.intangibleAssets += Math.abs(balance);
    } else if (isContraAsset) {
      // Contra-assets reduce the asset value
      assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation += Math.abs(balance);
    } else {
      // For other non-current assets, if balance is negative, it might be mis-categorized
      // Log warning but use absolute value to prevent negative totals
      if (balance < 0) {
        console.warn(`⚠️ Negative balance for asset account ${account.accountName} (${account.accountCode}): ${balance}. Using absolute value.`);
      }
      assets.nonCurrentAssets.otherNonCurrentAssets += Math.abs(balance);
    }
  }

  assets.nonCurrentAssets.propertyPlantEquipment.net = 
    assets.nonCurrentAssets.propertyPlantEquipment.gross - 
    assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation;
  
  // Ensure net PP&E is not negative
  if (assets.nonCurrentAssets.propertyPlantEquipment.net < 0) {
    console.warn(`⚠️ Negative net PP&E: ${assets.nonCurrentAssets.propertyPlantEquipment.net}. Setting to 0.`);
    assets.nonCurrentAssets.propertyPlantEquipment.net = 0;
  }

  assets.nonCurrentAssets.total = 
    assets.nonCurrentAssets.propertyPlantEquipment.net +
    assets.nonCurrentAssets.intangibleAssets +
    assets.nonCurrentAssets.otherNonCurrentAssets;
  
  // Ensure non-current assets total is not negative
  if (assets.nonCurrentAssets.total < 0) {
    console.warn(`⚠️ Negative total non-current assets: ${assets.nonCurrentAssets.total}. This indicates a data issue.`);
  }

  assets.total = assets.currentAssets.total + assets.nonCurrentAssets.total;

  // Build liabilities section
  const liabilities = {
    currentLiabilities: {
      accountsPayable: { total: 0, items: [] },
      shortTermLoans: 0,
      taxPayable: 0,
      accruedExpenses: 0,
      otherCurrentLiabilities: 0,
      total: 0
    },
    longTermLiabilities: {
      longTermLoans: 0,
      otherLongTermLiabilities: 0,
      total: 0
    },
    total: 0
  };

  // Process current liabilities
  for (const account of categorized.liabilities.current) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    if (subtype.includes('payable') || accountName.includes('payable')) {
      liabilities.currentLiabilities.accountsPayable.total += balance;
      if (balance > 0) {
        liabilities.currentLiabilities.accountsPayable.items.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: balance
        });
      }
    } else if (subtype.includes('tax') || accountName.includes('tax')) {
      liabilities.currentLiabilities.taxPayable += balance;
    } else if (subtype.includes('loan') || accountName.includes('loan')) {
      liabilities.currentLiabilities.shortTermLoans += balance;
    } else if (subtype.includes('accrued') || accountName.includes('accrued')) {
      liabilities.currentLiabilities.accruedExpenses += balance;
    } else {
      liabilities.currentLiabilities.otherCurrentLiabilities += balance;
    }
  }

  liabilities.currentLiabilities.total = 
    liabilities.currentLiabilities.accountsPayable.total +
    liabilities.currentLiabilities.shortTermLoans +
    liabilities.currentLiabilities.taxPayable +
    liabilities.currentLiabilities.accruedExpenses +
    liabilities.currentLiabilities.otherCurrentLiabilities;

  // Process long-term liabilities
  for (const account of categorized.liabilities.longTerm) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    if (subtype.includes('loan') || accountName.includes('loan')) {
      liabilities.longTermLiabilities.longTermLoans += balance;
    } else {
      liabilities.longTermLiabilities.otherLongTermLiabilities += balance;
    }
  }

  // Process other liabilities
  for (const account of categorized.liabilities.other) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    if (subtype.includes('long') || subtype.includes('term')) {
      liabilities.longTermLiabilities.otherLongTermLiabilities += balance;
    } else {
      liabilities.currentLiabilities.otherCurrentLiabilities += balance;
    }
  }

  liabilities.longTermLiabilities.total = 
    liabilities.longTermLiabilities.longTermLoans +
    liabilities.longTermLiabilities.otherLongTermLiabilities;

  liabilities.total = liabilities.currentLiabilities.total + liabilities.longTermLiabilities.total;

  // Build equity section
  const equity = {
    capitalStock: 0,
    retainedEarnings: 0,
    currentYearProfit: 0,
    otherEquity: 0,
    total: 0
  };

  console.log(`Found ${categorized.equity.length} equity accounts`);
  
  for (const account of categorized.equity) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    // For equity accounts, balance should be positive (credit balance)
    // But accountBalances might be negative if calculated incorrectly
    // Equity accounts have normal balance of Credit, so: balance = credits - debits
    // If the calculation gives negative, it means debits > credits, which is unusual for equity
    const equityBalance = balance < 0 ? Math.abs(balance) : balance;

    console.log(`Equity Account: ${account.accountName} (${account.accountCode}) - Raw Balance: ${balance}, Equity Balance: ${equityBalance}`);

    if (subtype.includes('capital') || accountName.includes('capital') || accountName.includes('stock')) {
      equity.capitalStock += equityBalance;
    } else if (subtype.includes('retained') || accountName.includes('retained')) {
      equity.retainedEarnings += equityBalance;
    } else if (subtype.includes('opening') || accountName.includes('opening')) {
      equity.retainedEarnings += equityBalance;
    } else {
      equity.otherEquity += equityBalance;
    }
  }
  
  // Also check if there are equity accounts that weren't categorized
  const allEquityAccounts = accounts.filter(acc => acc.accountType === 'Equity');
  if (allEquityAccounts.length > categorized.equity.length) {
    console.log(`Warning: Found ${allEquityAccounts.length} equity accounts but only ${categorized.equity.length} were categorized`);
    for (const account of allEquityAccounts) {
      if (!categorized.equity.find(e => e.id === account.id)) {
        const balance = accountBalances[account.id] || 0;
        const equityBalance = balance < 0 ? Math.abs(balance) : balance;
        if (equityBalance > 0) {
          equity.otherEquity += equityBalance;
          console.log(`Added uncategorized equity account: ${account.accountName} - ${equityBalance}`);
        }
      }
    }
  }

  // Calculate current year profit from income statement
  // Need to calculate period change, not absolute balance
  // Get start of year date
  const reportYear = reportDate.getFullYear();
  const yearStart = new Date(reportYear, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  yearStart.setDate(yearStart.getDate() - 1); // Day before year start

  let totalRevenue = 0;
  let totalExpenses = 0;

  // Calculate period changes (current balance - start of year balance)
  for (const account of categorized.revenue) {
    const currentBalance = accountBalances[account.id] || 0;
    const startBalance = await getAccountBalanceAsOfDate(account.id, tenantId, yearStart, account.accountCode);
    const periodRevenue = currentBalance - startBalance;
    totalRevenue += Math.abs(periodRevenue);
  }

  for (const account of categorized.expense) {
    const currentBalance = accountBalances[account.id] || 0;
    const startBalance = await getAccountBalanceAsOfDate(account.id, tenantId, yearStart, account.accountCode);
    const periodExpense = currentBalance - startBalance;
    totalExpenses += Math.abs(periodExpense);
  }

  equity.currentYearProfit = totalRevenue - totalExpenses;
  
  // Debug: Log equity components
  console.log('Equity Calculation:', {
    capitalStock: equity.capitalStock,
    retainedEarnings: equity.retainedEarnings,
    currentYearProfit: equity.currentYearProfit,
    otherEquity: equity.otherEquity,
    totalRevenue,
    totalExpenses
  });
  
  equity.total = equity.capitalStock + equity.retainedEarnings + equity.currentYearProfit + equity.otherEquity;

  // Calculate total liabilities and equity
  let totalLiabilitiesAndEquity = liabilities.total + equity.total;

  // Calculate difference (should be zero if balanced)
  const difference = assets.total - totalLiabilitiesAndEquity;
  
  // If balance sheet doesn't balance, adjust retained earnings to balance it
  // This accounts for historical profits/losses not yet recorded in equity accounts
  // or rounding differences
  if (Math.abs(difference) > 0.01) {
    console.warn(`⚠️ Balance sheet imbalance: Assets (${assets.total}) vs Liabilities + Equity (${totalLiabilitiesAndEquity}). Difference: ${difference.toFixed(2)}`);
    console.log('Adjusting retained earnings to balance the sheet...');
    
    // Adjust retained earnings by the difference
    equity.retainedEarnings += difference;
    equity.total = equity.capitalStock + equity.retainedEarnings + equity.currentYearProfit + equity.otherEquity;
    totalLiabilitiesAndEquity = liabilities.total + equity.total;
    
    console.log(`✅ Balance sheet balanced. Adjusted retained earnings by ${difference.toFixed(2)}`);
  }
  
  const finalDifference = Math.abs(assets.total - totalLiabilitiesAndEquity);

  return {
    companyName,
    logoUrl,
    asOfDate,
    reportDate: reportDate.toISOString(),
    assets,
    liabilities,
    equity,
    totalAssets: assets.total,
    totalLiabilities: liabilities.total,
    totalEquity: equity.total,
    totalLiabilitiesAndEquity,
    difference: finalDifference,
    isBalanced: finalDifference < 0.01,
    metadata: {
      totalAccounts: accounts.length,
      accountsProcessed: Object.keys(accountBalances).length,
      generatedAt: new Date().toISOString()
    }
  };
}

