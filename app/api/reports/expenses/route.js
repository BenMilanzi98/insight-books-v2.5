// app/api/reports/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';
import { sumNetCogsDebitMinusCredit } from '@/lib/dashboardCogsNet';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import {
  expenseOverlapsGlCogsForDedup,
  isGlCogsWindowActive,
} from '@/lib/expenseRegisterGlCogsOverlap';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import {
  buildExpenseReconciliation,
  getGlPeriodTotals,
} from '@/lib/reportingEngine/index.js';
import {
  bootstrapReportRoute,
  auditReportAccess,
  enrichRowsWithTenantName,
  tenantNameMap,
} from '@/lib/reportRouteBootstrap';

function monthKeyFromDate(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromDate(d) {
  return new Date(d).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, userQ, tw, scope, tenantIds, tenants, reportBranchId } = boot;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
    const categoryLower = typeof category === 'string' ? category.toLowerCase() : '';
    const includeCogsInReport =
      !category ||
      categoryLower.includes('cost of goods') ||
      categoryLower.includes('cogs');

    const filter = addBranchFilterIncludeUnassigned(userQ, {
      ...tw,
      status: 'Approved',
      isDeleted: false,
      isReversal: false,
      date: {
        gte: start,
        lte: end,
      },
    });

    if (category) {
      filter.category = category;
    }

    const expenses = await prisma.expense.findMany({
      where: filter,
      select: {
        id: true,
        tenantId: true,
        description: true,
        amount: true,
        date: true,
        category: true,
        categoryId: true,
        expenseAccountId: true,
        status: true,
        merchant: true,
        expenseCategory: {
          select: {
            accountId: true,
            accountCode: true,
            name: true,
          },
        },
        submittedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const categoryCodeMap = {};
    try {
      const expenseCategories = await prisma.expenseCategory.findMany({
        where: { ...tw },
        select: { name: true, accountCode: true },
      });
      expenseCategories.forEach((ec) => {
        if (ec.name) categoryCodeMap[ec.name] = ec.accountCode || '';
      });
    } catch (_) {
      /* non-fatal */
    }

    expenses.forEach((exp) => {
      exp.accountCode =
        exp.expenseCategory?.accountCode || categoryCodeMap[exp.category] || '';
    });

    const cogsAccountIds = includeCogsInReport
      ? await getCogsAccountIdsForExpenseRegister(prisma, tw)
      : [];
    const cogsIdSet = new Set(cogsAccountIds);

    const transactionWhere = {
      ...tw,
      status: { in: ['posted', 'Posted'] },
      date: {
        gte: start,
        lte: end,
      },
    };
    const bid =
      userQ?.currentBranchId &&
      (typeof userQ.currentBranchId === 'string'
        ? userQ.currentBranchId
        : userQ.currentBranchId?.id);
    if (bid) {
      transactionWhere.OR = [{ branchId: bid }, { branchId: null }];
    }

    let reversedParentIds = [];
    if (includeCogsInReport && cogsAccountIds.length > 0) {
      try {
        const reversedParents = await prisma.transaction.findMany({
          where: {
            ...tw,
            isReversal: true,
            reversedTransactionId: { not: null },
          },
          select: { reversedTransactionId: true },
        });
        reversedParentIds = [
          ...new Set(reversedParents.map((r) => r.reversedTransactionId).filter(Boolean)),
        ];
      } catch (reversalErr) {
        console.warn('Expense report: COGS reversal filter skipped', reversalErr?.message);
      }
      if (reversedParentIds.length > 0) {
        transactionWhere.id = { notIn: reversedParentIds };
      }
    }

    let cogsTotal = 0;
    let cogsTransactionCount = 0;
    const cogsByMonth = new Map();
    let cogsLines = [];

    if (includeCogsInReport && cogsAccountIds.length > 0) {
      cogsTotal = await sumNetCogsDebitMinusCredit(prisma, {
        cogsAccountIds,
        transactionWhere,
      });

      cogsLines = await prisma.transactionLine.findMany({
        where: {
          accountId: { in: cogsAccountIds },
          OR: [{ debitAmount: { gt: 0 } }, { creditAmount: { gt: 0 } }],
          transaction: transactionWhere,
        },
        select: {
          id: true,
          debitAmount: true,
          creditAmount: true,
          transaction: { select: { id: true, date: true, description: true, reference: true } },
        },
      });

      cogsTransactionCount = cogsLines.length;

      for (const line of cogsLines) {
        const net = subtractMoney(line.debitAmount, line.creditAmount);
        if (Math.abs(net) < 1e-9) continue;
        const txDate = line.transaction.date;
        const mk = monthKeyFromDate(txDate);
        cogsByMonth.set(mk, addMoney(cogsByMonth.get(mk) || 0, net));
      }
    }

    const glCogsActive =
      includeCogsInReport &&
      cogsAccountIds.length > 0 &&
      isGlCogsWindowActive(cogsTotal, cogsTransactionCount);

    const forAggregation =
      includeCogsInReport && glCogsActive
        ? expenses.filter((e) => !expenseOverlapsGlCogsForDedup(e, cogsIdSet, glCogsActive))
        : expenses;

    const registerSumAll = expenses.reduce((s, e) => addMoney(s, e.amount), 0);
    const registerSumNonCogsGl = forAggregation.reduce((s, e) => addMoney(s, e.amount), 0);
    const totalExpenses = includeCogsInReport ? addMoney(registerSumNonCogsGl, cogsTotal) : registerSumAll;
    const registerGlCogsOverlapAmount =
      glCogsActive && includeCogsInReport ? subtractMoney(registerSumAll, registerSumNonCogsGl) : 0;

    const expensesByCategory = {};
    for (const expense of forAggregation) {
      const key = expense.category;
      if (!expensesByCategory[key]) {
        expensesByCategory[key] = {
          category: expense.category,
          accountCode: expense.accountCode || categoryCodeMap[key] || '',
          total: 0,
          items: [],
        };
      }
      expensesByCategory[key].total = addMoney(expensesByCategory[key].total, expense.amount);
      expensesByCategory[key].items.push(expense);
    }

    if (includeCogsInReport && cogsAccountIds.length > 0 && cogsLines.length > 0) {
      const cogsLabel = 'Cost of Goods Sold';
      const cogsCode = categoryCodeMap[cogsLabel] || '';
      const sorted = [...cogsLines].sort(
        (a, b) => new Date(b.transaction.date) - new Date(a.transaction.date)
      );
      const cogsItems = sorted
        .slice(0, 300)
        .map((line) => {
          const debit = Number(line.debitAmount) || 0;
          const credit = Number(line.creditAmount) || 0;
          const net = subtractMoney(debit, credit);
          if (Math.abs(net) < 1e-9) return null;
          const ref = line.transaction.reference || '';
          return {
            id: `cogs-${line.transaction.id}-${line.id}`,
            description:
              line.transaction.description ||
              (net < 0 ? `COGS credit — ${ref || 'Journal'}` : `COGS — ${ref || 'Journal'}`),
            amount: net,
            date: line.transaction.date,
            merchant: 'General ledger',
            category: cogsLabel,
            status: 'Approved',
            accountCode: cogsCode,
          };
        })
        .filter(Boolean);

      if (cogsItems.length > 0 || Math.abs(cogsTotal) >= 1e-6) {
        expensesByCategory[cogsLabel] = {
          category: cogsLabel,
          accountCode: cogsCode,
          total: cogsTotal,
          items: cogsItems,
        };
      }
    }

    const expensesByMonth = {};
    for (const expense of forAggregation) {
      const mk = monthKeyFromDate(expense.date);
      const monthName = monthLabelFromDate(expense.date);
      if (!expensesByMonth[mk]) {
        expensesByMonth[mk] = {
          monthKey: mk,
          month: monthName,
          total: 0,
        };
      }
      expensesByMonth[mk].total = addMoney(expensesByMonth[mk].total, expense.amount);
    }

    for (const [mk, net] of cogsByMonth.entries()) {
      if (!expensesByMonth[mk]) {
        const synthetic = new Date(`${mk}-01T12:00:00`);
        expensesByMonth[mk] = {
          monthKey: mk,
          month: monthLabelFromDate(synthetic),
          total: 0,
        };
      }
      expensesByMonth[mk].total = addMoney(expensesByMonth[mk].total, net);
    }

    const availableCategories = Object.values(expensesByCategory)
      .map((c) => ({
        name: c.category,
        accountCode: c.accountCode || '',
        count: c.items.length,
        amount: c.total,
      }))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));

    let glTotals = null;
    try {
      for (const tenantId of tenantIds) {
        const t = await getGlPeriodTotals({
          tenantId,
          startDate,
          endDate,
          branchId: reportBranchId,
          prisma,
        });
        if (!glTotals) {
          glTotals = { ...t, accountLines: [...(t.accountLines || [])] };
        } else {
          glTotals.revenue = addMoney(glTotals.revenue, t.revenue);
          glTotals.cogs = addMoney(glTotals.cogs, t.cogs);
          glTotals.operatingExpenses = addMoney(glTotals.operatingExpenses, t.operatingExpenses);
          glTotals.totalExpenses = addMoney(glTotals.totalExpenses, t.totalExpenses);
          glTotals.hasGlActivity = glTotals.hasGlActivity || t.hasGlActivity;
          if (t.accountLines?.length) glTotals.accountLines.push(...t.accountLines);
        }
      }
    } catch (glErr) {
      console.warn('Expense report: GL reconciliation failed', glErr?.message || glErr);
    }

    const tMap = tenantNameMap(tenants);
    const enrichedExpenses = enrichRowsWithTenantName(expenses, tMap);

    let byTenant = null;
    if (tenantIds.length > 1) {
      byTenant = tenantIds.map((tid) => {
        const rows = expenses.filter((e) => e.tenantId === tid);
        return {
          tenantId: tid,
          tenantName: tMap.get(tid) || tid,
          totalExpenses: rows.reduce((sum, e) => addMoney(sum, e.amount), 0),
          expenseCount: rows.length,
        };
      });
    }

    await auditReportAccess({
      user,
      reportType: 'expenses',
      tenantIds,
      scope,
      filters: { startDate, endDate, category },
    });

    return NextResponse.json({
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalExpenses,
        registerApprovedTotal: registerSumAll,
        registerSubtotalExcludingCogsGlAccounts: registerSumNonCogsGl,
        registerGlCogsOverlapAmount,
        cogsFromGl: cogsTotal,
        cogsTransactionCount,
        expenseCount: expenses.length,
        availableCategories,
        glOperatingExpenses: glTotals?.operatingExpenses ?? 0,
        glCogs: glTotals?.cogs ?? 0,
        glTotalExpenses: glTotals?.totalExpenses ?? 0,
      },
      expensesByCategory: Object.values(expensesByCategory),
      expensesByMonth: Object.values(expensesByMonth).sort((a, b) =>
        (a.monthKey || '').localeCompare(b.monthKey || '')
      ),
      expenses: enrichedExpenses,
      metadata: {
        ledgerSource: 'general_ledger',
        fromGeneralLedger: Boolean(glTotals?.hasGlActivity),
        reconciliation: glTotals
          ? buildExpenseReconciliation(totalExpenses, glTotals)
          : null,
        glExpensesByAccount: (glTotals?.accountLines ?? []).filter((line) =>
          line.accountCode.startsWith('5')
        ),
        sourcePolicy: glTotals?.sourcePolicy ?? null,
      },
      scope,
      ...(byTenant ? { byTenant } : {}),
    });
  } catch (error) {
    console.error('Error generating expense report:', error);
    return NextResponse.json(
      { error: 'Failed to generate expense report. Please try again.' },
      { status: 500 }
    );
  }
}
