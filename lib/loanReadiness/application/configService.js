import { LoanReadinessConfigurationMissingError } from '../domain/errors.js';

export async function getLoanReadinessConfiguration(db, tenantId) {
  if (!db.lrdV2Configuration) return null;
  return db.lrdV2Configuration.findUnique({ where: { tenantId } });
}

/**
 * Ensure an APPROVED (ready) configuration exists — no draft/approve ceremony.
 */
export async function ensureLoanReadinessConfiguration(db, context) {
  const tenantId = context.businessId;
  const existing = await getLoanReadinessConfiguration(db, tenantId);
  if (existing?.status === 'APPROVED') {
    return existing;
  }
  if (existing) {
    return db.lrdV2Configuration.update({
      where: { tenantId },
      data: {
        status: 'APPROVED',
        approvedBy: existing.approvedBy || context.userId || null,
        approvedAt: existing.approvedAt || new Date(),
        loanReadinessEnabled: true,
      },
    });
  }
  return db.lrdV2Configuration.create({
    data: {
      tenantId,
      loanReadinessEnabled: true,
      defaultBaseCurrency: 'MWK',
      historicalLookbackYears: 3,
      provisionalActualsAllowed: true,
      approvedForecastRequired: false,
      covenantMonitoringEnabled: true,
      aiCommentaryEnabled: false,
      architectureVersion: 'LRD_V1',
      effectiveFrom: new Date(),
      status: 'APPROVED',
      createdBy: context.userId || null,
      approvedBy: context.userId || null,
      approvedAt: new Date(),
    },
  });
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
    // Simplified path: persist as APPROVED so UI never blocks on approve
    status: input.status || 'APPROVED',
    createdBy: existing?.createdBy || context.userId,
    approvedBy: existing?.approvedBy || context.userId || null,
    approvedAt: existing?.approvedAt || new Date(),
    metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) },
  };
  if (existing) return db.lrdV2Configuration.update({ where: { tenantId }, data });
  return db.lrdV2Configuration.create({ data: { tenantId, ...data } });
}

export async function approveLoanReadinessConfiguration(db, context) {
  const tenantId = context.businessId;
  const existing = await getLoanReadinessConfiguration(db, tenantId);
  if (!existing) {
    return ensureLoanReadinessConfiguration(db, context);
  }
  return db.lrdV2Configuration.update({
    where: { tenantId },
    data: { status: 'APPROVED', approvedBy: context.userId, approvedAt: new Date() },
  });
}
