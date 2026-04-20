// lib/incomeStatementService.js
/**
 * Income Statement Service
 * Single source of truth for P&L. Same logic must be used for dashboard, Excel, and PDF.
 *
 * SYSTEM RULES (NON-NEGOTIABLE)
 * 1. Revenue and COGS are system-generated — no user input.
 * 2. Users cannot edit Income Statement figures — read-only everywhere.
 * 3. Shipping costs are never part of COGS — COGS is product cost only (FIFO/cost at sale).
 * 4. Operating Expenses roll up to PHINDU Chart of Accounts main lines (5200–5900); leaf/custom category accounts merge into those lines.
 * 5. Same logic for dashboard, Excel, and PDF — all must use this service (getSalesRevenueForPeriod, getCOGSTransactionStats, generateIncomeStatementFromAccounts).
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';
import { getBudgetVsActual, getRevenueBudgets } from './budgetService';
import { getCOGSTransactionStats } from './cogsIntegration';
import { ensureExpenseAccountsForTenant, EXPENSE_ACCOUNTS_TEMPLATE } from './expenseCategoriesTemplate';
import {
  getPhinduOperatingExpenseDisplayLines,
  resolveOperatingExpenseRollup
} from './incomeStatementOperatingExpenseRollup';
import { formatYmdInTimeZone, DEFAULT_REPORT_TIMEZONE, parseInclusiveApiYmdRange } from './dateUtils';

/**
 * Sales Revenue = total value of completed sales.
 * Data source: POS sales (status completed) + Invoices (status Paid or Completed).
 * Auto-generated; no breakdown by product/service/category; no manual editing.
 * @param {string} tenantId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string|null} branchId
 * @returns {Promise<number>}
 */
export async function getSalesRevenueForPeriod(tenantId, startDate, endDate, branchId = null) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const invoiceWhere = {
    tenantId,
    status: { in: ['Paid', 'Completed'] },
    issueDate: { gte: start, lte: end },
    voidedAt: null,
    refundedAt: null,
    ...(branchId ? { branchId } : {})
  };
  const invoiceAgg = await prisma.invoice.aggregate({
    where: invoiceWhere,
    _sum: { total: true }
  });
  const invoiceTotal = Number(invoiceAgg._sum?.total ?? 0) || 0;

  const saleWhere = {
    tenantId,
    status: 'completed',
    saleDate: { gte: start, lte: end },
    ...(branchId ? { branchId } : {})
  };
  const saleAgg = await prisma.sale.aggregate({
    where: saleWhere,
    _sum: { total: true }
  });
  const saleTotal = Number(saleAgg._sum?.total ?? 0) || 0;

  return Math.round((invoiceTotal + saleTotal) * 100) / 100;
}

/**
 * Cost of Goods Sold (COGS) for the period using FIFO only.
 * Generated automatically at time of sale; system-controlled; no shipping/transport/handling/import duty.
 * Data source: completed POS sales only (SaleItem.customProductData.fifoCogs or InventoryBatchConsumption fallback).
 * @param {string} tenantId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string|null} branchId
 * @returns {Promise<number>}
 */
