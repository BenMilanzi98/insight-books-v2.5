import { ScenarioType } from '../domain/enums.js';
import { CrossTenantPlanningError, ScenarioNotFoundError } from '../domain/errors.js';

const DEFAULT_SCENARIOS = [
  { code: 'CONSERVATIVE', name: 'Conservative', scenarioType: ScenarioType.CONSERVATIVE },
  { code: 'EXPECTED', name: 'Expected', scenarioType: ScenarioType.EXPECTED },
  { code: 'OPTIMISTIC', name: 'Optimistic', scenarioType: ScenarioType.OPTIMISTIC },
  { code: 'STRESS', name: 'Stress', scenarioType: ScenarioType.STRESS },
];

export async function ensureDefaultScenarios(db, context) {
  const tenantId = context.businessId;
  const created = [];
  for (const s of DEFAULT_SCENARIOS) {
    const row = await db.planV2Scenario.upsert({
      where: { tenantId_code: { tenantId, code: s.code } },
      create: {
        tenantId,
        code: s.code,
        name: s.name,
        scenarioType: s.scenarioType,
        status: 'ACTIVE',
        createdBy: context.userId,
      },
      update: {},
    });
    created.push(row);
  }
  return created;
}

export async function listScenarios(db, tenantId) {
  return db.planV2Scenario.findMany({
    where: { tenantId },
    orderBy: { code: 'asc' },
    include: { assumptionSets: { orderBy: { version: 'desc' }, take: 3 } },
  });
}

export async function getScenarioForTenant(db, tenantId, scenarioId) {
  const row = await db.planV2Scenario.findFirst({ where: { id: scenarioId, tenantId } });
  if (!row) throw new ScenarioNotFoundError();
  return row;
}

export async function createCustomScenario(db, context, input = {}) {
  const tenantId = context.businessId;
  const code = (input.code || `CUSTOM_${Date.now()}`).toUpperCase();
  return db.planV2Scenario.create({
    data: {
      tenantId,
      code,
      name: input.name || code,
      description: input.description || null,
      scenarioType: ScenarioType.CUSTOM,
      status: 'ACTIVE',
      createdBy: context.userId,
      metadata: input.metadata || null,
    },
  });
}

export async function cloneScenario(db, context, sourceScenarioId, { code, name } = {}) {
  const tenantId = context.businessId;
  const source = await getScenarioForTenant(db, tenantId, sourceScenarioId);
  if (source.tenantId !== tenantId) throw new CrossTenantPlanningError();

  const newCode = (code || `${source.code}_COPY`).toUpperCase();
  const cloned = await db.planV2Scenario.create({
    data: {
      tenantId,
      code: newCode,
      name: name || `${source.name} (copy)`,
      description: source.description,
      scenarioType: ScenarioType.CUSTOM,
      status: 'ACTIVE',
      createdBy: context.userId,
      metadata: { clonedFrom: source.id },
    },
  });

  const latestSet = await db.planV2AssumptionSet.findFirst({
    where: { tenantId, scenarioId: source.id },
    orderBy: { version: 'desc' },
    include: { assumptions: true },
  });
  if (latestSet) {
    const set = await db.planV2AssumptionSet.create({
      data: {
        tenantId,
        scenarioId: cloned.id,
        version: 1,
        name: `${latestSet.name} (cloned)`,
        status: 'DRAFT',
        createdBy: context.userId,
      },
    });
    for (const a of latestSet.assumptions) {
      await db.planV2Assumption.create({
        data: {
          tenantId,
          assumptionSetId: set.id,
          category: a.category,
          key: a.key,
          assumptionType: a.assumptionType,
          valueNumeric: a.valueNumeric,
          valueJson: a.valueJson,
          unit: a.unit,
          effectiveFromPeriod: a.effectiveFromPeriod,
          effectiveToPeriod: a.effectiveToPeriod,
          reason: a.reason,
          createdBy: context.userId,
        },
      });
    }
  }
  return cloned;
}
