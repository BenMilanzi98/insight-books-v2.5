import prisma from '@/lib/prisma';
import { isBfExpenseAccount, isBfRevenueAccount } from '@/lib/bfCoaCategories';
import { listPeriodKeysInRange, assertPeriodKeyAllowed, intersectRange } from '@/lib/bfPeriods';
import {
  fetchActualsForAccounts,
  performancePercent,
  aggregateBfGlPnlOverview,
} from '@/lib/bfActualsEngine';

export const BF_PERIOD_TYPES = ['monthly', 'quarterly', 'yearly'];

export function normalizeBfPeriodType(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (t === 'annual' || t === 'yearly' || t === 'year') return 'yearly';
  if (t === 'quarter' || t === 'quarterly') return 'quarterly';
  if (t === 'month' || t === 'monthly') return 'monthly';
  return t;
}

async function loadAccountsForTenant(tenantId, ids) {
  if (!ids.length) return new Map();
  const rows = await prisma.account.findMany({
    where: { tenantId, id: { in: ids }, mergedIntoAccountId: null },
    select: { id: true, accountCode: true, accountName: true, accountType: true, type: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export async function assertAccountsExpenseType(tenantId, accountIds) {
  const map = await loadAccountsForTenant(tenantId, accountIds);
  for (const id of accountIds) {
    const acc = map.get(id);
    if (!acc) {
      throw new Error(`Account ${id} not found for this business or is merged.`);
    }
    if (!isBfExpenseAccount(acc)) {
      throw new Error(
        `Expense budget lines must use expense (or COGS) accounts: ${acc.accountCode || ''} ${acc.accountName || acc.id}`
      );
    }
  }
  return map;
}

export async function assertAccountsRevenueType(tenantId, accountIds) {
  const map = await loadAccountsForTenant(tenantId, accountIds);
  for (const id of accountIds) {
    const acc = map.get(id);
    if (!acc) {
      throw new Error(`Account ${id} not found for this business or is merged.`);
    }
    if (!isBfRevenueAccount(acc)) {
      throw new Error(
        `Forecast lines must use income/revenue accounts: ${acc.accountCode || ''} ${acc.accountName || acc.id}`
      );
    }
  }
  return map;
}

export async function listExpenseBudgets(tenantId, { status } = {}) {
  return prisma.bfExpenseBudgetHeader.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { lines: true } },
    },
  });
}

export async function getExpenseBudget(id, tenantId) {
  return prisma.bfExpenseBudgetHeader.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: { account: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createExpenseBudget(tenantId, userId, body) {
  const periodType = normalizeBfPeriodType(body.periodType);
  if (!BF_PERIOD_TYPES.includes(periodType)) {
    throw new Error('Invalid periodType (use monthly, quarterly, or yearly).');
  }
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Invalid startDate / endDate.');
  }
  return prisma.bfExpenseBudgetHeader.create({
    data: {
      tenantId,
      name: String(body.name || '').trim() || 'Untitled budget',
      periodType,
      startDate,
      endDate,
      status: body.status === 'active' ? 'active' : 'draft',
      createdById: userId || null,
    },
  });
}

export async function updateExpenseBudget(id, tenantId, body) {
  const existing = await prisma.bfExpenseBudgetHeader.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.status != null) data.status = body.status === 'active' ? 'active' : 'draft';
  if (body.periodType != null) data.periodType = normalizeBfPeriodType(body.periodType);
  if (body.startDate != null) data.startDate = new Date(body.startDate);
  if (body.endDate != null) data.endDate = new Date(body.endDate);
  const nextStart = data.startDate ?? existing.startDate;
  const nextEnd = data.endDate ?? existing.endDate;
  if (nextEnd < nextStart) {
    throw new Error('endDate must be on or after startDate.');
  }
  return prisma.bfExpenseBudgetHeader.update({
    where: { id },
    data,
  });
}

export async function deleteExpenseBudget(id, tenantId) {
  const existing = await prisma.bfExpenseBudgetHeader.findFirst({ where: { id, tenantId } });
  if (!existing) return false;
  await prisma.bfExpenseBudgetHeader.delete({ where: { id } });
  return true;
}

