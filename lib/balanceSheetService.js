// lib/balanceSheetService.js
/**
 * Balance Sheet Service
 * Structure: Current Assets (Cash, AR, Inventory); Non-Current (PPE, Less Acc Dep, Intangible);
 * Current Liabilities (AP, Short-term Loans); Non-Current (Long-term Loans); Equity (Capital, Retained, Current Year P/L).
 * Removed per spec: Prepaid Expenses, Other Non-Current Assets, Accrued Expenses, Bonds Payable, Other Non-Current Liabilities.
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';
<<<<<<< Updated upstream
import { addMoney, multiplyMoney, parseMoney, subtractMoney } from './money';
=======
import { addMoney, isNonZeroMoneyAmount, multiplyMoney, parseMoney, subtractMoney } from './money';
import { isCashAccountCodeForBalanceSheet, LEGACY_CASH_BALANCE_CODES } from './cashAccountCoa.js';
import {
  CODE_ACCOUNTS_PAYABLE,
  CODE_ACCOUNTS_RECEIVABLE,
} from './coaPostingCodes.js';
import {
  buildReconciliationItem,
  buildReconciliationSummary,
  getControlAccountGlBalance,
} from './reportingEngine/index.js';
>>>>>>> Stashed changes

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
        } else if (!subtype && (accountName.endsWith(' assets') || accountName.includes('accumulated depreciation') || accountName.includes('depreciation'))) {
          // Asset accounts created by asset registration without accountSubtype (e.g. "Equipment Assets")
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

  // Resolve legacy cash balances: update accountBalances map where possible,
  // collect orphan amounts (no matching Account) for deferred addition after assets init.
  let legacyOrphanCash = 0;
  for (const legacyBalance of accountBalancesLegacy) {
    const accountCode = legacyBalance.account;
    const existingAccount = accounts.find(acc => acc.accountCode === accountCode);
    
    if (!existingAccount && legacyBalance.balance > 0) {
      console.log(`⚠️ Found legacy cash account ${accountCode} with balance ${legacyBalance.balance}`);
      
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
        accountBalances[accountByName.id] = (accountBalances[accountByName.id] || 0) + legacyBalance.balance;
      } else {
        legacyOrphanCash += legacyBalance.balance;
      }
    }
  }

  // Build assets section
  const assets = {
    currentAssets: {
      cashAndCashEquivalents: 0,
      cashAccounts: [],
      accountsReceivable: { total: 0, items: [] },
      inventory: { total: 0, items: [] },
      prepaidExpenses: 0,
      otherCurrentAssets: 0,
      otherItems: [],
      // Dynamic line items for rendering
      lineItems: [],
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
      otherItems: [],
      // Dynamic line items for rendering
      lineItems: [],
      total: 0
    },
    total: 0
  };

  // Apply deferred legacy orphan cash (resolved before assets was initialized)
  if (legacyOrphanCash > 0) {
    assets.currentAssets.cashAndCashEquivalents += legacyOrphanCash;
  }

  // Accounts Receivable: Invoices module. Only posted invoices; paid excluded.
  let unpaidInvoices = [];
  try {
    unpaidInvoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        issueDate: { lte: reportDate },
        voidedAt: null,
        refundedAt: null,
        status: { notIn: ['Draft', 'draft', 'Cancelled', 'cancelled'] },
        ...(branchId ? { branchId } : {})
      },
      include: {
        client: {
          select: {
            name: true
          }
        },
        payments: {
          where: {
            status: 'Completed'
          },
          select: {
            amount: true
          }
        }
      }
    });
  } catch (invoiceQueryError) {
    console.error('Error fetching invoices for balance sheet:', invoiceQueryError);
    console.error('Invoice query error details:', {
      message: invoiceQueryError.message,
      code: invoiceQueryError.code,
      meta: invoiceQueryError.meta
    });
    // Continue with empty invoices array
    unpaidInvoices = [];
  }

  // Calculate actual remaining balance from payments
  unpaidInvoices.forEach(invoice => {
    const actualTotalPaid = invoice.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const actualRemaining = Math.max(0, subtractMoney(invoice.total, actualTotalPaid));
    const status = (invoice.status || '').toLowerCase().trim();
    
    // Include invoices that are unpaid, pending, partially paid, or have remaining balance
    const unpaidStatuses = ['unpaid', 'pending', 'partially paid', 'partial', 'sent'];
    const isUnpaid = actualRemaining > 0 && (
      unpaidStatuses.some(us => status === us || status.includes(us)) ||
      !['paid', 'completed', 'void', 'refunded', 'fully refunded', 'draft', 'cancelled', 'closed'].includes(status)
    );
    
    if (isUnpaid) {
      assets.currentAssets.accountsReceivable.total = addMoney(
        assets.currentAssets.accountsReceivable.total,
        actualRemaining
      );
      assets.currentAssets.accountsReceivable.items.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client?.name || 'N/A',
        total: invoice.total || 0,
        paid: actualTotalPaid,
        balanceDue: actualRemaining,
        dueDate: invoice.dueDate
      });
    }
  });

  // Adjust AR for posted credit notes (reduce AR) and debit notes (increase AR)
  try {
    const [creditAgg, debitAgg] = await Promise.all([
      prisma.creditNote.aggregate({
        where: {
          tenantId,
          status: 'Posted',
          noteDate: { lte: reportDate }
        },
        _sum: { amount: true }
      }),
      prisma.debitNote.aggregate({
        where: {
          tenantId,
          status: 'Posted',
          noteDate: { lte: reportDate }
        },
        _sum: { amount: true }
      })
    ]);
    const creditSum = parseMoney(creditAgg._sum?.amount);
    const debitSum = parseMoney(debitAgg._sum?.amount);
    assets.currentAssets.accountsReceivable.total = Math.max(
      0,
      addMoney(subtractMoney(assets.currentAssets.accountsReceivable.total, creditSum), debitSum)
    );
  } catch (notesError) {
    console.error('Error fetching credit/debit notes for balance sheet:', notesError);
  }

  const subledgerAccountsReceivable = assets.currentAssets.accountsReceivable.total;
  let arGlBalance = null;
  try {
    arGlBalance = await getControlAccountGlBalance({
      tenantId,
      accountCode: CODE_ACCOUNTS_RECEIVABLE,
      asOfDate,
      branchId,
    });
    if (arGlBalance.found && Math.abs(arGlBalance.balance) > 0) {
      assets.currentAssets.accountsReceivable.total = Math.max(0, arGlBalance.balance);
      assets.currentAssets.accountsReceivable.glBalance = arGlBalance.balance;
      assets.currentAssets.accountsReceivable.subledgerTotal = subledgerAccountsReceivable;
      assets.currentAssets.accountsReceivable.fromGeneralLedger = true;
    }
  } catch (arGlErr) {
    console.warn('Balance sheet: AR GL balance failed', arGlErr?.message || arGlErr);
  }

  // Process current assets from accounts (for other asset types)
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

    // Skip accounts receivable - we're getting it from invoices directly
    const isReceivableAccount = subtype.includes('receivable') || accountName.includes('receivable');

    if (isCashAccount) {
      assets.currentAssets.cashAndCashEquivalents += balance;
      // Include all cash accounts, even with zero balance, for complete balance sheet
      assets.currentAssets.cashAccounts.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance
      });
    } else if (isReceivableAccount) {
      // Don't double-count - we already got receivables from invoices
      // But add account balance if it's different (might be from journal entries)
      // Only add if there's no overlap with invoice-based calculation
    } else if (subtype.includes('inventory') || accountName.includes('inventory')) {
      // GL inventory balance captured but overridden below by FIFO module valuation
      assets.currentAssets.inventory.items.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance: balance
      });
    } else if (subtype.includes('prepaid') || accountName.includes('prepaid')) {
      // Prepaid Expenses removed from balance sheet per spec
    } else {
      assets.currentAssets.otherCurrentAssets += balance;
      // Include all other current asset accounts, even with zero balance
      assets.currentAssets.otherItems.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance
      });
    }
  }

  // Build dynamic current asset line items (for UI)
  // Include all accounts even with zero balances for complete balance sheet
  // Line items per spec: Cash, Accounts Receivable, Inventory only (Prepaid Expenses removed)
  assets.currentAssets.lineItems = [
    ...assets.currentAssets.cashAccounts
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `cash-${a.accountId}`,
        label: a.accountName || 'Cash',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      })),
    {
      key: 'accounts-receivable',
      label: 'Accounts Receivable',
      value: assets.currentAssets.accountsReceivable.total || 0,
      drillDown: { type: 'Accounts Receivable', items: assets.currentAssets.accountsReceivable.items || [] }
    },
    ...assets.currentAssets.inventory.items
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `inventory-${a.accountCode || a.accountName}`,
        label: a.accountName || 'Inventory',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      })),
    ...assets.currentAssets.otherItems
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `other-current-${a.accountId}`,
        label: a.accountName || 'Other Current Asset',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      }))
  ];
  // Only filter out truly zero items if they're not explicitly needed (keep accounts receivable, inventory, prepaid even if zero)
  // But show all accounts that have been categorized
  assets.currentAssets.lineItems = assets.currentAssets.lineItems.filter(li => {
    if (li.key === 'accounts-receivable' || li.key?.includes('inventory-')) return true;
    return Math.abs(li.value || 0) > 0.000001 || li.key?.includes('other-current-') || li.key?.startsWith('cash-');
  });

  // Override inventory with FIFO closing stock from inventory module (product.totalStockValue)
  // This is the authoritative valuation maintained by lib/fifoCosting.js
  try {
    const fifoProducts = await prisma.product.findMany({
      where: { tenantId, isDeleted: false, stockLevel: { gt: 0 } },
      select: { id: true, name: true, sku: true, totalStockValue: true, stockLevel: true, cost: true, averageCost: true }
    });
    let fifoTotal = 0;
    const fifoItems = [];
    for (const p of fifoProducts) {
      const val =
        parseMoney(p.totalStockValue) ||
        multiplyMoney(p.cost || p.averageCost || 0, p.stockLevel || 0);
      fifoTotal = addMoney(fifoTotal, val);
      fifoItems.push({ accountCode: p.sku || '', accountName: p.name || 'Product', balance: val });
    }
    assets.currentAssets.inventory.total = fifoTotal;
    if (fifoItems.length > 0) {
      assets.currentAssets.inventory.items = fifoItems;
    }
  } catch (invErr) {
    console.warn('Balance sheet: FIFO inventory lookup failed, falling back to GL:', invErr?.message);
    // inventory.total stays as accumulated from GL accounts above (which is 0 since we removed +=)
  }

  // Total Current Assets = Cash + Accounts Receivable + Inventory (per spec; prepaid removed)
  assets.currentAssets.total =
    assets.currentAssets.cashAndCashEquivalents +
    assets.currentAssets.accountsReceivable.total +
    assets.currentAssets.inventory.total +
    assets.currentAssets.otherCurrentAssets;
  
  // Ensure otherCurrentAssets is included even if empty
  if (!assets.currentAssets.otherCurrentAssets) {
    assets.currentAssets.otherCurrentAssets = 0;
  }

  // PPE from Asset Management module (authoritative source for original cost & depreciation)
  // Falls back to GL accounts only for intangible assets or if the module query fails.
  let ppeFromModule = false;
  try {
    const registeredAssets = await prisma.asset.findMany({
      where: {
        tenantId,
        purchaseDate: { lte: reportDate },
        status: { notIn: ['Disposed', 'disposed', 'Sold', 'sold', 'Written Off'] }
      },
      select: {
        id: true, name: true, originalCost: true, accumulatedDepreciation: true,
        category: { select: { name: true } },
        depreciationSchedules: {
          orderBy: { periodEnd: 'desc' },
          take: 1,
          where: { periodEnd: { lte: reportDate } },
          select: { accumulatedDepreciation: true, netBookValue: true }
        }
      }
    });

    if (registeredAssets.length > 0) {
      ppeFromModule = true;
      for (const a of registeredAssets) {
        const cost = parseFloat(a.originalCost) || 0;
        const latestSched = a.depreciationSchedules?.[0];
        const accDep = parseFloat(latestSched?.accumulatedDepreciation ?? a.accumulatedDepreciation ?? 0);
        assets.nonCurrentAssets.propertyPlantEquipment.gross += cost;
        assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation += accDep;
        assets.nonCurrentAssets.propertyPlantEquipment.items.push({
          accountId: a.id,
          accountCode: a.category?.name || '',
          accountName: a.name || 'Asset',
          balance: cost
        });
      }
    }
  } catch (assetErr) {
    console.warn('Balance sheet: Asset module lookup failed, falling back to GL:', assetErr?.message);
  }

  // GL fallback for fixed assets (only when asset module had no data)
  if (!ppeFromModule) {
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
        assets.nonCurrentAssets.propertyPlantEquipment.items.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: balance
        });
      }
    }
  }

  // Intangible assets always come from GL (they aren't in the Asset module)
  for (const account of [...categorized.assets.fixed, ...categorized.assets.other]) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    if (subtype.includes('intangible') && ppeFromModule) {
      assets.nonCurrentAssets.intangibleAssets += balance;
    }
  }

  // Process other non-current assets (non-PPE, non-intangible)
  for (const account of categorized.assets.other) {
    const balance = accountBalances[account.id] || 0;
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();
    
    const isContraAsset = subtype.includes('depreciation') || accountName.includes('depreciation') ||
                         subtype.includes('accumulated') || accountName.includes('accumulated');
    
    if (subtype.includes('intangible')) {
      // Handled above
    } else if (isContraAsset) {
      if (!ppeFromModule) {
        assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation += Math.abs(balance);
      }
    } else {
      if (balance < 0) {
        console.warn(`⚠️ Negative balance for asset account ${account.accountName} (${account.accountCode}): ${balance}. Using absolute value.`);
      }
      assets.nonCurrentAssets.otherNonCurrentAssets += Math.abs(balance);
      assets.nonCurrentAssets.otherItems.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance: Math.abs(balance)
      });
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

  // Total Non-Current Assets = PPE – Accumulated Depreciation + Intangible (Other Non-Current removed per spec)
  assets.nonCurrentAssets.total =
    assets.nonCurrentAssets.propertyPlantEquipment.net +
    assets.nonCurrentAssets.intangibleAssets +
    assets.nonCurrentAssets.otherNonCurrentAssets;

  // Line items: PPE (Gross + Less Accumulated Depreciation) and Intangible only
  assets.nonCurrentAssets.lineItems = [
    {
      key: 'ppe-gross',
      label: 'Property, Plant & Equipment',
      value: assets.nonCurrentAssets.propertyPlantEquipment.gross || 0,
      drillDown: { type: 'Property, Plant & Equipment', items: assets.nonCurrentAssets.propertyPlantEquipment.items || [] }
    },
    {
      key: 'accumulated-depreciation',
      label: 'Less: Accumulated Depreciation',
      value: -(assets.nonCurrentAssets.propertyPlantEquipment.accumulatedDepreciation || 0)
    },
    {
      key: 'ppe-net',
      label: 'Property, Plant & Equipment (Net)',
      value: assets.nonCurrentAssets.propertyPlantEquipment.net || 0
    },
    {
      key: 'intangible-assets',
      label: 'Intangible Assets',
      value: assets.nonCurrentAssets.intangibleAssets || 0
    },
    ...assets.nonCurrentAssets.otherItems
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `other-non-current-${a.accountId}`,
        label: a.accountName || 'Other Non-Current Asset',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      }))
  ];
  
  // Ensure non-current assets total is not negative
  if (assets.nonCurrentAssets.total < 0) {
    console.warn(`⚠️ Negative total non-current assets: ${assets.nonCurrentAssets.total}. This indicates a data issue.`);
  }

  assets.total = assets.currentAssets.total + assets.nonCurrentAssets.total;

  // Build liabilities section
  const liabilities = {
    currentLiabilities: {
      accountsPayable: { total: 0, items: [] },
      payableAccounts: [],
      shortTermLoans: 0,
      shortTermLoanAccounts: [],
      taxPayable: 0,
      taxAccounts: [],
      accruedExpenses: 0,
      accruedAccounts: [],
      otherCurrentLiabilities: 0,
      otherItems: [],
      // Dynamic line items for rendering
      lineItems: [],
      total: 0
    },
    nonCurrentLiabilities: { // Also known as longTermLiabilities
      longTermLoans: 0,
      longTermLoanAccounts: [],
      bondsPayable: 0,
      bondAccounts: [],
      otherLongTermLiabilities: 0,
      otherNonCurrentLiabilities: 0, // Alias
      otherItems: [],
      // Dynamic line items for rendering
      lineItems: [],
      total: 0
    },
    longTermLiabilities: { // Alias for nonCurrentLiabilities
      longTermLoans: 0,
      bondsPayable: 0,
      otherLongTermLiabilities: 0,
      lineItems: [],
      total: 0
    },
    // Top-level dynamic line items for rendering (optional convenience)
    lineItems: [],
    total: 0
  };

  // Get Accounts Payable directly from unpaid expenses and supplier bills (more accurate)
  let unpaidExpenses = [];
  try {
    unpaidExpenses = await prisma.expense.findMany({
      where: {
        tenantId,
        date: { lte: reportDate },
        isDeleted: false,
        paymentStatus: { in: ['Pending', 'Partially', 'Unpaid'] },
        ...(branchId ? { branchId } : {})
      },
      include: {
        submittedBy: {
          select: {
            name: true
          }
        },
        payments: {
          where: {
            status: 'Completed'
          },
          select: {
            amount: true
          }
        }
      }
    });
  } catch (expenseQueryError) {
    console.error('Error fetching expenses for balance sheet:', expenseQueryError);
    console.error('Expense query error details:', {
      message: expenseQueryError.message,
      code: expenseQueryError.code,
      meta: expenseQueryError.meta
    });
    // Continue with empty expenses array
    unpaidExpenses = [];
  }

  unpaidExpenses.forEach(expense => {
    const amount = parseMoney(expense.amount);
    const actualPaid = expense.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
    const balanceDue = Math.max(0, subtractMoney(amount, actualPaid));
    
    if (balanceDue > 0) {
      liabilities.currentLiabilities.accountsPayable.total = addMoney(
        liabilities.currentLiabilities.accountsPayable.total,
        balanceDue
      );
      liabilities.currentLiabilities.accountsPayable.items.push({
        id: expense.id,
        description: expense.description,
        date: expense.date,
        total: amount,
        paid: actualPaid,
        balanceDue: balanceDue,
        merchant: expense.merchant || expense.submittedBy?.name || 'N/A'
      });
    }
  });

  // Get supplier bills (accounts payable)
  // Supplier has no branchId; SupplierBill has no branch scope. Do not filter by supplier.branchId (invalid Prisma → 500).
  const supplierBills = await prisma.supplierBill.findMany({
    where: {
      tenantId,
      billDate: { lte: reportDate },
      status: { in: ['Unpaid', 'Partial', 'Overdue'] },
    },
    include: {
      supplier: {
        select: {
          supplierName: true,
          supplierCode: true
        }
      }
    }
  });

  supplierBills.forEach(bill => {
    const total = parseMoney(bill.totalAmount);
    const paid = parseMoney(bill.amountPaid);
    const balanceDue = Math.max(0, subtractMoney(total, paid));
    
    if (balanceDue > 0) {
      liabilities.currentLiabilities.accountsPayable.total = addMoney(
        liabilities.currentLiabilities.accountsPayable.total,
        balanceDue
      );
      liabilities.currentLiabilities.accountsPayable.items.push({
        id: bill.id,
        description: `Supplier Bill ${bill.billNumber || bill.id}`,
        date: bill.billDate,
        total: total,
        paid: paid,
        balanceDue: balanceDue,
        merchant: bill.supplier?.supplierName || 'N/A'
      });
    }
  });

  const subledgerAccountsPayable = liabilities.currentLiabilities.accountsPayable.total;
  let apGlBalance = null;
  try {
    apGlBalance = await getControlAccountGlBalance({
      tenantId,
      accountCode: CODE_ACCOUNTS_PAYABLE,
      asOfDate,
      branchId,
    });
    if (apGlBalance.found && Math.abs(apGlBalance.balance) > 0) {
      liabilities.currentLiabilities.accountsPayable.total = Math.max(0, apGlBalance.balance);
      liabilities.currentLiabilities.accountsPayable.glBalance = apGlBalance.balance;
      liabilities.currentLiabilities.accountsPayable.subledgerTotal = subledgerAccountsPayable;
      liabilities.currentLiabilities.accountsPayable.fromGeneralLedger = true;
    }
  } catch (apGlErr) {
    console.warn('Balance sheet: AP GL balance failed', apGlErr?.message || apGlErr);
  }

  // Process current liabilities from accounts (for other liability types)
  for (const account of categorized.liabilities.current) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    // Skip accounts payable - we're getting it from expenses/bills directly
    const isPayableAccount = subtype.includes('payable') || accountName.includes('payable');

    if (isPayableAccount) {
      // Don't double-count - we already got payables from expenses/bills
      // But add account balance if it's different (might be from journal entries)
      // Only add if there's no overlap with expense-based calculation
      if (balance !== 0) {
        liabilities.currentLiabilities.payableAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    } else if (subtype.includes('tax') || accountName.includes('tax')) {
      liabilities.currentLiabilities.taxPayable += balance;
      if (balance !== 0) {
        liabilities.currentLiabilities.taxAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    } else if (subtype.includes('loan') || accountName.includes('loan')) {
      liabilities.currentLiabilities.shortTermLoans += balance;
      if (balance !== 0) {
        liabilities.currentLiabilities.shortTermLoanAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    } else if (subtype.includes('accrued') || accountName.includes('accrued')) {
      // Accrued Expenses removed from balance sheet per spec
    } else {
      liabilities.currentLiabilities.otherCurrentLiabilities += balance;
      if (balance !== 0) {
        liabilities.currentLiabilities.otherItems.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    }
  }

  // Total Current Liabilities = Accounts Payable + Short-term Loans (per spec; accrued removed)
  liabilities.currentLiabilities.total =
    liabilities.currentLiabilities.accountsPayable.total +
    liabilities.currentLiabilities.shortTermLoans +
    liabilities.currentLiabilities.taxPayable +
    liabilities.currentLiabilities.otherCurrentLiabilities;

  liabilities.currentLiabilities.lineItems = [
    {
      key: 'accounts-payable',
      label: 'Accounts Payable',
      value: liabilities.currentLiabilities.accountsPayable.total || 0,
      drillDown: { type: 'Accounts Payable', items: liabilities.currentLiabilities.accountsPayable.items || [] }
    },
    ...(liabilities.currentLiabilities.shortTermLoans ? [{
      key: 'short-term-loans',
      label: 'Short-term Loans',
      value: liabilities.currentLiabilities.shortTermLoans || 0,
      drillDown: liabilities.currentLiabilities.shortTermLoanAccounts.length
        ? { type: 'Account', items: liabilities.currentLiabilities.shortTermLoanAccounts.map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })) }
        : undefined
    }] : []),
    ...(liabilities.currentLiabilities.taxPayable ? [{
      key: 'tax-payable',
      label: 'Tax Payable',
      value: liabilities.currentLiabilities.taxPayable || 0,
      drillDown: liabilities.currentLiabilities.taxAccounts.length
        ? { type: 'Account', items: liabilities.currentLiabilities.taxAccounts.map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })) }
        : undefined
    }] : []),
    ...liabilities.currentLiabilities.otherItems
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `other-current-liability-${a.accountId}`,
        label: a.accountName || 'Other Current Liability',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      })),
    // Informational: payable GL accounts (excluded from totals to avoid double counting)
    ...liabilities.currentLiabilities.payableAccounts
      .filter(a => Math.abs(a.balance || 0) > 0.000001)
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `ap-gl-${a.accountId}`,
        label: `${a.accountName || 'Accounts Payable'} (GL)`,
        value: 0,
        meta: { note: 'GL payable account shown for reference; not included in totals.' },
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      }))
  ].filter(li => li && typeof li === 'object');

  // Process long-term liabilities
  for (const account of categorized.liabilities.longTerm) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    if (subtype.includes('loan') || accountName.includes('loan')) {
      liabilities.nonCurrentLiabilities.longTermLoans += balance;
      liabilities.longTermLiabilities.longTermLoans += balance; // Alias
      if (balance !== 0) {
        liabilities.nonCurrentLiabilities.longTermLoanAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    } else if (subtype.includes('bond') || accountName.includes('bond')) {
      // Bonds Payable removed from balance sheet per spec
    } else {
      liabilities.nonCurrentLiabilities.otherLongTermLiabilities += balance;
      liabilities.nonCurrentLiabilities.otherNonCurrentLiabilities += balance;
      liabilities.longTermLiabilities.otherLongTermLiabilities += balance;
      if (balance !== 0) {
        liabilities.nonCurrentLiabilities.otherItems.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    }
  }

  for (const account of categorized.liabilities.other) {
    const balance = Math.abs(accountBalances[account.id] || 0);
    const subtype = (account.accountSubtype || '').toLowerCase();
    const accountName = (account.accountName || '').toLowerCase();

    if (subtype.includes('long') || subtype.includes('term') || accountName.includes('long') || accountName.includes('term')) {
      if (subtype.includes('loan') || accountName.includes('loan')) {
        liabilities.nonCurrentLiabilities.longTermLoans += balance;
        liabilities.longTermLiabilities.longTermLoans += balance;
        if (balance !== 0) {
          liabilities.nonCurrentLiabilities.longTermLoanAccounts.push({
            accountId: account.id,
            accountCode: account.accountCode,
            accountName: account.accountName,
            balance
          });
        }
      } else {
        liabilities.nonCurrentLiabilities.otherLongTermLiabilities += balance;
        liabilities.nonCurrentLiabilities.otherNonCurrentLiabilities += balance;
        liabilities.longTermLiabilities.otherLongTermLiabilities += balance;
        if (balance !== 0) {
          liabilities.nonCurrentLiabilities.otherItems.push({
            accountId: account.id,
            accountCode: account.accountCode,
            accountName: account.accountName,
            balance
          });
        }
      }
    } else {
      liabilities.currentLiabilities.otherCurrentLiabilities += balance;
      if (balance !== 0) {
        liabilities.currentLiabilities.otherItems.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance
        });
      }
    }
  }

  // Total Non-Current Liabilities = Long-term Loans only (Bonds and Other removed per spec)
  liabilities.nonCurrentLiabilities.total =
    liabilities.nonCurrentLiabilities.longTermLoans +
    liabilities.nonCurrentLiabilities.otherLongTermLiabilities;
  liabilities.longTermLiabilities.total =
    liabilities.longTermLiabilities.longTermLoans +
    liabilities.longTermLiabilities.otherLongTermLiabilities;

  liabilities.total = liabilities.currentLiabilities.total + liabilities.nonCurrentLiabilities.total;

  liabilities.nonCurrentLiabilities.lineItems = [
    ...(liabilities.nonCurrentLiabilities.longTermLoans ? [{
      key: 'long-term-loans',
      label: 'Long-term Loans',
      value: liabilities.nonCurrentLiabilities.longTermLoans || 0,
      drillDown: liabilities.nonCurrentLiabilities.longTermLoanAccounts.length
        ? { type: 'Account', items: liabilities.nonCurrentLiabilities.longTermLoanAccounts.map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })) }
        : undefined
    }] : []),
    ...liabilities.nonCurrentLiabilities.otherItems
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `other-long-term-liability-${a.accountId}`,
        label: a.accountName || 'Other Long-Term Liability',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      }))
  ];

  liabilities.longTermLiabilities.lineItems = liabilities.nonCurrentLiabilities.lineItems;

  liabilities.lineItems = [
    ...liabilities.currentLiabilities.lineItems.filter(li => (li.value || 0) > 0),
    ...liabilities.nonCurrentLiabilities.lineItems
  ];

  // Build equity section
  const equity = {
    ownersCapital: 0, // Also known as capitalStock/share capital
    capitalStock: 0, // Alias for ownersCapital
    retainedEarnings: 0,
    currentYearProfitLoss: 0, // Also known as currentYearProfit
    currentYearProfit: 0, // Alias for currentYearProfitLoss
    otherEquity: 0,
    capitalAccounts: [],
    retainedAccounts: [],
    otherAccounts: [],
    lineItems: [],
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

    if (subtype.includes('capital') || accountName.includes('capital') || accountName.includes('stock') || accountName.includes('share')) {
      equity.ownersCapital += equityBalance;
      equity.capitalStock += equityBalance; // Alias
      if (equityBalance !== 0) {
        equity.capitalAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: equityBalance
        });
      }
    } else if (subtype.includes('retained') || accountName.includes('retained')) {
      equity.retainedEarnings += equityBalance;
      if (equityBalance !== 0) {
        equity.retainedAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: equityBalance
        });
      }
    } else if (subtype.includes('opening') || accountName.includes('opening')) {
      equity.retainedEarnings += equityBalance;
      if (equityBalance !== 0) {
        equity.retainedAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: equityBalance
        });
      }
    } else {
      equity.otherEquity += equityBalance;
      if (equityBalance !== 0) {
        equity.otherAccounts.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance: equityBalance
        });
      }
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

  // Current Year Profit/Loss: from Income Statement (system-generated, auto-linked)
  let currentYearProfitLoss = 0;
  try {
    const { generateIncomeStatementFromAccounts } = await import('./incomeStatementService');
    const yearStartStr = `${reportYear}-01-01`;
    const asOfStr = reportDate.toISOString().split('T')[0];
    const statement = await generateIncomeStatementFromAccounts(tenantId, yearStartStr, asOfStr, 'Company', null, branchId);
    currentYearProfitLoss = Number(statement?.netIncome ?? 0);
  } catch (err) {
    console.warn('Balance sheet: could not get current year P/L from income statement:', err?.message);
  }
  equity.currentYearProfitLoss = currentYearProfitLoss;
  equity.currentYearProfit = equity.currentYearProfitLoss;

  // Per spec: Total Equity = Capital + Retained Earnings + Current Year P/L
  // Fold any miscellaneous equity into retained earnings so the equation holds
  equity.retainedEarnings += equity.otherEquity;
  equity.otherEquity = 0;
  equity.total = equity.ownersCapital + equity.retainedEarnings + equity.currentYearProfitLoss;

  // Build dynamic equity line items (for UI)
  equity.lineItems = [
    ...equity.capitalAccounts
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `equity-capital-${a.accountId}`,
        label: a.accountName || "Owner's Capital/Share Capital",
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      })),
    {
      key: 'retained-earnings',
      label: 'Retained Earnings',
      value: equity.retainedEarnings || 0,
      drillDown: equity.retainedAccounts.length
        ? { type: 'Account', items: equity.retainedAccounts.map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })) }
        : undefined
    },
    {
      key: 'current-year-profit-loss',
      label: 'Current Year Profit/Loss',
      value: equity.currentYearProfitLoss || 0
    },
    ...equity.otherAccounts
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({
        key: `equity-other-${a.accountId}`,
        label: a.accountName || 'Other Equity',
        value: a.balance || 0,
        drillDown: { type: 'Account', items: [{ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance }] }
      }))
  ].filter(li => li.key === 'retained-earnings' || li.key === 'current-year-profit-loss' || Math.abs(li.value || 0) > 0.000001);

  // Calculate total liabilities and equity. Do not adjust retained earnings here;
  // an imbalance is a diagnostic that should stay visible to the user.
  const totalLiabilitiesAndEquity = liabilities.total + equity.total;
  const balanceDifference = assets.total - totalLiabilitiesAndEquity;
  const finalDifference = Math.abs(balanceDifference);

  // Calculate financial ratios
  const quickAssets = assets.currentAssets.cashAndCashEquivalents + assets.currentAssets.accountsReceivable.total;
  const ratios = {
    currentRatio: liabilities.currentLiabilities.total > 0 
      ? assets.currentAssets.total / liabilities.currentLiabilities.total 
      : 0,
    quickRatio: liabilities.currentLiabilities.total > 0 
      ? quickAssets / liabilities.currentLiabilities.total 
      : 0,
    debtToEquity: equity.total > 0 
      ? liabilities.total / equity.total 
      : 0
  };

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
    balanceDifference,
    isBalanced: finalDifference < 0.01,
    ratios,
    metadata: {
      totalAccounts: accounts.length,
      accountsProcessed: Object.keys(accountBalances).length,
      generatedAt: new Date().toISOString(),
      ledgerSource: 'general_ledger',
      fromGeneralLedger: {
        accountsReceivable: Boolean(assets.currentAssets.accountsReceivable.fromGeneralLedger),
        accountsPayable: Boolean(liabilities.currentLiabilities.accountsPayable.fromGeneralLedger),
      },
      reconciliation: buildReconciliationSummary([
        buildReconciliationItem({
          label: 'Accounts Receivable',
          glAmount: arGlBalance?.balance ?? assets.currentAssets.accountsReceivable.glBalance ?? 0,
          operationalAmount: subledgerAccountsReceivable,
        }),
        buildReconciliationItem({
          label: 'Accounts Payable',
          glAmount: apGlBalance?.balance ?? liabilities.currentLiabilities.accountsPayable.glBalance ?? 0,
          operationalAmount: subledgerAccountsPayable,
        }),
      ]),
    }
  };
}

