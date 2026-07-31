import prisma from '@/lib/prisma';
import crypto from 'crypto';
import {
  BUDGET_STATUS,
  assertBudgetTransition,
  canEditBudget,
  BUDGET_COMMANDS,
} from '../domain/budgetStates.js';
import { toMinor, applyGrowthMinor, minorToNumber } from '../domain/money.js';
import { buildMonthlyPeriods, parsePeriodKey, spreadEvenly } from '../domain/periods.js';
import {
  computeBudgetCompletion,
  summarizeLinesForCompletion,
} from '../domain/completion.js';
import { resolveBudgetActuals } from './budgetActualsService.js';
import { serializeBudget, assertTenantBudget } from './serialize.js';

const lineInclude = {
  periodAmounts: { orderBy: { periodStart: 'asc' } },
  account: { select: { id: true, accountCode: true, accountName: true, accountType: true, coaV2Category: true, parentAccountId: true, acceptsNewTransactions: true } },
};

function serviceError(message, status = 400, code = 'BUDGET_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function loadBudget(tenantId, id, db = prisma) {
  const budget = await db.budget.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: lineInclude, orderBy: { accountCodeSnapshot: 'asc' } },
      versions: { orderBy: { createdAt: 'desc' }, take: 20 },
      approvals: { orderBy: { requestedAt: 'desc' }, take: 20 },
    },
  });
  assertTenantBudget(budget, tenantId);
  return budget;
}

function withCompletion(budget) {
  const summary = summarizeLinesForCompletion(budget.lines || []);
  const completion = computeBudgetCompletion(summary);
  return serializeBudget({ ...budget, completion });
}

export async function listBudgets(tenantId, { status, take = 50 } = {}) {
  const where = { tenantId, businessId: tenantId };
  if (status) where.status = String(status).toUpperCase();
  const rows = await prisma.budget.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take,
    include: {
      lines: { select: { id: true, annualAmountMinor: true, accountTypeSnapshot: true, accountCategorySnapshot: true, notes: true, periodAmounts: { select: { plannedAmountMinor: true, periodStart: true } } } },
    },
  });
  return rows.map(withCompletion);
}

export async function getBudget(tenantId, id) {
  return withCompletion(await loadBudget(tenantId, id));
}

export async function createBudget(tenantId, userId, input = {}) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (!(startDate < endDate)) throw serviceError('startDate must be before endDate');

  const budget = await prisma.budget.create({
    data: {
      tenantId,
      businessId: tenantId,
      name: String(input.name || 'Untitled Budget').trim(),
      description: input.description || null,
      budgetType: input.budgetType || 'OPERATING',
      budgetMethod: input.budgetMethod || 'CREATE_MANUALLY',
      frequency: input.frequency || 'MONTHLY',
      planningMode: input.planningMode || 'POSTING_ACCOUNT_DETAIL',
      fiscalYear: input.fiscalYear ? Number(input.fiscalYear) : startDate.getUTCFullYear(),
      startDate,
      endDate,
      currency: input.currency || 'MWK',
      status: BUDGET_STATUS.DRAFT,
      branchId: input.branchId || null,
      departmentId: input.departmentId || null,
      projectId: input.projectId || null,
      costCentreId: input.costCentreId || null,
      createdById: userId || null,
      notes: input.notes || null,
    },
  });

  await prisma.budgetVersion.create({
    data: {
      budgetId: budget.id,
      versionNumber: 1,
      revisionNumber: 1,
      state: BUDGET_STATUS.DRAFT,
      changeReason: 'Created',
      createdById: userId || null,
      snapshotChecksum: checksumOf({ id: budget.id, version: 1 }),
    },
  });

  return getBudget(tenantId, budget.id);
}

