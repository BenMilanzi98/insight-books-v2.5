// lib/incomeStatementService.js
/**
 * Income Statement Service
 * Single source of truth for P&L. Same logic must be used for dashboard, Excel, and PDF.
 *
 * SYSTEM RULES (NON-NEGOTIABLE)
 * 1. Revenue and COGS are system-generated — no user input.
 * 2. Users cannot edit Income Statement figures — read-only everywhere.
 * 3. Shipping costs are never part of COGS — COGS is product cost only (FIFO/cost at sale).
 * 4. P&L COGS prefers net GL on COGS accounts (debits − credits); if none in period, sale/invoice activity estimate.
 * 5. Operating expenses use each line’s **actual Chart of Accounts** account (category-linked GL); rollup only excludes COGS / non-operating buckets.
 * 6. Same logic for dashboard, Excel, and PDF — all must use this service (getSalesRevenueForPeriod, getCOGSTransactionStats, generateIncomeStatementFromAccounts).
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';
import { getBudgetVsActual, getRevenueBudgets } from './budgetService';
import { getCOGSTransactionStats } from './cogsIntegration';
import { getCogsAccountIdsForExpenseRegister } from './getCogsAccountIdsForExpenseRegister';
import { resolveDefaultRevenueAccountId } from './defaultRevenueAccount.js';
import { CODE_PRODUCT_SALES } from './coaPostingCodes.js';
import { sumNetCogsDebitMinusCredit } from './dashboardCogsNet';
import { normalizeBranchId } from './branchAccess';
import { ensureExpenseAccountsForTenant, EXPENSE_ACCOUNTS_TEMPLATE } from './expenseCategoriesTemplate';
import { buildOperatingExpenseAccountLines } from './incomeStatementOperatingAccountDisplay';
import { filterExpensesForIncomeStatementOperating } from './incomeStatementExpenseDedup';
import {
  ensureDuplicate5200MergedInto5301,
  resolveIncomeStatementExpenseAccountFields,
} from './incomeStatementExpenseAccountResolution';
import { ensureLegacyExpenseAccountMerges } from './legacyExpenseAccountRemaps';
import { formatYmdInTimeZone, DEFAULT_REPORT_TIMEZONE, parseInclusiveApiYmdRange } from './dateUtils';
import {
  roundReportAmount,
} from './reportLineNetRevenue';
import {
  validSaleReportWhere,
} from './reportingSourceRules';
import { addMoney, multiplyMoney, parseMoney, roundMoney, subtractMoney } from './money';

/**
 * Sales Revenue — aligned with `/api/dashboard/metrics` (same period rules).
 * - Invoices: sum of **completed** `Payment.amount` with `paymentDate` in range (cash received on AR).
 * - POS: sum of `Sale.total` for `status: 'completed'` with `saleDate` in range.
 * @param {string} tenantId
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string|null} branchId
 * @returns {Promise<number>}
 */
