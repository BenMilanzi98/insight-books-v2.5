import { EquityModel, LegalStructure } from '../domain/enums.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';

export async function getEquityConfiguration(db, tenantId) {
  return db.eqV2Configuration.findUnique({ where: { tenantId } });
}

export async function upsertEquityConfiguration(db, context, input) {
  const legalStructure = input.legalStructure || LegalStructure.SOLE_PROPRIETORSHIP;
  const equityModel = input.equityModel || EquityModel.OWNER_CAPITAL;
  if (!Object.values(LegalStructure).includes(legalStructure)) {
    throw new AccountingValidationError('Unsupported legal structure.', [
      { path: 'legalStructure', message: legalStructure },
    ]);
  }
  if (!Object.values(EquityModel).includes(equityModel)) {
    throw new AccountingValidationError('Unsupported equity model.', [
      { path: 'equityModel', message: equityModel },
    ]);
  }

  const shareCapitalEnabled =
    input.shareCapitalEnabled ??
    [EquityModel.SHARE_CAPITAL, EquityModel.HYBRID_APPROVED_MODEL].includes(equityModel);
  const partnershipCapitalEnabled =
    input.partnershipCapitalEnabled ?? equityModel === EquityModel.PARTNER_CAPITAL;
  const ownerCapitalEnabled =
    input.ownerCapitalEnabled ??
    [EquityModel.OWNER_CAPITAL, EquityModel.HYBRID_APPROVED_MODEL, EquityModel.PARTNER_CAPITAL].includes(
      equityModel
    );

  const data = {
    tenantId: context.businessId,
    legalStructure,
    equityModel,
    ownershipTrackingEnabled: input.ownershipTrackingEnabled ?? shareCapitalEnabled,
    shareCapitalEnabled,
    partnershipCapitalEnabled,
    ownerCapitalEnabled,
    shareClassesEnabled: input.shareClassesEnabled ?? shareCapitalEnabled,
    votingRightsEnabled: input.votingRightsEnabled ?? false,
    dividendManagementEnabled: input.dividendManagementEnabled ?? shareCapitalEnabled,
    ownerDrawingsEnabled: input.ownerDrawingsEnabled ?? (ownerCapitalEnabled || partnershipCapitalEnabled),
    retainedEarningsEnabled: input.retainedEarningsEnabled ?? true,
    reservesEnabled: input.reservesEnabled ?? false,
    ownershipPercentageScale: input.ownershipPercentageScale ?? 4,
    shareQuantityScale: input.shareQuantityScale ?? 0,
    defaultCurrency: input.defaultCurrency || 'MWK',
    requireContributionApproval: input.requireContributionApproval ?? true,
    requireDrawingApproval: input.requireDrawingApproval ?? true,
    requireDividendApproval: input.requireDividendApproval ?? true,
    requireSeparateApprover: input.requireSeparateApprover ?? true,
    status: input.status || 'ACTIVE',
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
    createdBy: context.userId || null,
    approvedBy: input.approvedBy || null,
    metadata: input.metadata ?? undefined,
  };

  return db.eqV2Configuration.upsert({
    where: { tenantId: context.businessId },
    create: data,
    update: { ...data, createdBy: undefined },
  });
}

export function assertWorkflowAllowed(cfg, workflow) {
  if (!cfg || cfg.status !== 'ACTIVE') {
    throw new AccountingValidationError('Equity configuration missing or inactive.', [
      { path: 'configuration', message: 'required' },
    ]);
  }
  const map = {
    contribution: cfg.ownerCapitalEnabled || cfg.partnershipCapitalEnabled || cfg.shareCapitalEnabled,
    drawing: cfg.ownerDrawingsEnabled,
    dividend: cfg.dividendManagementEnabled,
    shareIssuance: cfg.shareCapitalEnabled,
    shareTransfer: cfg.shareCapitalEnabled && cfg.ownershipTrackingEnabled,
    shareClass: cfg.shareClassesEnabled,
  };
  if (map[workflow] === false) {
    throw new AccountingValidationError(`Workflow '${workflow}' is not enabled for this equity model.`, [
      { path: 'workflow', message: workflow },
    ]);
  }
}