async function resolveAccounts(tenantId, accountIds) {
  const unique = [...new Set(accountIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const accounts = await prisma.account.findMany({
    where: { tenantId, id: { in: unique }, mergedIntoAccountId: null },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      coaV2Category: true,
      parentAccountId: true,
      acceptsNewTransactions: true,
      coaV2Behaviour: true,
      postingAllowed: true,
    },
  });
  if (accounts.length !== unique.length) {
    throw serviceError('One or more accounts are invalid for this tenant', 400, 'INVALID_ACCOUNT');
  }
  return new Map(accounts.map((a) => [a.id, a]));
}

/**
 * Replace budget lines + period amounts. Never creates journals.
 */
export async function saveBudgetLines(tenantId, budgetId, linesInput = [], userId = null, { allowEmpty = false } = {}) {
  const budget = await loadBudget(tenantId, budgetId);
  if (!canEditBudget(budget.status)) {
    throw serviceError('Budget is not editable in its current status', 409, 'BUDGET_LOCKED');
  }

  if (!Array.isArray(linesInput)) {
    throw serviceError('lines must be an array', 400, 'INVALID_LINES');
  }
  if (linesInput.length === 0 && !allowEmpty) {
    throw serviceError(
      'Refusing to clear all budget lines. Pass allowEmpty: true to confirm.',
      400,
      'EMPTY_LINES_REFUSED'
    );
  }
  if (linesInput.some((row) => !row?.accountId)) {
    throw serviceError('Every budget line requires a valid accountId', 400, 'INVALID_ACCOUNT');
  }

  const accountIds = linesInput.map((l) => l.accountId);
  const accounts = await resolveAccounts(tenantId, accountIds);
  const periods = buildMonthlyPeriods(budget.startDate, budget.endDate);

  // Parent/child double-count guard: reject if both parent and child selected
  const parentIds = new Set([...accounts.values()].map((a) => a.parentAccountId).filter(Boolean));
  for (const id of accountIds) {
    if (parentIds.has(id) && accountIds.some((cid) => accounts.get(cid)?.parentAccountId === id)) {
      throw serviceError('Cannot budget both a parent account and its children', 400, 'PARENT_CHILD_DOUBLE_COUNT');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetLine.deleteMany({ where: { budgetId } });
    for (const row of linesInput) {
      const acc = accounts.get(row.accountId);
      if (!acc) continue;
      const periodRows = Array.isArray(row.periods) ? row.periods : [];
      let annual = 0;
      const periodCreates = [];
      if (periodRows.length) {
        for (const p of periodRows) {
          const meta = p.key ? parsePeriodKey(p.key) : null;
          const planned = toMinor(p.amount ?? p.plannedAmount ?? 0);
          annual += planned;
          periodCreates.push({
            periodStart: meta?.periodStart || new Date(p.periodStart || budget.startDate),
            periodEnd: meta?.periodEnd || new Date(p.periodEnd || budget.endDate),
            monthNumber: meta?.monthNumber ?? p.monthNumber ?? null,
            quarterNumber: meta?.quarterNumber ?? p.quarterNumber ?? null,
            plannedAmountMinor: planned,
            sourceMethod: p.sourceMethod || 'MANUAL',
            growthRate: p.growthRate ?? null,
            notes: p.notes || null,
          });
        }
      } else if (row.annualAmount != null || row.annualAmountMinor != null) {
        annual = row.annualAmountMinor != null ? Number(row.annualAmountMinor) : toMinor(row.annualAmount);
        const spread = spreadEvenly(annual, periods.length);
        periods.forEach((meta, i) => {
          periodCreates.push({
            periodStart: meta.periodStart,
            periodEnd: meta.periodEnd,
            monthNumber: meta.monthNumber,
            quarterNumber: meta.quarterNumber,
            plannedAmountMinor: spread[i],
            sourceMethod: 'SPREAD_EVENLY',
          });
        });
      }

      await tx.budgetLine.create({
        data: {
          budgetId,
          accountId: acc.id,
          accountCodeSnapshot: acc.accountCode || '',
          accountNameSnapshot: acc.accountName || '',
          accountTypeSnapshot: acc.accountType || null,
          accountCategorySnapshot: acc.coaV2Category || null,
          parentAccountIdSnapshot: acc.parentAccountId || null,
          branchId: row.branchId || budget.branchId || null,
          departmentId: row.departmentId || budget.departmentId || null,
          projectId: row.projectId || budget.projectId || null,
          costCentreId: row.costCentreId || budget.costCentreId || null,
          lineType: row.lineType || 'PLANNED',
          calculationMethod: row.calculationMethod || 'MANUAL',
          annualAmountMinor: annual,
          notes: row.notes || null,
          assumptions: row.assumptions || null,
          periodAmounts: { create: periodCreates },
        },
      });
    }

    if (budget.status === BUDGET_STATUS.DRAFT) {
      await tx.budget.update({
        where: { id: budgetId },
        data: { status: BUDGET_STATUS.IN_PREPARATION },
      });
    }
  });

  return getBudget(tenantId, budgetId);
}

export async function copyBudget(tenantId, sourceId, userId, { name, growthPercent = 0 } = {}) {
  const source = await loadBudget(tenantId, sourceId);
  const created = await createBudget(tenantId, userId, {
    name: name || `${source.name} (Copy)`,
    description: source.description,
    budgetType: source.budgetType,
    budgetMethod: 'COPY_PREVIOUS_BUDGET',
    frequency: source.frequency,
    fiscalYear: source.fiscalYear,
    startDate: source.startDate,
    endDate: source.endDate,
    currency: source.currency,
    branchId: source.branchId,
    departmentId: source.departmentId,
    projectId: source.projectId,
    costCentreId: source.costCentreId,
  });

  await prisma.budget.update({
    where: { id: created.id },
    data: { copiedFromBudgetId: source.id },
  });

  const linesInput = (source.lines || []).map((line) => {
    const periods = (line.periodAmounts || []).map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      monthNumber: p.monthNumber,
      quarterNumber: p.quarterNumber,
      amount: applyGrowthMinor(p.plannedAmountMinor, growthPercent) / 100,
      sourceMethod: 'COPY_PREVIOUS_BUDGET',
      growthRate: growthPercent || null,
    }));
    return {
      accountId: line.accountId,
      branchId: line.branchId,
      departmentId: line.departmentId,
      projectId: line.projectId,
      costCentreId: line.costCentreId,
      notes: line.notes,
      assumptions: line.assumptions,
      // Preserve annual total when period rows are missing (avoids silent zeroing).
      annualAmountMinor: periods.length
        ? undefined
        : applyGrowthMinor(line.annualAmountMinor, growthPercent),
      periods,
    };
  });

  return saveBudgetLines(tenantId, created.id, linesInput, userId);
}

