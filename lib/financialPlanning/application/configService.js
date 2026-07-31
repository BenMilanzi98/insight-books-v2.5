import { PlanningConfigurationMissingError } from '../domain/errors.js';

export async function getPlanningConfiguration(db, tenantId) {
  if (!db.planV2Configuration) return null;
  return db.planV2Configuration.findUnique({ where: { tenantId } });
}

export async function requireApprovedPlanningConfiguration(db, tenantId) {
  const cfg = await getPlanningConfiguration(db, tenantId);
  if (!cfg || cfg.status !== 'APPROVED') {
    throw new PlanningConfigurationMissingError();
  }
  return cfg;
}

export async function upsertDraftPlanningConfiguration(db, context, input = {}) {
  const tenantId = context.businessId;
  const existing = await getPlanningConfiguration(db, tenantId);
  const data = {
    planningEnabled: input.planningEnabled ?? existing?.planningEnabled ?? true,
    baseCurrency: input.baseCurrency || existing?.baseCurrency || 'MWK',
    defaultForecastHorizonMonths:
      input.defaultForecastHorizonMonths ?? existing?.defaultForecastHorizonMonths ?? 12,
    defaultGranularity: input.defaultGranularity || existing?.defaultGranularity || 'MONTHLY',
    defaultHistoricalLookbackMonths:
      input.defaultHistoricalLookbackMonths ?? existing?.defaultHistoricalLookbackMonths ?? 24,
    rollingForecastEnabled: input.rollingForecastEnabled ?? existing?.rollingForecastEnabled ?? true,
    rollingForecastMonths: input.rollingForecastMonths ?? existing?.rollingForecastMonths ?? 12,
    closedActualsPreferred: input.closedActualsPreferred ?? existing?.closedActualsPreferred ?? true,
    provisionalActualsAllowed:
      input.provisionalActualsAllowed ?? existing?.provisionalActualsAllowed ?? true,
    manualOverridesEnabled: input.manualOverridesEnabled ?? existing?.manualOverridesEnabled ?? true,
    aiSuggestionsEnabled: input.aiSuggestionsEnabled ?? existing?.aiSuggestionsEnabled ?? false,
    architectureVersion: 'PLAN_V2',
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : existing?.effectiveFrom || new Date(),
    status: 'DRAFT',
    createdBy: existing?.createdBy || context.userId,
    metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) },
  };

  if (existing) {
    return db.planV2Configuration.update({ where: { tenantId }, data });
  }
  return db.planV2Configuration.create({ data: { tenantId, ...data } });
}

export async function approvePlanningConfiguration(db, context) {
  const tenantId = context.businessId;
  const existing = await getPlanningConfiguration(db, tenantId);
  if (!existing) throw new PlanningConfigurationMissingError('Save a draft configuration first.');
  return db.planV2Configuration.update({
    where: { tenantId },
    data: {
      status: 'APPROVED',
      approvedBy: context.userId,
      approvedAt: new Date(),
    },
  });
}
