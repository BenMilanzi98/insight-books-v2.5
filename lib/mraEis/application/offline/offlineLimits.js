/**
 * Phase 16 — Offline limit package evaluation (fail closed).
 */

export function evaluateOfflineLimits({
  package: limitPackage = null,
  offlineEnteredAt = null,
  offlineSaleCount = 0,
  cumulativeGrossAmount = '0',
  proposedSaleGrossAmount = '0',
  queueDepth = 0,
  queueBytes = 0,
  oldestItemAgeHours = 0,
  configurationAgeHours = 0,
  now = new Date(),
} = {}) {
  const blockers = [];
  const warnings = [];

  const pkg = limitPackage || defaultMockPackage();
  const entered = offlineEnteredAt ? new Date(offlineEnteredAt) : null;

  if (entered) {
    const durationHours = (now.getTime() - entered.getTime()) / 3600000;
    if (durationHours >= pkg.maximumOfflineDurationHours) {
      blockers.push('OFFLINE_DURATION_EXCEEDED');
    } else if (durationHours >= pkg.maximumOfflineDurationHours * 0.9) {
      warnings.push('OFFLINE_DURATION_NEAR_LIMIT');
    } else if (durationHours >= pkg.maximumOfflineDurationHours * 0.75) {
      warnings.push('OFFLINE_DURATION_75PCT');
    }
  }

  if (offlineSaleCount >= pkg.maximumOfflineSaleCount) {
    blockers.push('OFFLINE_COUNT_EXCEEDED');
  } else if (offlineSaleCount >= Math.floor(pkg.maximumOfflineSaleCount * 0.9)) {
    warnings.push('OFFLINE_COUNT_NEAR_LIMIT');
  }

  const cumulative = dec(cumulativeGrossAmount);
  const proposed = dec(proposedSaleGrossAmount);
  if (proposed > pkg.maximumIndividualSaleAmount) {
    blockers.push('OFFLINE_INDIVIDUAL_AMOUNT_EXCEEDED');
  }
  if (cumulative + proposed > pkg.maximumCumulativeGrossAmount) {
    blockers.push('OFFLINE_AMOUNT_EXCEEDED');
  }

  if (queueDepth >= pkg.maximumQueueSize) {
    blockers.push('OFFLINE_QUEUE_FULL');
  } else if (queueDepth >= Math.floor(pkg.maximumQueueSize * 0.9)) {
    warnings.push('QUEUE_NEAR_CAPACITY');
  }

  if (queueBytes >= pkg.maximumQueueBytes) {
    blockers.push('OFFLINE_QUEUE_BYTES_EXCEEDED');
  }

  if (oldestItemAgeHours >= pkg.maximumOldestItemAgeHours) {
    blockers.push('OFFLINE_ITEM_AGE_EXCEEDED');
  }

  if (configurationAgeHours >= pkg.maximumConfigurationAgeHours) {
    blockers.push('CONFIGURATION_STALE');
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    packageVersion: pkg.packageVersion,
    cashierCannotOverride: true,
    remaining: {
      sales: Math.max(0, pkg.maximumOfflineSaleCount - offlineSaleCount),
      amount: String(Math.max(0, pkg.maximumCumulativeGrossAmount - cumulative)),
      queueSlots: Math.max(0, pkg.maximumQueueSize - queueDepth),
      durationHours: entered
        ? Math.max(0, pkg.maximumOfflineDurationHours - (now.getTime() - entered.getTime()) / 3600000)
        : pkg.maximumOfflineDurationHours,
    },
  };
}

function defaultMockPackage() {
  return {
    packageVersion: 'offline-limits-mock-v1',
    maximumOfflineDurationHours: 72,
    maximumOfflineSaleCount: 100,
    maximumCumulativeGrossAmount: 5_000_000,
    maximumIndividualSaleAmount: 500_000,
    maximumQueueSize: 200,
    maximumQueueBytes: 50_000_000,
    maximumOldestItemAgeHours: 168,
    maximumConfigurationAgeHours: 72,
  };
}

function dec(v) {
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}