export async function generateFromActuals(tenantId, userId, input = {}) {
  const startDate = new Date(input.startDate || input.actualsStart);
  const endDate = new Date(input.endDate || input.actualsEnd);
  const growthPercent = Number(input.growthPercent || 0);

  const actuals = await resolveBudgetActuals({
    tenantId,
    businessId: tenantId,
    startDate,
    endDate,
    branchId: input.branchId || null,
  });

  const budget = await createBudget(tenantId, userId, {
    name: input.name || `Budget from actuals ${startDate.toISOString().slice(0, 10)}`,
    description: input.description || 'Generated from posted journal actuals',
    budgetMethod: 'GENERATE_FROM_ACTUALS',
    frequency: input.frequency || 'MONTHLY',
    startDate: input.budgetStart || startDate,
    endDate: input.budgetEnd || endDate,
    currency: input.currency || 'MWK',
    branchId: input.branchId || null,
    fiscalYear: input.fiscalYear,
  });

  await prisma.budget.update({
    where: { id: budget.id },
    data: {
      generatedFromActualsStart: startDate,
      generatedFromActualsEnd: endDate,
    },
  });

  const periods = buildMonthlyPeriods(budget.startDate, budget.endDate);
  const linesInput = actuals.accounts.map((a) => {
    const annual = applyGrowthMinor(a.actualMinor, growthPercent);
    const spread = spreadEvenly(annual, periods.length);
    return {
      accountId: a.accountId,
      calculationMethod: 'GENERATE_FROM_ACTUALS',
      periods: periods.map((p, i) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        monthNumber: p.monthNumber,
        quarterNumber: p.quarterNumber,
        amount: spread[i] / 100,
        sourceMethod: 'GENERATE_FROM_ACTUALS',
        growthRate: growthPercent || null,
      })),
    };
  });

  return saveBudgetLines(tenantId, budget.id, linesInput, userId);
}

export async function generateFromRunRate(tenantId, userId, input = {}) {
  const actualsStart = new Date(input.actualsStart);
  const actualsEnd = new Date(input.actualsEnd);
  const budgetStart = new Date(input.budgetStart || input.startDate);
  const budgetEnd = new Date(input.budgetEnd || input.endDate);

  const actuals = await resolveBudgetActuals({
    tenantId,
    startDate: actualsStart,
    endDate: actualsEnd,
    branchId: input.branchId || null,
  });

  const elapsedMonths = Math.max(1, buildMonthlyPeriods(actualsStart, actualsEnd).length);
  const targetMonths = Math.max(1, buildMonthlyPeriods(budgetStart, budgetEnd).length);

  const budget = await createBudget(tenantId, userId, {
    name: input.name || 'Run-rate budget',
    budgetMethod: 'GENERATE_FROM_CURRENT_RUN_RATE',
    frequency: 'MONTHLY',
    startDate: budgetStart,
    endDate: budgetEnd,
    currency: input.currency || 'MWK',
    branchId: input.branchId || null,
  });

  const periods = buildMonthlyPeriods(budgetStart, budgetEnd);
  const linesInput = actuals.accounts.map((a) => {
    const annualized = Math.round((minorToNumber(a.actualMinor) / elapsedMonths) * targetMonths);
    const spread = spreadEvenly(annualized, periods.length);
    return {
      accountId: a.accountId,
      calculationMethod: 'CURRENT_RUN_RATE',
      periods: periods.map((p, i) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        monthNumber: p.monthNumber,
        quarterNumber: p.quarterNumber,
        amount: spread[i] / 100,
        sourceMethod: 'CURRENT_RUN_RATE',
      })),
    };
  });

  return saveBudgetLines(tenantId, budget.id, linesInput, userId);
}