export async function replaceExpenseBudgetLines(id, tenantId, linesInput) {
  const header = await prisma.bfExpenseBudgetHeader.findFirst({ where: { id, tenantId } });
  if (!header) return null;

  const lines = Array.isArray(linesInput) ? linesInput : [];
  const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
  if (accountIds.length) {
    await assertAccountsExpenseType(tenantId, accountIds);
  }

  const seen = new Set();
  for (const l of lines) {
    if (!l.accountId || l.period == null) {
      throw new Error('Each line requires accountId and period.');
    }
    const dedupe = `${l.accountId}::${String(l.period)}`;
    if (seen.has(dedupe)) {
      throw new Error('Duplicate account and period in lines payload.');
    }
    seen.add(dedupe);
    assertPeriodKeyAllowed(String(l.period), header.periodType, header.startDate, header.endDate);
    const amt = Number(l.plannedAmount);
    if (Number.isNaN(amt) || amt < 0) {
      throw new Error('plannedAmount must be a non-negative number.');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.bfExpenseBudgetLine.deleteMany({ where: { expenseBudgetHeaderId: id } });
    if (lines.length) {
      await tx.bfExpenseBudgetLine.createMany({
        data: lines.map((l) => ({
          expenseBudgetHeaderId: id,
          accountId: l.accountId,
          period: String(l.period),
          plannedAmount: Number(l.plannedAmount) || 0,
        })),
      });
    }
  });

  return getExpenseBudget(id, tenantId);
}

export async function listRevenueForecasts(tenantId, { status } = {}) {
  return prisma.bfRevenueForecastHeader.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { lines: true } } },
  });
}

export async function getRevenueForecast(id, tenantId) {
  return prisma.bfRevenueForecastHeader.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: { account: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createRevenueForecast(tenantId, userId, body) {
  const periodType = normalizeBfPeriodType(body.periodType);
  if (!BF_PERIOD_TYPES.includes(periodType)) {
    throw new Error('Invalid periodType (use monthly, quarterly, or yearly).');
  }
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Invalid startDate / endDate.');
  }
  const version = String(body.version || 'v1').trim().slice(0, 32) || 'v1';
  return prisma.bfRevenueForecastHeader.create({
    data: {
      tenantId,
      name: String(body.name || '').trim() || 'Untitled forecast',
      periodType,
      startDate,
      endDate,
      version,
      status: body.status === 'active' ? 'active' : 'draft',
      createdById: userId || null,
    },
  });
}

export async function updateRevenueForecast(id, tenantId, body) {
  const existing = await prisma.bfRevenueForecastHeader.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.status != null) data.status = body.status === 'active' ? 'active' : 'draft';
  if (body.version != null) data.version = String(body.version).trim().slice(0, 32) || 'v1';
  if (body.periodType != null) data.periodType = normalizeBfPeriodType(body.periodType);
  if (body.startDate != null) data.startDate = new Date(body.startDate);
  if (body.endDate != null) data.endDate = new Date(body.endDate);
  const nextStart = data.startDate ?? existing.startDate;
  const nextEnd = data.endDate ?? existing.endDate;
  if (nextEnd < nextStart) {
    throw new Error('endDate must be on or after startDate.');
  }
  return prisma.bfRevenueForecastHeader.update({ where: { id }, data });
}

export async function deleteRevenueForecast(id, tenantId) {
  const existing = await prisma.bfRevenueForecastHeader.findFirst({ where: { id, tenantId } });
  if (!existing) return false;
  await prisma.bfRevenueForecastHeader.delete({ where: { id } });
  return true;
}

export async function replaceRevenueForecastLines(id, tenantId, linesInput) {
  const header = await prisma.bfRevenueForecastHeader.findFirst({ where: { id, tenantId } });
  if (!header) return null;

  const lines = Array.isArray(linesInput) ? linesInput : [];
  const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
  if (accountIds.length) {
    await assertAccountsRevenueType(tenantId, accountIds);
  }

  const seen = new Set();
  for (const l of lines) {
    if (!l.accountId || l.period == null) {
      throw new Error('Each line requires accountId and period.');
    }
    const dedupe = `${l.accountId}::${String(l.period)}`;
    if (seen.has(dedupe)) {
      throw new Error('Duplicate account and period in lines payload.');
    }
    seen.add(dedupe);
    assertPeriodKeyAllowed(String(l.period), header.periodType, header.startDate, header.endDate);
    const amt = Number(l.plannedAmount);
    if (Number.isNaN(amt) || amt < 0) {
      throw new Error('plannedAmount must be a non-negative number.');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.bfRevenueForecastLine.deleteMany({ where: { revenueForecastHeaderId: id } });
    if (lines.length) {
      await tx.bfRevenueForecastLine.createMany({
        data: lines.map((l) => ({
          revenueForecastHeaderId: id,
          accountId: l.accountId,
          period: String(l.period),
          plannedAmount: Number(l.plannedAmount) || 0,
        })),
      });
    }
  });

  return getRevenueForecast(id, tenantId);
}