export async function getFifoCogsForPeriod(tenantId, startDate, endDate, branchId = null) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const saleWhere = {
    tenantId,
    status: 'completed',
    saleDate: { gte: start, lte: end },
    ...(branchId ? { branchId } : {})
  };
  const sales = await prisma.sale.findMany({
    where: saleWhere,
    select: { id: true }
  });
  if (sales.length === 0) return 0;

  const saleItems = await prisma.saleItem.findMany({
    where: {
      saleId: { in: sales.map((s) => s.id) },
      isCustom: false,
      productId: { not: null },
      product: {
        isService: false
      }
    },
    select: {
      id: true,
      saleId: true,
      quantity: true,
      customProductData: true,
      product: { select: { cost: true } }
    }
  });

  const saleItemIds = saleItems.map((i) => i.id).filter(Boolean);
  const saleIds = sales.map((s) => s.id);
  const fifoConsumptions = saleItemIds.length > 0
    ? await prisma.inventoryBatchConsumption.findMany({
        where: {
          tenantId,
          OR: [
            ...(saleItemIds.length ? [{ saleItemId: { in: saleItemIds } }] : []),
            ...(saleIds.length ? [{ saleId: { in: saleIds } }] : [])
          ]
        },
        select: { saleItemId: true, saleId: true, cogsAmount: true }
      })
    : [];

  const fifoBySaleItem = {};
  for (const c of fifoConsumptions) {
    const amt = Number(c.cogsAmount || 0);
    if (c.saleItemId) fifoBySaleItem[c.saleItemId] = (fifoBySaleItem[c.saleItemId] || 0) + amt;
  }

  let total = 0;
  for (const item of saleItems) {
    let itemCOGS = 0;
    const customData = typeof item.customProductData === 'string'
      ? (() => { try { return JSON.parse(item.customProductData); } catch { return null; } })()
      : item.customProductData;

    if (customData && typeof customData === 'object' && customData.fifoCogs != null && customData.fifoCogs.cogsAmount != null) {
      const v = customData.fifoCogs.cogsAmount;
      itemCOGS = typeof v === 'object' && v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v);
    }
    if (itemCOGS === 0 && item.id && fifoBySaleItem[item.id] != null) {
      itemCOGS = fifoBySaleItem[item.id];
    }
    if (itemCOGS === 0 && customData && typeof customData === 'object' && customData.productCostAtSale != null) {
      const qty = Number(item.quantity || 0);
      itemCOGS = qty * Number(customData.productCostAtSale);
    }
    if (itemCOGS === 0 && item.product && item.product.cost != null) {
      itemCOGS = Number(item.quantity || 0) * Number(item.product.cost);
    }
    total += itemCOGS;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Fetch expense categories for the tenant (same source as /expenses dropdown: /api/categories?type=expense).
 * Returns ExpenseCategory entries + ALL CoA expense accounts (5000-5999 by code, and by type/subtype).
 * Ensures template accounts exist so Operating Expenses in P&L match the category dropdown.
 * @param {string} tenantId
 * @returns {Promise<Array<{ accountId: string, accountCode: string, name: string, account?: object }>>}
 */