async function transitionBudget(tenantId, budgetId, userId, command, { reason } = {}) {
  const budget = await loadBudget(tenantId, budgetId);
  const target = BUDGET_COMMANDS[command];
  if (!target) throw serviceError(`Unknown command ${command}`, 400, 'UNKNOWN_COMMAND');

  let nextFrom = budget.status;
  if (command === 'submitForReview' && budget.status === BUDGET_STATUS.DRAFT) {
    nextFrom = BUDGET_STATUS.IN_PREPARATION;
    assertBudgetTransition(budget.status, BUDGET_STATUS.IN_PREPARATION);
  }
  if (command === 'submitForReview' && nextFrom === BUDGET_STATUS.IN_PREPARATION) {
    assertBudgetTransition(BUDGET_STATUS.IN_PREPARATION, BUDGET_STATUS.READY_FOR_REVIEW);
  } else if (command === 'approve') {
    if (budget.status === BUDGET_STATUS.READY_FOR_REVIEW) {
      assertBudgetTransition(budget.status, BUDGET_STATUS.IN_REVIEW);
      await prisma.budget.update({ where: { id: budgetId }, data: { status: BUDGET_STATUS.IN_REVIEW } });
      nextFrom = BUDGET_STATUS.IN_REVIEW;
    }
    assertBudgetTransition(nextFrom, target);
  } else if (command === 'unlock') {
    if (budget.status !== BUDGET_STATUS.LOCKED) throw serviceError('Budget is not locked', 409);
    assertBudgetTransition(budget.status, target);
  } else {
    assertBudgetTransition(budget.status, target);
  }

  const data = {
    status: target,
    approvalState: target === BUDGET_STATUS.APPROVED || target === BUDGET_STATUS.ACTIVE ? 'APPROVED' : budget.approvalState,
  };
  if (command === 'approve') {
    data.approvedById = userId;
    data.approvedAt = new Date();
  }
  if (command === 'activate') data.activatedAt = new Date();
  if (command === 'lock') {
    data.lockedById = userId;
    data.lockedAt = new Date();
  }
  if (command === 'unlock') {
    data.lockedById = null;
    data.lockedAt = null;
  }
  if (command === 'supersede') data.supersededAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.budget.update({ where: { id: budgetId }, data });
    if (['approve', 'submitForReview', 'requestChanges'].includes(command)) {
      await tx.budgetApproval.create({
        data: {
          budgetId,
          requestedById: userId,
          approverId: command === 'approve' ? userId : null,
          state: command === 'approve' ? 'APPROVED' : command === 'requestChanges' ? 'CHANGES_REQUESTED' : 'PENDING',
          reason: reason || null,
          decidedAt: command === 'approve' || command === 'requestChanges' ? new Date() : null,
        },
      });
    }
    if (command === 'approve' || command === 'lock' || command === 'activate') {
      await tx.budgetVersion.create({
        data: {
          budgetId,
          versionNumber: budget.versionNumber,
          revisionNumber: budget.revisionNumber,
          state: target,
          changeReason: reason || command,
          createdById: userId,
          approvedById: command === 'approve' ? userId : null,
          approvedAt: command === 'approve' ? new Date() : null,
          snapshotChecksum: checksumOf({ id: budgetId, status: target, at: Date.now() }),
          snapshotJson: { lineCount: budget.lines?.length || 0, status: target },
        },
      });
    }
  });

  return getBudget(tenantId, budgetId);
}