export async function buildBfDashboardOverview({
  tenantId,
  branchScoped = false,
  branchId,
  reportStart,
  reportEnd,
}) {
  const rs = new Date(reportStart);
  const re = new Date(reportEnd);
  if (Number.isNaN(rs.getTime()) || Number.isNaN(re.getTime()) || re < rs) {
    throw new Error('Invalid report date range.');
  }
  const periodType = 'monthly';
  const keys = listPeriodKeysInRange(rs, re, periodType);
  const glance = await aggregateBfGlPnlOverview(prisma, {
    tenantId,
    branchScoped,
    branchId,
    rangeStart: rs,
    rangeEnd: re,
    periodType,
    periodKeys: keys,
  });

  const [activeBudgets, activeForecasts] = await Promise.all([
    prisma.bfExpenseBudgetHeader.count({ where: { tenantId, status: 'active' } }),
    prisma.bfRevenueForecastHeader.count({ where: { tenantId, status: 'active' } }),
  ]);

  return {
    mode: 'overview',
    periodType,
    periodKeys: keys,
    range: { start: rs, end: re },
    glance: {
      revenueActual: glance.revenueTotal,
      expenseActual: glance.expenseTotal,
      netActual: glance.netTotal,
    },
    byPeriod: glance.byPeriod,
    topRevenue: glance.topRevenue,
    topExpenses: glance.topExpenses,
    meta: { activeBudgets, activeForecasts },
  };
}

