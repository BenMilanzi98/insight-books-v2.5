import { CloseMethod } from '../domain/enums.js';
import { ClosingConfigurationMissingError, InvalidClosingMethodError } from '../domain/errors.js';
import { resolveEquityAccountByPurpose } from '../../equityManagement/application/mappingService.js';

export async function getClosingConfiguration(db, tenantId) {
  if (!db.closeV2Configuration) return null;
  return db.closeV2Configuration.findUnique({ where: { tenantId } });
}

export async function requireApprovedClosingConfiguration(db, tenantId) {
  const cfg = await getClosingConfiguration(db, tenantId);
  if (!cfg || cfg.status !== 'APPROVED') {
    throw new ClosingConfigurationMissingError();
  }
  if (!Object.values(CloseMethod).includes(cfg.closeMethod)) {
    throw new InvalidClosingMethodError(`Unsupported close method ${cfg.closeMethod}`);
  }
  return cfg;
}

export async function upsertDraftClosingConfiguration(db, context, input = {}) {
  const tenantId = context.businessId;
  const existing = await getClosingConfiguration(db, tenantId);

  let retainedEarningsAccountId = input.retainedEarningsAccountId ?? existing?.retainedEarningsAccountId;
  let ownerCapitalAccountId = input.ownerCapitalAccountId ?? existing?.ownerCapitalAccountId;
  let incomeSummaryAccountId = input.incomeSummaryAccountId ?? existing?.incomeSummaryAccountId;

  if (!retainedEarningsAccountId) {
    try {
      const re = await resolveEquityAccountByPurpose(db, tenantId, 'RETAINED_EARNINGS');
      retainedEarningsAccountId = re.id;
    } catch {
      /* optional until approved */
    }
  }
  if (!ownerCapitalAccountId) {
    try {
      const oc = await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_CAPITAL');
      ownerCapitalAccountId = oc.id;
    } catch {
      /* optional */
    }
  }

  const closeMethod = input.closeMethod || existing?.closeMethod || CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS;
  if (!Object.values(CloseMethod).includes(closeMethod)) {
    throw new InvalidClosingMethodError(`Unsupported close method ${closeMethod}`);
  }

  const data = {
    closeMethod,
    monthlyCloseEnabled: input.monthlyCloseEnabled ?? existing?.monthlyCloseEnabled ?? true,
    yearEndCloseEnabled: input.yearEndCloseEnabled ?? existing?.yearEndCloseEnabled ?? true,
    incomeSummaryEnabled: input.incomeSummaryEnabled ?? existing?.incomeSummaryEnabled ?? true,
    incomeSummaryAccountId: incomeSummaryAccountId || null,
    currentYearEarningsAccountId: input.currentYearEarningsAccountId ?? existing?.currentYearEarningsAccountId ?? null,
    retainedEarningsAccountId: retainedEarningsAccountId || null,
    ownerCapitalAccountId: ownerCapitalAccountId || null,
    partnerCapitalAllocationMethod: input.partnerCapitalAllocationMethod ?? existing?.partnerCapitalAllocationMethod ?? null,
    drawingsCloseMethod: input.drawingsCloseMethod || existing?.drawingsCloseMethod || 'TO_OWNER_CAPITAL',
    dividendCloseMethod: input.dividendCloseMethod || existing?.dividendCloseMethod || 'RETAINED_EARNINGS_AT_DECLARATION',
    automaticNextYearCreation: input.automaticNextYearCreation ?? existing?.automaticNextYearCreation ?? true,
    automaticPeriodGeneration: input.automaticPeriodGeneration ?? existing?.automaticPeriodGeneration ?? true,
    annualSnapshotRequired: input.annualSnapshotRequired ?? existing?.annualSnapshotRequired ?? true,
    postClosingTrialBalanceRequired: input.postClosingTrialBalanceRequired ?? existing?.postClosingTrialBalanceRequired ?? true,
    closeChecklistTemplateId: input.closeChecklistTemplateId || existing?.closeChecklistTemplateId || 'STANDARD_YEAR_END_CLOSE',
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : existing?.effectiveFrom || new Date(),
    status: 'DRAFT',
    createdBy: existing?.createdBy || context.userId,
    metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}), cyeModel: 'MODEL_A_CALCULATED_REPORTING_LINE' },
  };

  if (existing) {
    return db.closeV2Configuration.update({ where: { tenantId }, data });
  }
  return db.closeV2Configuration.create({
    data: { tenantId, ...data },
  });
}

export async function approveClosingConfiguration(db, context) {
  const cfg = await getClosingConfiguration(db, context.businessId);
  if (!cfg) throw new ClosingConfigurationMissingError();

  if (!cfg.retainedEarningsAccountId && cfg.closeMethod !== CloseMethod.OWNER_CAPITAL_CLOSE) {
    throw new InvalidClosingMethodError('Retained Earnings account must be configured before approval.');
  }
  if (
    (cfg.closeMethod === CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS ||
      cfg.closeMethod === CloseMethod.PARTNER_CAPITAL_ALLOCATION) &&
    cfg.incomeSummaryEnabled &&
    !cfg.incomeSummaryAccountId
  ) {
    throw new InvalidClosingMethodError('Income Summary account must be configured for this method.');
  }
  if (cfg.closeMethod === CloseMethod.OWNER_CAPITAL_CLOSE && !cfg.ownerCapitalAccountId) {
    throw new InvalidClosingMethodError('Owner Capital account required for OWNER_CAPITAL_CLOSE.');
  }

  return db.closeV2Configuration.update({
    where: { tenantId: context.businessId },
    data: {
      status: 'APPROVED',
      approvedBy: context.userId,
      approvedAt: new Date(),
    },
  });
}

export function resolveDestinationAccountId(cfg) {
  if (cfg.closeMethod === CloseMethod.OWNER_CAPITAL_CLOSE) {
    return cfg.ownerCapitalAccountId;
  }
  return cfg.retainedEarningsAccountId || cfg.ownerCapitalAccountId;
}