export async function getSalesRevenueForPeriod(tenantId, startDate, endDate, branchId = null) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
  const branchFilterId = branchId ? normalizeBranchId(branchId) : null;

  const paymentWhere = {
    tenantId,
    isReversal: false,
    invoiceId: { not: null },
    status: { equals: 'Completed', mode: 'insensitive' },
    paymentDate: { gte: start, lte: end },
    ...(branchFilterId
      ? {
          OR: [
            { branchId: branchFilterId },
            { invoice: { branchId: branchFilterId } },
          ],
        }
      : {}),
  };

  const saleWhere = {
    ...validSaleReportWhere(tenantId, 'saleDate', start, end),
    ...(branchFilterId ? { branchId: branchFilterId } : {}),
  };

  const [paymentAgg, salesAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    }),
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { total: true },
    }),
  ]);

  const invoicePayments = parseMoney(paymentAgg._sum.amount);
  const posTotals = parseMoney(salesAgg._sum.total);
  return roundReportAmount(addMoney(invoicePayments, posTotals));
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
    const amt = parseMoney(c.cogsAmount);
    if (c.saleItemId) fifoBySaleItem[c.saleItemId] = addMoney(fifoBySaleItem[c.saleItemId] || 0, amt);
  }

  let total = 0;
  for (const item of saleItems) {
    let itemCOGS = 0;
    const customData = typeof item.customProductData === 'string'
      ? (() => { try { return JSON.parse(item.customProductData); } catch { return null; } })()
      : item.customProductData;

    if (customData && typeof customData === 'object' && customData.fifoCogs != null && customData.fifoCogs.cogsAmount != null) {
      const v = customData.fifoCogs.cogsAmount;
      itemCOGS = parseMoney(v);
    }
    if (itemCOGS === 0 && item.id && fifoBySaleItem[item.id] != null) {
      itemCOGS = fifoBySaleItem[item.id];
    }
    if (itemCOGS === 0 && customData && typeof customData === 'object' && customData.productCostAtSale != null) {
      itemCOGS = multiplyMoney(customData.productCostAtSale, item.quantity);
    }
    if (itemCOGS === 0 && item.product && item.product.cost != null) {
      itemCOGS = multiplyMoney(item.product.cost, item.quantity);
    }
    total = addMoney(total, itemCOGS);
  }
  return roundMoney(total);
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

  const periodStartYmd =
    String(startDate ?? '')
      .trim()
      .match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const periodEndYmd =
    String(endDate ?? '')
      .trim()
      .match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  // Validate date range
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
  
  const branchFilterId = branchId ? normalizeBranchId(branchId) : null;

  await ensureDuplicate5200MergedInto5301(prisma, tenantId);
  await ensureLegacyExpenseAccountMerges(prisma, tenantId);

  console.log('📊 Generating Income Statement (Revenue = Sales Revenue only):', {
    tenantId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    branchId: branchFilterId || 'all branches'
  });

  // REVENUE: One line only — Sales Revenue = POS completed sales + Invoices (Paid/Completed)
  const salesRevenueTotal = await getSalesRevenueForPeriod(tenantId, start, end, branchFilterId);

  let salesRevenueAccountId = await resolveDefaultRevenueAccountId(prisma, tenantId);
  let salesRevenueAccountCode = CODE_PRODUCT_SALES;
  if (salesRevenueAccountId) {
    const revAcc = await prisma.account.findUnique({
      where: { id: salesRevenueAccountId },
      select: { accountCode: true },
    });
    if (revAcc?.accountCode) salesRevenueAccountCode = revAcc.accountCode;
  } else {
    const revFallback = await prisma.account.findFirst({
      where: { tenantId, accountCode: CODE_PRODUCT_SALES, mergedIntoAccountId: null },
      select: { id: true, accountCode: true },
    });
    salesRevenueAccountId = revFallback?.id ?? null;
    salesRevenueAccountCode = revFallback?.accountCode ?? CODE_PRODUCT_SALES;
  }

  const revenue = {
    salesRevenue: salesRevenueTotal,
    serviceRevenue: 0,
    otherIncome: 0,
    details: [],
    lineItems: [{
      key: 'sales-revenue',
      label: 'Sales Revenue',
      amount: salesRevenueTotal,
      accountId: salesRevenueAccountId,
      accountCode: salesRevenueAccountCode,
      details: []
    }]
  };
  const totalRevenue = salesRevenueTotal;

  // Get expense accounts (for operating expenses and tax only; COGS is computed separately below)
  const expenseAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      mergedIntoAccountId: null,
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountSubtype: true,
      isActive: true,
      visibleInChart: true,
    }
  });

  // COGS: prefer net GL on COGS accounts (posted journals — POS + invoice COGS recognition, net of reversals).
  // Fallback: activity-based estimate when GL net is ~0 (no postings / legacy) but sales/invoices imply COGS.
  let cogsAccountIds = [];
  let costOfGoodsSoldGl = 0;
  try {
    cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tenantId);
    if (cogsAccountIds.length > 0) {
      const transactionWhere = {
        tenantId,
        date: { gte: start, lte: end },
        status: 'posted',
      };
      if (branchFilterId) {
        transactionWhere.OR = [{ branchId: branchFilterId }, { branchId: null }];
      }
      costOfGoodsSoldGl = await sumNetCogsDebitMinusCredit(prisma, {
        cogsAccountIds,
        transactionWhere,
      });
    }
  } catch (glCogsErr) {
    console.warn('Income statement: GL COGS aggregate failed, using activity fallback:', glCogsErr?.message || glCogsErr);
  }

  const cogsStats = await getCOGSTransactionStats(tenantId, start, end, branchFilterId);
  const costOfGoodsSoldFromActivity = roundMoney(cogsStats?.totalAmount);
  const glRounded = roundMoney(costOfGoodsSoldGl);
  const useGlCogs =
    cogsAccountIds.length > 0 && Math.abs(glRounded) > 1e-6;
  const costOfGoodsSoldRaw = useGlCogs ? glRounded : costOfGoodsSoldFromActivity;
  const costOfGoodsSold = roundMoney(costOfGoodsSoldRaw);

  let cogsPrimaryAccountId = cogsAccountIds[0] ?? null;
  let cogsPrimaryAccountCode = null;
  if (cogsAccountIds.length > 0) {
    const cogsAccRows = await prisma.account.findMany({
      where: { id: { in: cogsAccountIds }, tenantId },
      select: { id: true, accountCode: true },
      orderBy: { accountCode: 'asc' },
    });
    if (cogsAccRows.length > 0) {
      cogsPrimaryAccountId = cogsAccRows[0].id;
      cogsPrimaryAccountCode = cogsAccRows[0].accountCode;
    }
  }

  const cogs = {
    costOfProductsSold: costOfGoodsSold,
    freightShippingCosts: 0, // Shipping never part of COGS
    details: [],
    lineItems: [{
      key: 'cost-of-goods-sold',
      label: 'Cost of Goods Sold',
      amount: costOfGoodsSold,
      accountId: cogsPrimaryAccountId,
      accountCode: cogsPrimaryAccountCode,
      details: []
    }],
    total: costOfGoodsSold,
    /** True when COGS is taken from posted GL (COGS accounts), not the sale/invoice activity fallback. */
    fromGeneralLedger: useGlCogs,
  };

  // GROSS PROFIT — auto-calculated: Sales Revenue − Cost of Goods Sold
  const grossProfit = subtractMoney(totalRevenue, costOfGoodsSold);
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ========== OPERATING EXPENSES SECTION - DYNAMIC CATEGORIES ==========
  // Get all expenses from Expense table and group by actual category names
  let expenses = [];
  try {
    expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        status: 'Approved',
        date: { gte: start, lte: end },
        isDeleted: false,
        isReversal: false,
        ...(branchFilterId ? { OR: [{ branchId: branchFilterId }, { branchId: null }] } : {})
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

  expenses = filterExpensesForIncomeStatementOperating(expenses, {
    cogsAccountIds,
    glCogsTotal: glRounded,
    glCogsLineCount: useGlCogs ? 1 : 0,
  });

  const expenseAccountNameByCode = new Map(
    expenseAccounts.map((acc) => [acc.accountCode, acc.accountName])
  );
  const expenseAccountIdByCode = new Map(
    expenseAccounts.map((acc) => [acc.accountCode, acc.id])
  );

  // Group expenses by account code (normalized grouping)
  // This ensures duplicate categories map to the same account code
  const expensesByAccountCode = {};
  const expensesByCategory = {}; // Keep for backward compatibility
  const expenseDetails = [];

  expenses.forEach(expense => {
    const account = expense.expenseAccount;
    const amount = parseMoney(expense.amount);

    const resolved = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: account,
      category: expense.category,
      description: expense.description,
      notes: expense.notes,
      isPayrollGl: false,
      tenantNameByCode: expenseAccountNameByCode,
    });

    let accountCode = resolved.accountCode;
    let accountName = resolved.accountName;
    let accountId = resolved.accountId;

    if (!accountCode) {
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

    expensesByAccountCode[accountCode].amount = addMoney(expensesByAccountCode[accountCode].amount, amount);
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
    expensesByCategory[accountLabel].amount = addMoney(expensesByCategory[accountLabel].amount, amount);
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

  // Payroll expenses: aggregate from TransactionLine (sourceType = 'Payroll') by expense account.
  // Exclude reversed payroll: (1) Payroll row status Reversed (sourceId on journal), (2) original journal
  // in this period that has a posted reversal (reversal uses sourceType 'Transaction', so it is not in this query).
  let reversedPayrollSourceIds = new Set();
  let reversedPayrollJournalTxnIds = new Set();
  try {
    const reversedRows = await prisma.payroll.findMany({
      where: { tenantId, status: 'Reversed' },
      select: { id: true },
    });
    reversedPayrollSourceIds = new Set(reversedRows.map((p) => p.id));

    const payrollTxnBaseWhere = {
      tenantId,
      status: 'posted',
      isReversal: false,
      sourceType: { in: ['Payroll', 'payroll', 'PAYROLL'] },
      date: { gte: start, lte: end },
      ...(branchFilterId ? { branchId: branchFilterId } : {}),
    };
    const payrollJournalsInPeriod = await prisma.transaction.findMany({
      where: payrollTxnBaseWhere,
      select: { id: true },
    });
    const payrollTxnIdsInPeriod = payrollJournalsInPeriod.map((t) => t.id);
    if (payrollTxnIdsInPeriod.length > 0) {
      const reversalsTargetingPayrollJnls = await prisma.transaction.findMany({
        where: {
          tenantId,
          isReversal: true,
          reversedTransactionId: { in: payrollTxnIdsInPeriod },
        },
        select: { reversedTransactionId: true },
      });
      reversedPayrollJournalTxnIds = new Set(
        reversalsTargetingPayrollJnls.map((r) => r.reversedTransactionId).filter(Boolean)
      );
    }
  } catch (e) {
    console.warn('Income statement: reversed payroll lookup failed', e?.message || e);
  }

  try {
    const payrollLines = await prisma.transactionLine.findMany({
      where: {
        transaction: {
          tenantId,
          status: 'posted',
          isReversal: false,
          sourceType: { in: ['Payroll', 'payroll', 'PAYROLL'] },
          date: { gte: start, lte: end },
          ...(branchFilterId ? { branchId: branchFilterId } : {})
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
        },
        transaction: {
          select: { id: true, sourceId: true, date: true }
        }
      }
    });
    payrollLines.forEach((line) => {
      const txn = line.transaction;
      if (txn) {
        if (txn.id && reversedPayrollJournalTxnIds.has(txn.id)) return;
        if (txn.sourceId && reversedPayrollSourceIds.has(txn.sourceId)) return;
      }
      const net = subtractMoney(line.debitAmount, line.creditAmount);
      if (net <= 0 || !line.account) return;
      const acc = line.account;
      const payrollResolved = resolveIncomeStatementExpenseAccountFields({
        expenseAccount: acc,
        category: acc.accountName,
        description: 'Payroll expense',
        notes: null,
        isPayrollGl: true,
        tenantNameByCode: expenseAccountNameByCode,
      });
      const accountCode = payrollResolved.accountCode || acc.accountCode || `ACC-${acc.id}`;
      const accountName = payrollResolved.accountName || acc.accountName;
      const accountId = payrollResolved.accountId;
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
      expensesByAccountCode[accountCode].amount = addMoney(expensesByAccountCode[accountCode].amount, net);
      expensesByAccountCode[accountCode].details.push({
        id: `payroll-${line.id}`,
        date: null,
        description: 'Payroll expense',
        category: accountName,
        accountId,
        accountName,
        accountCode: payrollResolved.accountCode || acc.accountCode,
        amount: net,
        submittedBy: 'Payroll',
        reference: 'Payroll'
      });
    });
  } catch (err) {
    console.warn('Payroll aggregation for income statement:', err?.message || err);
  }

  // Data source for operating expenses: Expense tracking module + Payroll + Depreciation only (no generic GL).
  // Operating section is rolled up to SYSTEM main CoA lines (see incomeStatementOperatingExpenseRollup).

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
      const prorated = roundMoney((parseMoney(schedule.depreciationAmount) / daysInSchedule) * daysInPeriod);
      totalDepreciation = addMoney(totalDepreciation, prorated);
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
    expensesByAccountCode[depCode].amount = addMoney(expensesByAccountCode[depCode].amount, totalDepreciation);
    expensesByAccountCode[depCode].details.push(...depreciationDetails);
    expenseDetails.push(...depreciationDetails);
  }

  // Build map by accountId (or synthetic key for category-only / DEP) for operating expenses list
  const amountsByAccountId = {};
  Object.values(expensesByAccountCode).forEach((data) => {
    const key =
      data.accountCode === 'DEP'
        ? 'DEP'
        : data.accountCode
          ? String(data.accountCode)
          : data.accountId ?? 'unknown';
    if (!amountsByAccountId[key]) {
      amountsByAccountId[key] = {
        amount: 0,
        details: [],
        accountCode: data.accountCode,
        accountName: data.accountName,
        accountId: data.accountId ?? null
      };
    }
    amountsByAccountId[key].amount = addMoney(amountsByAccountId[key].amount, data.amount);
    amountsByAccountId[key].details.push(...(data.details || []));
  });

  /** One row per actual CoA account — drill-down details stay on that account only. */
  const operatingExpenseAccountLines = buildOperatingExpenseAccountLines(
    amountsByAccountId,
    expenseAccountNameByCode,
    expenseAccountIdByCode
  );

  // Operating expense categories mirror account lines (same codes, names, details).
  const operatingExpensesCategories = operatingExpenseAccountLines.map((line) => ({
    accountCode: line.accountCode,
    accountName: line.accountName,
    accountId: line.accountId,
    category:
      line.accountCode && line.accountName
        ? `${line.accountCode} - ${line.accountName}`
        : line.accountName || line.accountCode,
    categoryNames: [line.accountName].filter(Boolean),
    amount: line.amount,
    details: line.details || [],
  }));

  // Calculate total operating expenses
  const totalOperatingExpenses = operatingExpensesCategories.reduce(
    (sum, cat) => addMoney(sum, cat.amount),
    0
  );

  // Create operatingExpenses object with dynamic categories
  const operatingExpenses = {
    categories: operatingExpensesCategories,
    accountLines: operatingExpenseAccountLines,
    total: totalOperatingExpenses,
    details: expenseDetails
  };

  const operatingIncome = subtractMoney(grossProfit, totalOperatingExpenses);
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
            ...(branchFilterId ? { branchId: branchFilterId } : {})
          }
        }
      });

      // Calculate period tax expense from TransactionLine records
      // For Expense accounts: Debit increases expense, Credit decreases
      const totalDebits = taxTransactionLines.reduce((sum, line) => addMoney(sum, line.debitAmount), 0);
      const totalCredits = taxTransactionLines.reduce((sum, line) => addMoney(sum, line.creditAmount), 0);
      taxExpense = subtractMoney(totalDebits, totalCredits); // Net tax expense for the period
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
    const activeBudgets = await prisma.legacyBudget.findMany({
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
            budgeted: subtractMoney(revenueBudget.budgeted, expenseBudget.budgeted),
            actual: netIncome,
            variance: subtractMoney(netIncome, subtractMoney(revenueBudget.budgeted, expenseBudget.budgeted)),
            variancePercent: subtractMoney(revenueBudget.budgeted, expenseBudget.budgeted) > 0
              ? ((subtractMoney(netIncome, subtractMoney(revenueBudget.budgeted, expenseBudget.budgeted)) / subtractMoney(revenueBudget.budgeted, expenseBudget.budgeted)) * 100)
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
  const calculatedGrossProfit = subtractMoney(totalRevenue, cogs.costOfProductsSold);
  const calculatedOperatingIncome = subtractMoney(calculatedGrossProfit, totalOperatingExpenses);
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
      startDate:
        periodStartYmd ?? formatYmdInTimeZone(start, DEFAULT_REPORT_TIMEZONE),
      endDate: periodEndYmd ?? formatYmdInTimeZone(end, DEFAULT_REPORT_TIMEZONE),
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
        'Revenue and COGS system-generated. COGS from posted GL (COGS accounts) when available, else sale/invoice cost estimates; excludes shipping. Operating expenses: report lists each expense account (or category) with period activity; rolled categories remain for exports. Same logic for dashboard, Excel, PDF.',
      branchId: branchFilterId || null,
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