export async function buildPlVsActualReport({
  tenantId,
  branchScoped = false,
  branchId,
  expenseBudgetId,
  revenueForecastId,
  reportStart,
  reportEnd,
}) {
  const eHeader = expenseBudgetId
    ? await prisma.bfExpenseBudgetHeader.findFirst({ where: { id: expenseBudgetId, tenantId } })
    : null;
  const rHeader = revenueForecastId
    ? await prisma.bfRevenueForecastHeader.findFirst({ where: { id: revenueForecastId, tenantId } })
    : null;

  if (!eHeader && !rHeader) {
    throw new Error('Select at least one expense budget or revenue forecast.');
  }

  const rs = new Date(reportStart);
  const re = new Date(reportEnd);
  if (Number.isNaN(rs.getTime()) || Number.isNaN(re.getTime()) || re < rs) {
    throw new Error('Invalid report date range.');
  }

  const eLines = eHeader
    ? await prisma.bfExpenseBudgetLine.findMany({
        where: { expenseBudgetHeaderId: eHeader.id },
        include: { account: true },
      })
    : [];
  const rLines = rHeader
    ? await prisma.bfRevenueForecastLine.findMany({
        where: { revenueForecastHeaderId: rHeader.id },
        include: { account: true },
      })
    : [];

  if (eHeader && rHeader && eHeader.periodType !== rHeader.periodType) {
    throw new Error(
      'Expense budget and revenue forecast must use the same period type (monthly / quarterly / yearly) for a combined report.'
    );
  }
  const periodType = eHeader?.periodType || rHeader?.periodType;

  let envStart;
  let envEnd;
  if (eHeader && rHeader) {
    const hx = intersectRange(eHeader.startDate, eHeader.endDate, rHeader.startDate, rHeader.endDate);
    if (!hx) {
      throw new Error('The selected expense budget and revenue forecast date ranges do not overlap.');
    }
    envStart = hx.start;
    envEnd = hx.end;
  } else if (eHeader) {
    envStart = eHeader.startDate;
    envEnd = eHeader.endDate;
  } else {
    envStart = rHeader.startDate;
    envEnd = rHeader.endDate;
  }

  const overlap = intersectRange(rs, re, envStart, envEnd);
  if (!overlap) {
    throw new Error('Report range does not overlap the selected budget/forecast period.');
  }

  const allKeys = listPeriodKeysInRange(overlap.start, overlap.end, periodType);
  const keys = allKeys;

  const accountIds = [...new Set([...eLines.map((l) => l.accountId), ...rLines.map((l) => l.accountId)])];
  const accountsById = new Map();
  for (const line of [...eLines, ...rLines]) {
    if (line.account) accountsById.set(line.accountId, line.account);
  }
  const missing = accountIds.filter((id) => !accountsById.has(id));
  if (missing.length) {
    const extra = await prisma.account.findMany({
      where: { tenantId, id: { in: missing } },
      select: { id: true, accountCode: true, accountName: true, accountType: true, type: true },
    });
    for (const a of extra) accountsById.set(a.id, a);
  }

  const actualsMap = await fetchActualsForAccounts(prisma, {
    tenantId,
    branchScoped,
    branchId,
    periodType,
    periodKeys: keys,
    rangeStart: overlap.start,
    rangeEnd: overlap.end,
    accountIds,
    accountsById,
  });

  const revenueRows = [];
  let revPlanned = 0;
  let revActual = 0;
  for (const line of rLines) {
    if (!keys.includes(line.period)) continue;
    const pr = Number(line.plannedAmount) || 0;
    const act = actualsMap.get(`${line.accountId}::${line.period}`) || 0;
    revPlanned += pr;
    revActual += act;
    revenueRows.push({
      accountId: line.accountId,
      accountCode: line.account?.accountCode,
      accountName: line.account?.accountName,
      period: line.period,
      planned: pr,
      actual: act,
      variance: act - pr,
      performancePercent: performancePercent(act, pr),
    });
  }

  const expenseRows = [];
  let expPlanned = 0;
  let expActual = 0;
  for (const line of eLines) {
    if (!keys.includes(line.period)) continue;
    const pr = Number(line.plannedAmount) || 0;
    const act = actualsMap.get(`${line.accountId}::${line.period}`) || 0;
    expPlanned += pr;
    expActual += act;
    expenseRows.push({
      accountId: line.accountId,
      accountCode: line.account?.accountCode,
      accountName: line.account?.accountName,
      period: line.period,
      planned: pr,
      actual: act,
      variance: act - pr,
      performancePercent: performancePercent(act, pr),
    });
  }

  const profitPlanned = revPlanned - expPlanned;
  const profitActual = revActual - expActual;

  const insights = [];
  if (revPlanned > 0 && performancePercent(revActual, revPlanned) != null) {
    const pct = performancePercent(revActual, revPlanned);
    if (pct < 90) insights.push(`Revenue is about ${(100 - pct).toFixed(0)}% below forecast for the selected range.`);
    if (pct > 110) insights.push(`Revenue is outperforming forecast by roughly ${(pct - 100).toFixed(0)}%.`);
  }
  if (expPlanned > 0 && performancePercent(expActual, expPlanned) != null) {
    const pct = performancePercent(expActual, expPlanned);
    if (pct > 110) insights.push(`Expense outlays are running above budget (about ${(pct - 100).toFixed(0)}% over plan).`);
    if (pct < 85) insights.push('Expenses are materially under budget for the selected range.');
  }
  if (profitPlanned > 0 && profitActual < profitPlanned * 0.9) {
    insights.push('Projected profit is trailing planned profit for this range.');
  }

  return {
    mode: 'variance',
    periodKeys: keys,
    periodType,
    range: { start: overlap.start, end: overlap.end },
    revenue: {
      rows: revenueRows,
      totals: {
        planned: revPlanned,
        actual: revActual,
        variance: revActual - revPlanned,
        performancePercent: performancePercent(revActual, revPlanned),
      },
    },
    expenses: {
      rows: expenseRows,
      totals: {
        planned: expPlanned,
        actual: expActual,
        variance: expActual - expPlanned,
        performancePercent: performancePercent(expActual, expPlanned),
      },
    },
    profit: {
      planned: profitPlanned,
      actual: profitActual,
      variance: profitActual - profitPlanned,
    },
    insights,
  };
}

export { listPeriodKeysInRange } from '@/lib/bfPeriods';
