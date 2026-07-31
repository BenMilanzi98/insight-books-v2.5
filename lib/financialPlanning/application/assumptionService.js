import { AssumptionType } from '../domain/enums.js';
import { CrossTenantPlanningError, ScenarioNotFoundError } from '../domain/errors.js';

const DEFAULT_ASSUMPTIONS = [
  { category: 'REVENUE', key: 'revenueGrowthBps', assumptionType: AssumptionType.RATE, valueNumeric: 50, unit: 'bps' },
  { category: 'COST_OF_SALES', key: 'grossMarginBps', assumptionType: AssumptionType.RATE, valueNumeric: 4000, unit: 'bps' },
  { category: 'OPERATING_EXPENSES', key: 'opexPercentOfRevenueBps', assumptionType: AssumptionType.RATE, valueNumeric: 2500, unit: 'bps' },
  { category: 'WORKING_CAPITAL', key: 'dsoDays', assumptionType: AssumptionType.DAYS, valueNumeric: 30, unit: 'days' },
  { category: 'WORKING_CAPITAL', key: 'dpoDays', assumptionType: AssumptionType.DAYS, valueNumeric: 30, unit: 'days' },
  { category: 'WORKING_CAPITAL', key: 'inventoryDays', assumptionType: AssumptionType.DAYS, valueNumeric: 30, unit: 'days' },
  { category: 'TAXES', key: 'taxRateBps', assumptionType: AssumptionType.RATE, valueNumeric: 0, unit: 'bps' },
  { category: 'ASSETS', key: 'monthlyDepreciationMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'ASSETS', key: 'monthlyCapexMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'FINANCING', key: 'monthlyInterestBpsOfDebt', assumptionType: AssumptionType.RATE, valueNumeric: 0, unit: 'bps' },
  { category: 'FINANCING', key: 'monthlyPrincipalRepaymentMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'FINANCING', key: 'monthlyNewDebtMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'EQUITY', key: 'monthlyCapitalContributionMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'EQUITY', key: 'monthlyDrawingsMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
  { category: 'EQUITY', key: 'monthlyDividendMinor', assumptionType: AssumptionType.ABSOLUTE_AMOUNT, valueNumeric: 0, unit: 'minor' },
];

export async function ensureDraftAssumptionSet(db, context, scenarioId, { name } = {}) {
  const tenantId = context.businessId;
  const scenario = await db.planV2Scenario.findFirst({ where: { id: scenarioId, tenantId } });
  if (!scenario) throw new ScenarioNotFoundError();

  const latest = await db.planV2AssumptionSet.findFirst({
    where: { tenantId, scenarioId },
    orderBy: { version: 'desc' },
  });
  if (latest && latest.status === 'DRAFT') {
    return db.planV2AssumptionSet.findUnique({
      where: { id: latest.id },
      include: { assumptions: true },
    });
  }

  const version = (latest?.version || 0) + 1;
  const set = await db.planV2AssumptionSet.create({
    data: {
      tenantId,
      scenarioId,
      version,
      name: name || `${scenario.code} assumptions v${version}`,
      status: 'DRAFT',
      createdBy: context.userId,
    },
  });

  for (const a of DEFAULT_ASSUMPTIONS) {
    await db.planV2Assumption.create({
      data: {
        tenantId,
        assumptionSetId: set.id,
        ...a,
        reason: 'Default planning seed — review before approval',
        createdBy: context.userId,
      },
    });
  }

  return db.planV2AssumptionSet.findUnique({
    where: { id: set.id },
    include: { assumptions: true },
  });
}

export async function upsertAssumption(db, context, assumptionSetId, input) {
  const tenantId = context.businessId;
  const set = await db.planV2AssumptionSet.findFirst({
    where: { id: assumptionSetId, tenantId },
  });
  if (!set) throw new CrossTenantPlanningError('Assumption set not found for business.');
  if (set.status === 'APPROVED') {
    throw new CrossTenantPlanningError('Approved assumption sets are immutable; create a new version.');
  }

  const existing = await db.planV2Assumption.findUnique({
    where: { assumptionSetId_key: { assumptionSetId, key: input.key } },
  });
  const data = {
    category: input.category || existing?.category || 'OTHER',
    assumptionType: input.assumptionType || existing?.assumptionType || AssumptionType.RATE,
    valueNumeric: input.valueNumeric !== undefined ? input.valueNumeric : existing?.valueNumeric,
    valueJson: input.valueJson !== undefined ? input.valueJson : existing?.valueJson,
    unit: input.unit ?? existing?.unit,
    effectiveFromPeriod: input.effectiveFromPeriod ?? existing?.effectiveFromPeriod,
    effectiveToPeriod: input.effectiveToPeriod ?? existing?.effectiveToPeriod,
    reason: input.reason || existing?.reason,
    createdBy: existing?.createdBy || context.userId,
  };

  if (existing) {
    return db.planV2Assumption.update({ where: { id: existing.id }, data });
  }
  return db.planV2Assumption.create({
    data: { tenantId, assumptionSetId, key: input.key, ...data },
  });
}

export async function approveAssumptionSet(db, context, assumptionSetId) {
  const tenantId = context.businessId;
  const set = await db.planV2AssumptionSet.findFirst({
    where: { id: assumptionSetId, tenantId },
    include: { assumptions: true },
  });
  if (!set) throw new CrossTenantPlanningError('Assumption set not found for business.');
  return db.planV2AssumptionSet.update({
    where: { id: set.id },
    data: { status: 'APPROVED', approvedBy: context.userId },
    include: { assumptions: true },
  });
}

/** Flatten assumption rows into engine input object. */
export function assumptionsToEngineInput(assumptions = []) {
  const out = {};
  for (const a of assumptions) {
    if (a.key === 'seasonalIndexBps' && a.valueJson) {
      out.seasonalIndexBps = a.valueJson;
      continue;
    }
    if (a.valueNumeric != null) {
      const n = Number(a.valueNumeric);
      out[a.key] = Number.isFinite(n) ? n : 0;
    }
  }
  return out;
}