export const submitBudgetForReview = (t, id, u, o) => transitionBudget(t, id, u, 'submitForReview', o);
export const approveBudget = (t, id, u, o) => transitionBudget(t, id, u, 'approve', o);
export const requestBudgetChanges = (t, id, u, o) => transitionBudget(t, id, u, 'requestChanges', o);
export const activateBudget = (t, id, u, o) => transitionBudget(t, id, u, 'activate', o);
export const lockBudget = (t, id, u, o) => transitionBudget(t, id, u, 'lock', o);
export const unlockBudget = (t, id, u, o) => transitionBudget(t, id, u, 'unlock', o);
export const archiveBudget = (t, id, u, o) => transitionBudget(t, id, u, 'archive', o);

export async function createBudgetRevision(tenantId, budgetId, userId, { changeReason } = {}) {
  const source = await loadBudget(tenantId, budgetId);
  if (![BUDGET_STATUS.APPROVED, BUDGET_STATUS.ACTIVE, BUDGET_STATUS.LOCKED].includes(source.status)) {
    throw serviceError('Only approved/active/locked budgets can be revised', 409);
  }

  const revision = await createBudget(tenantId, userId, {
    name: `${source.name} (Rev ${source.revisionNumber + 1})`,
    description: source.description,
    budgetType: source.budgetType,
    budgetMethod: source.budgetMethod,
    frequency: source.frequency,
    fiscalYear: source.fiscalYear,
    startDate: source.startDate,
    endDate: source.endDate,
    currency: source.currency,
    branchId: source.branchId,
    departmentId: source.departmentId,
    projectId: source.projectId,
    costCentreId: source.costCentreId,
  });

  await prisma.budget.update({
    where: { id: revision.id },
    data: {
      parentBudgetId: source.id,
      versionNumber: source.versionNumber + 1,
      revisionNumber: source.revisionNumber + 1,
      notes: changeReason || 'Revision',
    },
  });

  const linesInput = (source.lines || []).map((line) => {
    const periods = (line.periodAmounts || []).map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      monthNumber: p.monthNumber,
      quarterNumber: p.quarterNumber,
      amount: minorToNumber(p.plannedAmountMinor) / 100,
      sourceMethod: 'REVISION',
    }));
    return {
      accountId: line.accountId,
      branchId: line.branchId,
      departmentId: line.departmentId,
      projectId: line.projectId,
      costCentreId: line.costCentreId,
      notes: line.notes,
      assumptions: line.assumptions,
      annualAmountMinor: periods.length ? undefined : Number(line.annualAmountMinor || 0),
      periods,
    };
  });

  await saveBudgetLines(tenantId, revision.id, linesInput, userId);
  await transitionBudget(tenantId, source.id, userId, 'supersede', { reason: changeReason || 'Superseded by revision' });
  return getBudget(tenantId, revision.id);
}

export async function deleteBudget(tenantId, budgetId) {
  const budget = await loadBudget(tenantId, budgetId);
  if (![BUDGET_STATUS.DRAFT, BUDGET_STATUS.IN_PREPARATION, BUDGET_STATUS.CANCELLED].includes(budget.status)) {
    throw serviceError('Only draft budgets can be deleted', 409);
  }
  await prisma.budget.delete({ where: { id: budgetId } });
  return { ok: true };
}

export async function getBudgetDashboard(tenantId) {
  const budgets = await listBudgets(tenantId, { take: 100 });
  let plannedRevenue = 0;
  let plannedExpense = 0;
  const byStatus = {};
  for (const b of budgets) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    for (const line of b.lines || []) {
      const amt = minorToNumber(line.annualAmountMinor);
      const t = String(line.accountTypeSnapshot || '').toLowerCase();
      if (t.includes('income') || t.includes('revenue')) plannedRevenue += amt;
      else if (t.includes('expense')) plannedExpense += amt;
    }
  }
  const active = budgets.find((b) => b.status === BUDGET_STATUS.ACTIVE) || null;
  const awaiting = budgets.filter((b) => ['READY_FOR_REVIEW', 'IN_REVIEW'].includes(b.status));
  const drafts = budgets.filter((b) => ['DRAFT', 'IN_PREPARATION', 'CHANGES_REQUESTED'].includes(b.status));

  return {
    cards: {
      plannedRevenue: plannedRevenue / 100,
      plannedExpense: plannedExpense / 100,
      expectedProfit: (plannedRevenue - plannedExpense) / 100,
      activeStatus: active?.status || 'NONE',
      completion: active?.completion?.percent ?? 0,
      budgetCount: budgets.length,
    },
    active,
    awaitingApproval: awaiting,
    drafts,
    recent: budgets.slice(0, 10),
    byStatus,
  };
}

function checksumOf(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 32);
}
