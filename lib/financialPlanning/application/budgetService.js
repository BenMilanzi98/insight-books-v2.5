import { BudgetStatus } from '../domain/enums.js';
import { CrossTenantPlanningError } from '../domain/errors.js';

export async function listBudgets(db, tenantId) {
  return db.planV2Budget.findMany({
    where: { tenantId },
    orderBy: [{ budgetNumber: 'asc' }, { version: 'desc' }],
    include: { lines: true },
  });
}

export async function createBudget(db, context, input = {}) {
  const tenantId = context.businessId;
  const budgetNumber = input.budgetNumber || `BUD-${new Date().getUTCFullYear()}`;
  const latest = await db.planV2Budget.findFirst({
    where: { tenantId, budgetNumber },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version || 0) + 1;
  if (latest && latest.status === BudgetStatus.APPROVED) {
    await db.planV2Budget.update({
      where: { id: latest.id },
      data: { status: BudgetStatus.SUPERSEDED },
    });
  }

  return db.planV2Budget.create({
    data: {
      tenantId,
      budgetNumber,
      name: input.name || `Budget ${budgetNumber} v${version}`,
      description: input.description || null,
      financialYearId: input.financialYearId || null,
      fromDate: new Date(input.fromDate),
      toDate: new Date(input.toDate),
      granularity: input.granularity || 'MONTHLY',
      currency: input.currency || 'MWK',
      version,
      status: BudgetStatus.DRAFT,
      preparedBy: context.userId,
      metadata: input.metadata || null,
      lines: input.lines?.length
        ? {
            create: input.lines.map((l) => ({
              tenantId,
              periodKey: l.periodKey,
              accountId: l.accountId || null,
              reportLineKey: l.reportLineKey || null,
              amountMinor: BigInt(l.amountMinor),
              currency: l.currency || input.currency || 'MWK',
              notes: l.notes || null,
            })),
          }
        : undefined,
    },
    include: { lines: true },
  });
}

export async function approveBudget(db, context, budgetId) {
  const tenantId = context.businessId;
  const budget = await db.planV2Budget.findFirst({ where: { id: budgetId, tenantId } });
  if (!budget) throw new CrossTenantPlanningError('Budget not found for business.');
  if (budget.status === BudgetStatus.APPROVED) {
    throw new CrossTenantPlanningError('Budget already approved; create a new version to revise.');
  }
  return db.planV2Budget.update({
    where: { id: budget.id },
    data: {
      status: BudgetStatus.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
    },
    include: { lines: true },
  });
}
