import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';
import { evaluateConfigurationFreshness } from './stalenessService.js';

export async function getConfigurationHealth({
  tenantId,
  businessId = tenantId,
  terminalId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) return null;

  const freshness = await evaluateConfigurationFreshness({ tenantId, businessId, terminalId, db });
  const policy = await db.mraEisConfigurationPolicy.findUnique({ where: { terminalId } }).catch(() => null);

  const versions = {};
  for (const t of [CONFIGURATION_TYPE.GLOBAL, CONFIGURATION_TYPE.TERMINAL, CONFIGURATION_TYPE.TAXPAYER]) {
    const snap = await db.mraEisConfigurationSnapshot.findFirst({
      where: { terminalId, configurationType: t, status: 'ACTIVE' },
    });
    versions[t] = snap
      ? { version: snap.mraVersion, snapshotId: snap.id, checksum: snap.sourceChecksum, activatedAt: snap.activatedAt }
      : null;
  }

  const lastSync = await db.mraEisSyncRun.findFirst({
    where: { terminalId, syncType: 'CONFIGURATION' },
    orderBy: { requestedAt: 'desc' },
  });

  return {
    terminalId,
    environment: terminal.environment,
    globalStatus: versions.GLOBAL ? 'ACTIVE' : 'MISSING',
    terminalStatus: versions.TERMINAL ? 'ACTIVE' : 'MISSING',
    taxpayerStatus: versions.TAXPAYER ? 'ACTIVE' : 'MISSING',
    activeGlobalVersion: versions.GLOBAL?.version || null,
    activeTerminalVersion: versions.TERMINAL?.version || null,
    activeTaxpayerVersion: versions.TAXPAYER?.version || null,
    lastSuccessfulSyncAt: freshness.lastSuccessfulSyncAt,
    nextRequiredSyncAt: freshness.nextRequiredSyncAt,
    freshnessStatus: freshness.status,
    current: freshness.status === 'CURRENT',
    conflicts: freshness.status === 'CONFLICT',
    validationErrors: [],
    mappingRevalidationRequired: Boolean(policy?.mappingRevalidationRequired),
    terminalBlocked: terminal.status === 'BLOCKED' || Boolean(policy?.terminalBlocked),
    processingPaused: Boolean(freshness.processingPaused),
    offlineAllowedByMra: Boolean(policy?.offlineAllowedByMra),
    offlineEnabled: false,
    receiptPolicyVersion: policy?.receiptPolicyVersion || null,
    lastSyncRun: lastSync
      ? { id: lastSync.id, status: lastSync.status, trigger: lastSync.trigger, completedAt: lastSync.completedAt }
      : null,
    blockers: freshness.blockers,
    warnings: freshness.warnings,
    recommendedActions: freshness.processingPaused
      ? ['Run configuration synchronization', 'Resolve conflicts if present']
      : [],
    pauseContract: {
      allowNewFiscalSnapshots: freshness.allowNewFiscalSnapshots,
      allowTransmissionClaims: freshness.allowTransmissionClaims,
      allowReconciliation: freshness.allowReconciliation,
      allowReadAccess: freshness.allowReadAccess,
      allowConfigurationSync: freshness.allowConfigurationSync,
    },
  };
}