export async function getExpenseCategoriesForTenant(tenantId) {
  const accountIdsFromCategories = new Set();
  const categories = [];
  try {
    const expenseCategories = await prisma.expenseCategory.findMany({
      where: { tenantId },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            isActive: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    expenseCategories.forEach((cat) => {
      accountIdsFromCategories.add(cat.accountId);
      categories.push({
        accountId: cat.accountId,
        accountCode: cat.accountCode || (cat.account?.accountCode ?? ''),
        name: cat.name,
        account: cat.account
      });
    });
  } catch (e) {
    console.warn('Income statement: expense categories fetch failed', e?.message || e);
  }
  try {
    const templateCodes = EXPENSE_ACCOUNTS_TEMPLATE.map((t) => t.code);
    // Ensure template 5001-5999 accounts exist (same as /api/categories so dropdown and P&L match)
    if (tenantId) {
      const existingCount = await prisma.account.count({
        where: { tenantId, accountCode: { in: templateCodes } }
      });
      if (existingCount < EXPENSE_ACCOUNTS_TEMPLATE.length) {
        try {
          await ensureExpenseAccountsForTenant(tenantId, prisma);
        } catch (ensureErr) {
          console.warn('Income statement: could not ensure expense accounts:', ensureErr?.message || ensureErr);
        }
      }
    }
    const accountSelect = {
      id: true,
      accountCode: true,
      accountName: true,
      name: true,
      accountType: true,
      accountSubtype: true,
      isActive: true
    };
    const baseWhere = { tenantId, isActive: true };
    // 1) Explicit template codes (same list as expenses dropdown) – guarantees 5001-5999 appear
    const byTemplateCodes = await prisma.account.findMany({
      where: { ...baseWhere, accountCode: { in: templateCodes } },
      select: accountSelect,
      orderBy: { accountName: 'asc' }
    });
    // 2) By type/subtype for any other expense accounts
    const byTypeAccounts = await prisma.account.findMany({
      where: {
        ...baseWhere,
        OR: [
          { accountType: { equals: 'Expense', mode: 'insensitive' } },
          { type: { equals: 'Expense', mode: 'insensitive' } },
          { accountSubtype: { equals: 'Cost of Sales', mode: 'insensitive' } },
          { accountSubtype: { equals: 'Operating Expense', mode: 'insensitive' } },
          { accountSubtype: { equals: 'Other Expense', mode: 'insensitive' } }
        ]
      },
      select: accountSelect,
      orderBy: { accountName: 'asc' }
    });
    // 3) By code range for any 5000-5999 not in template (e.g. custom codes)
    const byCodeAccounts = await prisma.account.findMany({
      where: {
        ...baseWhere,
        OR: [
          { accountCode: { gte: '5000', lte: '5999' } },
          { code: { gte: '5000', lte: '5999' } }
        ]
      },
      select: accountSelect,
      orderBy: { accountName: 'asc' }
    });
    const byId = new Map();
    [...byTemplateCodes, ...byTypeAccounts, ...byCodeAccounts].forEach((acc) => byId.set(acc.id, acc));
    Array.from(byId.values()).forEach((acc) => {
      if (accountIdsFromCategories.has(acc.id)) return;
      const label = acc.accountName || acc.name || acc.accountCode || 'Unnamed';
      categories.push({
        accountId: acc.id,
        accountCode: acc.accountCode || '',
        name: label,
        account: acc
      });
    });
    categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (e) {
    console.warn('Income statement: expense accounts fetch failed', e?.message || e);
  }
  return categories;
}

/**
 * Generate income statement from account balances.
 * REVENUE: One line only — Sales Revenue (POS + Invoices, completed/paid).
 * COGS: One line only — Cost of Goods Sold (FIFO, from POS sales at time of sale; no shipping/transport/handling).
 */
export async function generateIncomeStatementFromAccounts(
  tenantId, 
  startDate, 
  endDate, 
  companyName = 'Company', 
  logoUrl = null,
  branchId = null
) {
  // Validate inputs
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }
  
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
  
  // Validate date range
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
  
  console.log('📊 Generating Income Statement (Revenue = Sales Revenue only):', {
    tenantId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    branchId: branchId || 'all branches'
  });

  // REVENUE: One line only — Sales Revenue = POS completed sales + Invoices (Paid/Completed)
  const salesRevenueTotal = await getSalesRevenueForPeriod(tenantId, start, end, branchId);
  const revenue = {
    salesRevenue: salesRevenueTotal,
    serviceRevenue: 0,
    otherIncome: 0,
    details: [],
    lineItems: [{
      key: 'sales-revenue',
      label: 'Sales Revenue',
      amount: salesRevenueTotal,
      details: []
    }]
  };
  const totalRevenue = salesRevenueTotal;

  // Get expense accounts (for operating expenses and tax only; COGS is FIFO-only, not from GL)
  const expenseAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      isActive: true
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountSubtype: true
    }
  });

  // COGS: One line only — Cost of Goods Sold from stock/COGS integration (same source as /stock).
  // Shipping costs are NEVER part of COGS (system rule).
  const cogsStats = await getCOGSTransactionStats(tenantId, start, end, branchId);
  const costOfGoodsSold = Math.round(Number(cogsStats?.totalAmount ?? 0) * 100) / 100;
  const cogs = {
    costOfProductsSold: costOfGoodsSold,
    freightShippingCosts: 0, // Shipping never part of COGS
    details: [],
    lineItems: [{
      key: 'cost-of-goods-sold',
      label: 'Cost of Goods Sold',
      amount: costOfGoodsSold,
      details: []
    }],
    total: costOfGoodsSold
  };

  // GROSS PROFIT — auto-calculated: Sales Revenue − Cost of Goods Sold
  const grossProfit = totalRevenue - costOfGoodsSold;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ========== OPERATING EXPENSES SECTION - DYNAMIC CATEGORIES ==========
  // Get all expenses from Expense table and group by actual category names
  let expenses = [];
  try {
    expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        isDeleted: false,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
      },
      include: {
        submittedBy: {
          select: {
            name: true
          }
        },
        expenseAccount: {
          select: {
            id: true,
            accountName: true,
            accountCode: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });
  } catch (expenseQueryError) {
    console.error('Error fetching expenses for income statement:', expenseQueryError);
    console.error('Expense query error details:', {
      message: expenseQueryError.message,
      code: expenseQueryError.code,
      meta: expenseQueryError.meta
    });
    // Continue with empty expenses array to allow report to generate
    expenses = [];
  }

  // Group expenses by account code (normalized grouping)
  // This ensures duplicate categories map to the same account code
  const expensesByAccountCode = {};
  const expensesByCategory = {}; // Keep for backward compatibility
  const expenseDetails = [];

  expenses.forEach(expense => {
    const account = expense.expenseAccount;
    const amount = expense.amount || 0;
    let accountCode;
    let accountName;
    let accountId;

    if (account) {
      accountCode = account.accountCode || 'UNKNOWN';
      accountName = account.accountName;
      accountId = account.id;
    } else if (expense.category) {
      // No linked account: group by category name so it still appears in operating expenses
      accountCode = `cat:${expense.category}`;
      accountName = expense.category;
      accountId = null;
    } else {
      console.warn(`Expense ${expense.id} missing expenseAccountId and category; skipping.`);
      return;
    }

    const accountLabel = account ? (account.accountCode ? `${account.accountCode} - ${account.accountName}` : account.accountName) : accountName;

    if (!expensesByAccountCode[accountCode]) {
      expensesByAccountCode[accountCode] = {
        accountCode,
        accountName,
        accountId,
        amount: 0,
        categoryNames: new Set(),
        details: []
      };
    }

    expensesByAccountCode[accountCode].amount += amount;
    if (expense.category) {
      expensesByAccountCode[accountCode].categoryNames.add(expense.category);
    }
    expensesByAccountCode[accountCode].details.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      category: expense.category,
      accountId,
      accountName,
      accountCode,
      amount,
      submittedBy: expense.submittedBy?.name || 'N/A',
      paymentMethod: expense.paymentMethod,
      reference: expense.paymentReference || expense.id
    });

    if (!expensesByCategory[accountLabel]) {
      expensesByCategory[accountLabel] = { amount: 0, details: [] };
    }
    expensesByCategory[accountLabel].amount += amount;
    expensesByCategory[accountLabel].details.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      accountId,
      accountName,
      accountCode,
      amount,
      submittedBy: expense.submittedBy?.name || 'N/A',
      paymentMethod: expense.paymentMethod,
      reference: expense.paymentReference || expense.id
    });

    expenseDetails.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      category: expense.category,
      accountId,
      accountName,
      accountCode,
      amount,
      submittedBy: expense.submittedBy?.name || 'N/A'
    });
  });

  // Payroll expenses: aggregate from TransactionLine (sourceType = 'Payroll') by expense account
  try {
    const payrollLines = await prisma.transactionLine.findMany({
      where: {
        transaction: {
          tenantId,
          status: 'posted',
          sourceType: 'Payroll',
          date: { gte: start, lte: end },
          ...(branchId ? { branchId } : {})
        },
        account: {
          tenantId,
          accountType: 'Expense',
          isActive: true
        }
      },
      select: {
        id: true,
        accountId: true,
        transactionId: true,
        debitAmount: true,
        creditAmount: true,
        account: {
          select: { id: true, accountCode: true, accountName: true }
        }
      }
    });
    payrollLines.forEach((line) => {
      const net = Number(line.debitAmount || 0) - Number(line.creditAmount || 0);
      if (net <= 0 || !line.account) return;
      const acc = line.account;
      const accountCode = acc.accountCode || `ACC-${acc.id}`;
      if (!expensesByAccountCode[accountCode]) {
        expensesByAccountCode[accountCode] = {
          accountCode,
          accountName: acc.accountName,
          accountId: acc.id,
          amount: 0,
          categoryNames: new Set(),
          details: []
        };
      }
      expensesByAccountCode[accountCode].amount += net;
      expensesByAccountCode[accountCode].details.push({
        id: `payroll-${line.id}`,
        date: null,
        description: 'Payroll expense',
        category: acc.accountName,
        accountId: acc.id,
        accountName: acc.accountName,
        accountCode: acc.accountCode,
        amount: net,
        submittedBy: 'Payroll',
        reference: 'Payroll'
      });
    });
  } catch (err) {
    console.warn('Payroll aggregation for income statement:', err?.message || err);
  }

  // Data source for operating expenses: Expense tracking module + Payroll + Depreciation only (no generic GL).
  // Operating section is rolled up to PHINDU main CoA lines (see incomeStatementOperatingExpenseRollup).

  // Depreciation from asset schedules: add to expensesByAccountCode (user-facing "Depreciation" line)
  const depreciationSchedules = await prisma.depreciationSchedule.findMany({
    where: {
      asset: { tenantId },
      periodStart: { lte: end },
      periodEnd: { gte: start }
    },
    include: { asset: true }
  });
  let totalDepreciation = 0;
  const depreciationDetails = [];
  depreciationSchedules.forEach((schedule) => {
    const scheduleStart = new Date(schedule.periodStart);
    const scheduleEnd = new Date(schedule.periodEnd);
    const reportStart = new Date(start);
    const reportEnd = new Date(end);
    const overlapStart = scheduleStart > reportStart ? scheduleStart : reportStart;
    const overlapEnd = scheduleEnd < reportEnd ? scheduleEnd : reportEnd;
    if (overlapStart <= overlapEnd) {
      const daysInSchedule = Math.ceil((scheduleEnd - scheduleStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysInPeriod = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
      const prorated = (Number(schedule.depreciationAmount) / daysInSchedule) * daysInPeriod;
      totalDepreciation += prorated;
      depreciationDetails.push({
        id: `depreciation-${schedule.id}`,
        date: schedule.periodStart,
        description: `Depreciation - ${schedule.asset?.name || 'Asset'}`,
        category: 'Depreciation',
        amount: prorated,
        submittedBy: 'System',
        reference: `DEP-${schedule.id}`
      });
    }
  });
  if (totalDepreciation > 0) {
    const depCode = 'DEP';
    if (!expensesByAccountCode[depCode]) {
      expensesByAccountCode[depCode] = {
        accountCode: depCode,
        accountName: 'Depreciation',
        accountId: null,
        amount: 0,
        categoryNames: new Set(['Depreciation']),
        details: []
      };
    }
    expensesByAccountCode[depCode].amount += totalDepreciation;
    expensesByAccountCode[depCode].details.push(...depreciationDetails);
    expenseDetails.push(...depreciationDetails);
  }

  // Build map by accountId (or synthetic key for category-only / DEP) for operating expenses list
  const amountsByAccountId = {};
  Object.values(expensesByAccountCode).forEach((data) => {
    const key = data.accountId ?? (data.accountCode === 'DEP' ? 'DEP' : data.accountCode);
    if (!amountsByAccountId[key]) {
      amountsByAccountId[key] = {
        amount: 0,
        details: [],
        accountCode: data.accountCode,
        accountName: data.accountName
      };
    }
    amountsByAccountId[key].amount += data.amount;
    amountsByAccountId[key].details.push(...(data.details || []));
  });

  // OPERATING EXPENSES: roll every bucket into PHINDU main CoA lines (no one-line-per-custom-category).
  const rolledOperating = new Map();
  for (const [key, bucket] of Object.entries(amountsByAccountId)) {
    const amount = Number(bucket?.amount) || 0;
    if (Math.abs(amount) < 1e-6) continue;
    const accountCode =
      (bucket.accountCode && String(bucket.accountCode).trim()) ||
      (typeof key === 'string' && !key.startsWith('cat:') ? String(key) : '');
    const { rollupCode, exclude } = resolveOperatingExpenseRollup({
      key: String(key),
      accountCode: accountCode || null,
      accountName: bucket.accountName
    });
    if (exclude || !rollupCode) continue;
    if (!rolledOperating.has(rollupCode)) {
      rolledOperating.set(rollupCode, { amount: 0, details: [] });
    }
    const row = rolledOperating.get(rollupCode);
    row.amount += amount;
    row.details.push(...(bucket.details || []));
  }

  const phinduLines = getPhinduOperatingExpenseDisplayLines();
  const operatingExpensesCategories = [];
  for (const line of phinduLines) {
    const data = rolledOperating.get(line.code);
    const rawAmt = data ? Number(data.amount) || 0 : 0;
    if (Math.abs(rawAmt) < 1e-6) continue;
    operatingExpensesCategories.push({
      accountCode: line.code,
      accountName: line.name,
      accountId: null,
      category: line.name,
      categoryNames: [line.name],
      amount: Math.round(rawAmt * 100) / 100,
      details: data?.details || []
    });
  }
  for (const [code, data] of rolledOperating.entries()) {
    if (phinduLines.some((l) => l.code === code)) continue;
    const rawAmt = Number(data.amount) || 0;
    if (Math.abs(rawAmt) < 1e-6) continue;
    const other = phinduLines.find((l) => l.code === '5900');
    const hit = operatingExpensesCategories.find((c) => c.accountCode === '5900');
    if (hit) {
      hit.amount = Math.round((hit.amount + rawAmt) * 100) / 100;
      hit.details.push(...(data.details || []));
    } else {
      operatingExpensesCategories.push({
        accountCode: '5900',
        accountName: other?.name || 'All Other Expenses (5000–5900)',
        accountId: null,
        category: other?.name || 'All Other Expenses (5000–5900)',
        categoryNames: [other?.name || 'All Other Expenses (5000–5900)'],
        amount: Math.round(rawAmt * 100) / 100,
        details: data.details || []
      });
    }
  }

  // Calculate total operating expenses
  const totalOperatingExpenses = operatingExpensesCategories.reduce(
    (sum, cat) => sum + cat.amount,
    0
  );

  // Create operatingExpenses object with dynamic categories
  const operatingExpenses = {
    categories: operatingExpensesCategories,
    total: totalOperatingExpenses,
    details: expenseDetails
  };

  const operatingIncome = grossProfit - totalOperatingExpenses;
  const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

  // Other Income, Other Expenses, Extraordinary items, Non-operating income are NOT included (removed)
  const incomeBeforeTax = operatingIncome;

  // Calculate tax (if tax accounts exist)
  let taxExpense = 0;
  const taxAccount = expenseAccounts.find(acc => {
    const name = (acc.accountName || '').toLowerCase();
    return name.includes('tax') || name.includes('income tax');
  });

  // Calculate tax expense directly from TransactionLine records (General Ledger)
  if (taxAccount) {
    try {
      // Get all posted transaction lines for tax account within the period
      const taxTransactionLines = await prisma.transactionLine.findMany({
        where: {
          accountId: taxAccount.id,
          transaction: {
            tenantId,
            status: 'posted',
            date: {
              gte: start,
              lte: end
            },
            ...(branchId ? { branchId } : {})
          }
        }
      });

      // Calculate period tax expense from TransactionLine records
      // For Expense accounts: Debit increases expense, Credit decreases
      const totalDebits = taxTransactionLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
      const totalCredits = taxTransactionLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
      taxExpense = totalDebits - totalCredits; // Net tax expense for the period
    } catch (error) {
      console.error(`Error calculating tax expense for account ${taxAccount.accountCode} (${taxAccount.accountName}):`, error);
      // Continue with taxExpense = 0 if calculation fails
      taxExpense = 0;
    }
  }

  // Per spec: Net Profit = Gross Profit − Total Operating Expenses (no separate tax line).
  // Tax is retained as informational metadata only.
  const netIncome = operatingIncome;
  const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Get budgets for the period to include budget vs actual comparisons
  let budgetData = null;
  try {
    const activeBudgets = await prisma.budget.findMany({
      where: {
        tenantId,
        status: { in: ['active', 'approved'] },
        startDate: { lte: end },
        endDate: { gte: start }
      },
      include: {
        items: true,
        breakdowns: true
      }
    });

    if (activeBudgets.length > 0) {
      // Get budget vs actual for revenue and expense budgets
      const budgetComparisons = await Promise.all(
        activeBudgets.map(async (budget) => {
          try {
            const comparison = await getBudgetVsActual(budget.id, tenantId, end);
            return {
              budgetId: budget.id,
              budgetName: budget.name,
              budgetType: budget.budgetType || 'revenue',
              budgeted: budget.expectedRevenue,
              actual: comparison.comparison.actualRevenue,
              variance: comparison.comparison.variance.amount,
              variancePercent: comparison.comparison.variance.percent,
              achievement: comparison.comparison.achievement.percent,
              status: comparison.comparison.achievement.status
            };
          } catch (error) {
            console.error(`Error getting budget comparison for ${budget.id}:`, error);
            return null;
          }
        })
      );

      const validComparisons = budgetComparisons.filter(Boolean);
      
      if (validComparisons.length > 0) {
        const revenueBudget = validComparisons.find(b => b.budgetType === 'revenue');
        const expenseBudget = validComparisons.find(b => b.budgetType === 'expense');

        budgetData = {
          revenue: revenueBudget ? {
            budgeted: revenueBudget.budgeted,
            actual: revenueBudget.actual,
            variance: revenueBudget.variance,
            variancePercent: revenueBudget.variancePercent,
            achievement: revenueBudget.achievement,
            status: revenueBudget.status
          } : null,
          expenses: expenseBudget ? {
            budgeted: expenseBudget.budgeted,
            actual: expenseBudget.actual,
            variance: expenseBudget.variance,
            variancePercent: expenseBudget.variancePercent,
            achievement: expenseBudget.achievement,
            status: expenseBudget.status
          } : null,
          netIncome: revenueBudget && expenseBudget ? {
            budgeted: revenueBudget.budgeted - expenseBudget.budgeted,
            actual: netIncome,
            variance: netIncome - (revenueBudget.budgeted - expenseBudget.budgeted),
            variancePercent: (revenueBudget.budgeted - expenseBudget.budgeted) > 0
              ? (((netIncome - (revenueBudget.budgeted - expenseBudget.budgeted)) / (revenueBudget.budgeted - expenseBudget.budgeted)) * 100)
              : 0
          } : null
        };
      }
    }
  } catch (budgetError) {
    console.error('Error fetching budget data for income statement:', budgetError);
    // Continue without budget data if there's an error
  }

  // Validate calculations
  const calculatedGrossProfit = totalRevenue - cogs.costOfProductsSold;
  const calculatedOperatingIncome = calculatedGrossProfit - totalOperatingExpenses;
  const calculatedNetIncome = calculatedOperatingIncome;
  
  // Ensure calculated values match
  if (Math.abs(grossProfit - calculatedGrossProfit) > 0.01) {
    console.warn('⚠️ Gross profit mismatch:', { grossProfit, calculatedGrossProfit });
  }
  if (Math.abs(operatingIncome - calculatedOperatingIncome) > 0.01) {
    console.warn('⚠️ Operating income mismatch:', { operatingIncome, calculatedOperatingIncome });
  }
  if (Math.abs(netIncome - calculatedNetIncome) > 0.01) {
    console.warn('⚠️ Net income mismatch:', { netIncome, calculatedNetIncome });
  }
  
  const result = {
    companyName,
    logoUrl,
    period: {
      startDate: formatYmdInTimeZone(start, DEFAULT_REPORT_TIMEZONE),
      endDate: formatYmdInTimeZone(end, DEFAULT_REPORT_TIMEZONE)
    },
    revenue,
    totalRevenue,
    cogs,
    grossProfit: calculatedGrossProfit, // Use calculated value for accuracy
    grossProfitMargin: totalRevenue > 0 ? (calculatedGrossProfit / totalRevenue) * 100 : 0,
    operatingExpenses,
    totalOperatingExpenses,
    operatingIncome: calculatedOperatingIncome,
    operatingMargin: totalRevenue > 0 ? (calculatedOperatingIncome / totalRevenue) * 100 : 0,
    otherIncomeExpenses: { interestIncome: 0, interestExpense: 0, otherIncome: 0, otherExpenses: 0, total: 0 },
    incomeBeforeTax: calculatedOperatingIncome,
    taxExpense,
    netIncome: calculatedNetIncome, // Use calculated value for accuracy
    netProfitMargin: totalRevenue > 0 ? (calculatedNetIncome / totalRevenue) * 100 : 0,
    budget: budgetData,
    metadata: {
      revenueAccounts: 0,
      expenseAccounts: expenseAccounts.length,
      expenseCategories: operatingExpensesCategories.length,
      generatedAt: new Date().toISOString(),
      dataSource:
        'Revenue and COGS system-generated. COGS excludes shipping. Operating expenses roll up to Chart of Accounts main lines (expense tracking + payroll + depreciation). Same logic for dashboard, Excel, PDF.',
      branchId: branchId || null,
      hasBudgetData: budgetData !== null
    }
  };
  
  console.log('✅ Income Statement Generated Successfully:', {
    revenue: totalRevenue,
    cogs: cogs.costOfProductsSold,
    expenses: totalOperatingExpenses,
    netIncome: calculatedNetIncome,
    revenueAccounts: 0,
    expenseAccounts: expenseAccounts.length
  });
  
  return result;
}










