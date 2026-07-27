import prisma from '@/lib/prisma.js';
import { CONFIG_FRESHNESS_STATUS, CONFIGURATION_TYPE, TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

const SAFE_MAX_AGE_MS = Number(process.env.MRA_EIS_CONFIG_SAFE_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const REFRESH_DUE_MS = Number(process.env.MRA_EIS_CONFIG_REFRESH_DUE_MS || 20 * 60 * 60 * 1000);

/**
 * Deterministic configuration freshness + processing-pause contract.
 */
export async function evaluateConfigurationFreshness({
  tenantId,
  businessId = tenantId,
  terminalId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) {
    return {
      terminalId,
      status: CONFIG_FRESHNESS_STATUS.MISSING,
      allowNewFiscalSnapshots: false,
      allowQueueClaims: false,
      allowConfigurationMaintenance: true,
      blockers: ['TERMINAL_NOT_FOUND'],
      warnings: [],
      evaluatedAt: new Date().toISOString(),
      policyVersion: 'phase8-staleness-v1',
    };
  }

  const activeVersions = {};
  let missing = false;
  for (const t of [CONFIGURATION_TYPE.GLOBAL, CONFIGURATION_TYPE.TERMINAL, CONFIGURATION_TYPE.TAXPAYER]) {
    const snap = await db.mraEisConfigurationSnapshot.findFirst({
      where: { terminalId, configurationType: t, status: 'ACTIVE' },
    });
    activeVersions[t] = snap?.mraVersion || null;
    if (!snap) missing = true;
  }

  const policy = await db.mraEisConfigurationPolicy.findUnique({ where: { terminalId } }).catch(() => null);
  const lastSuccessfulSyncAt = terminal.lastConfigurationSyncAt || null;
  const nextRequiredSyncAt =
    policy?.nextRequiredSyncAt ||
    (lastSuccessfulSyncAt ? new Date(lastSuccessfulSyncAt.getTime() + SAFE_MAX_AGE_MS) : null);

  const blockers = [];
  const warnings = [];
  let status = CONFIG_FRESHNESS_STATUS.CURRENT;

  if (terminal.status === 'CONFIGURATION_CONFLICT' || policy?.terminalBlocked) {
    status = policy?.terminalBlocked ? CONFIG_FRESHNESS_STATUS.INVALID : CONFIG_FRESHNESS_STATUS.CONFLICT;
    blockers.push(policy?.terminalBlocked ? 'TERMINAL_BLOCKED' : 'CONFIGURATION_CONFLICT');
  } else if (missing) {
    status = CONFIG_FRESHNESS_STATUS.MISSING;
    blockers.push('REQUIRED_CONFIGURATION_MISSING');
  } else if (!lastSuccessfulSyncAt) {
    status = CONFIG_FRESHNESS_STATUS.MISSING;
    blockers.push('NEVER_SYNCED');
  } else {
    const age = Date.now() - lastSuccessfulSyncAt.getTime();
    if (age > SAFE_MAX_AGE_MS) {
      status = CONFIG_FRESHNESS_STATUS.STALE;
      blockers.push('CONFIGURATION_STALE');
    } else if (age > REFRESH_DUE_MS) {
      status = CONFIG_FRESHNESS_STATUS.REFRESH_DUE;
      warnings.push('CONFIGURATION_REFRESH_DUE');
    }
  }

  if (terminal.status === TERMINAL_STATUS.CONFIGURATION_STALE) {
    status = CONFIG_FRESHNESS_STATUS.STALE;
  }

  const pause = processingPauseContract(status);

  return {
    terminalId,
    activeVersions,
    lastSuccessfulSyncAt,
    nextRequiredSyncAt,
    status,
    ...pause,
    blockers,
    warnings,
    evaluatedAt: new Date().toISOString(),
    policyVersion: 'phase8-staleness-v1',
  };
}

export function processingPauseContract(freshnessStatus) {
  switch (freshnessStatus) {
    case CONFIG_FRESHNESS_STATUS.CURRENT:
      return {
        allowNewFiscalSnapshots: true,
        allowTransmissionClaims: true,
        allowRetries: true,
        allowReconciliation: true,
        allowReceiptReprint: true,
        allowReadAccess: true,
        allowConfigurationSync: true,
        allowMappingMaintenance: true,
        allowQueueClaims: true,
        allowConfigurationMaintenance: true,
        processingPaused: false,
      };
    case CONFIG_FRESHNESS_STATUS.REFRESH_DUE:
      return {
        allowNewFiscalSnapshots: true,
        allowTransmissionClaims: true,
        allowRetries: true,
        allowReconciliation: true,
        allowReceiptReprint: true,
        allowReadAccess: true,
        allowConfigurationSync: true,
        allowMappingMaintenance: true,
        allowQueueClaims: true,
        allowConfigurationMaintenance: true,
        processingPaused: false,
      };
    case CONFIG_FRESHNESS_STATUS.STALE:
    case CONFIG_FRESHNESS_STATUS.EXPIRED:
    case CONFIG_FRESHNESS_STATUS.MISSING:
    case CONFIG_FRESHNESS_STATUS.INVALID:
    case CONFIG_FRESHNESS_STATUS.CONFLICT:
    case CONFIG_FRESHNESS_STATUS.MANUAL_REVIEW:
      return {
        allowNewFiscalSnapshots: false,
        allowTransmissionClaims: false,
        allowRetries: false,
        allowReconciliation: true,
        allowReceiptReprint: true,
        allowReadAccess: true,
        allowConfigurationSync: true,
        allowMappingMaintenance: true,
        allowQueueClaims: false,
        allowConfigurationMaintenance: true,
        processingPaused: true,
      };
    default:
      return {
        allowNewFiscalSnapshots: false,
        allowTransmissionClaims: false,
        allowRetries: false,
        allowReconciliation: true,
        allowReceiptReprint: true,
        allowReadAccess: true,
        allowConfigurationSync: true,
        allowMappingMaintenance: true,
        allowQueueClaims: false,
        allowConfigurationMaintenance: true,
        processingPaused: true,
      };
  }
}
