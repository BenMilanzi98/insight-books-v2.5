import { createChecksum } from '../../domain/valueObjects/index.js';

/**
 * Extract normalized projections from configuration payloads.
 * Does NOT modify local tax rates, COA, Inventory, or enable offline.
 */

export function extractTaxDefinitions(payload, { configurationSnapshotId, tenantId, businessId, terminalId, environment }) {
  const rates = Array.isArray(payload?.taxRates) ? payload.taxRates : [];
  return rates.map((t) => {
    const row = {
      tenantId,
      businessId,
      terminalId,
      environment,
      configurationSnapshotId,
      externalTaxId: String(t.id || t.externalTaxId || ''),
      externalTaxCode: t.code || t.externalTaxCode || null,
      name: t.name || null,
      description: t.description || null,
      rate: t.rate != null ? t.rate : null,
      chargeMode: t.chargeMode || null,
      category: t.category || null,
      active: t.active !== false,
      effectiveFrom: t.effectiveFrom ? new Date(t.effectiveFrom) : null,
      effectiveTo: t.effectiveTo ? new Date(t.effectiveTo) : null,
    };
    row.sourceChecksum = createChecksum(row).value;
    return row;
  }).filter((r) => r.externalTaxId);
}

export function extractLevyDefinitions(payload, ctx) {
  const levies = Array.isArray(payload?.levies) ? payload.levies : [];
  return levies.map((l) => {
    const row = {
      tenantId: ctx.tenantId,
      businessId: ctx.businessId,
      terminalId: ctx.terminalId,
      environment: ctx.environment,
      configurationSnapshotId: ctx.configurationSnapshotId,
      externalLevyId: String(l.id || l.externalLevyId || ''),
      code: l.code || null,
      name: l.name || null,
      description: l.description || null,
      rate: l.rate != null ? l.rate : null,
      chargeMode: l.chargeMode || null,
      active: l.active !== false,
      effectiveFrom: l.effectiveFrom ? new Date(l.effectiveFrom) : null,
      effectiveTo: l.effectiveTo ? new Date(l.effectiveTo) : null,
    };
    row.sourceChecksum = createChecksum(row).value;
    return row;
  }).filter((r) => r.externalLevyId);
}

export function extractOfflineThresholds(globalPayload, terminalPayload) {
  const g = globalPayload?.offlinePolicies || {};
  const t = terminalPayload || {};
  return {
    offlineAllowedByMra: Boolean(t.offlineAllowed ?? g.offlineAllowed ?? false),
    offlineMaximumAmount: Number(t.offlineMaximumAmount ?? g.maximumAmount ?? 0),
    offlineMaximumAgeHours: Number(t.offlineMaximumAgeHours ?? g.maximumAgeHours ?? 0),
    // Configuration alone never enables offline mode
    offlineEnabledLocally: false,
  };
}

export function extractReceiptConfiguration(globalPayload) {
  const r = globalPayload?.receiptRequirements || {};
  return {
    version: r.version || 'unknown',
    requiredSellerFields: r.requiredSellerFields || [],
    requiredBuyerFields: r.requiredBuyerFields || [],
    qrRequired: Boolean(r.qrRequired),
    // Phase 8 does not generate production QR
    productionQrGenerated: false,
  };
}

export function extractTaxpayerProfile(payload) {
  return {
    tin: payload?.tin || null,
    legalName: payload?.legalName || null,
    tradingName: payload?.tradingName || null,
    status: payload?.status || null,
  };
}

export function validateExtractedTaxDefinitions(rows) {
  const blockers = [];
  for (const r of rows) {
    if (r.rate == null || Number.isNaN(Number(r.rate))) {
      blockers.push({ code: 'INVALID_TAX_RATE', message: `Tax ${r.externalTaxId} has invalid rate.` });
    }
  }
  return blockers;
}

export function validateExtractedOfflineThresholds(offline) {
  const blockers = [];
  if (offline.offlineMaximumAmount < 0) {
    blockers.push({ code: 'INVALID_OFFLINE_THRESHOLD', message: 'Offline maximum amount cannot be negative.' });
  }
  if (offline.offlineMaximumAgeHours < 0) {
    blockers.push({ code: 'INVALID_OFFLINE_THRESHOLD', message: 'Offline maximum age cannot be negative.' });
  }
  return blockers;
}
