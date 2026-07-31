import { LoanReadinessConfigurationMissingError } from '../domain/errors.js';

export async function getLoanReadinessConfiguration(db, tenantId) {
  if (!db.lrdV2Configuration) return null;
  return db.lrdV2Configuration.findUnique({ where: { tenantId } });
}

export async function upsertDraftLoanReadinessConfiguration(db, context, input = {}) {
  const tenantId = context.businessId;
  const existing = await getLoanReadinessConfiguration(db, tenantId);
  const data = {
    loanReadinessEnabled: input.loanReadinessEnabled ?? existing?.loanReadinessEnabled ?? true,
    defaultBaseCurrency: input.defaultBaseCurrency || existing?.defaultBaseCurrency || 'MWK',
    historicalLookbackYears:
      input.historicalLookbackYears ?? existing?.historicalLookbackYears ?? 3,
    provisionalActualsAllowed:
      input.provisionalActualsAllowed ?? existing?.provisionalActualsAllowed ?? true,
    approvedForecastRequired:
      input.approvedForecastRequired ?? existing?.approvedForecastRequired ?? false,
    covenantMonitoringEnabled:
      input.covenantMonitoringEnabled ?? existing?.covenantMonitoringEnabled ?? true,
    aiCommentaryEnabled: input.aiCommentaryEnabled ?? existing?.aiCommentaryEnabled ?? false,
    architectureVersion: 'LRD_V1',
    effectiveFrom: input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : existing?.effectiveFrom || new Date(),
    status: 'DRAFT',
    createdBy: existing?.createdBy || context.userId,
    metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) },
  };
  if (existing) return db.lrdV2Configuration.update({ where: { tenantId }, data });
  return db.lrdV2Configuration.create({ data: { tenantId, ...data } });
}

export async function approveLoanReadinessConfiguration(db, context) {
  const tenantId = context.businessId;
  const existing = await getLoanReadinessConfiguration(db, tenantId);
  if (!existing) throw new LoanReadinessConfigurationMissingError('Save a draft configuration first.');
  return db.lrdV2Configuration.update({
    where: { tenantId },
    data: { status: 'APPROVED', approvedBy: context.userId, approvedAt: new Date() },
  });
}
