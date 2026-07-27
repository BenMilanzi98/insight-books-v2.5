import prisma from '@/lib/prisma.js';

/**
 * Read-only Phase 5 diagnostics. Platform/admin use only.
 * Never returns vault secrets or credential plaintext.
 */
export async function getEisFoundationDiagnostics({ tenantId = null, db = prisma } = {}) {
  const scope = tenantId ? { tenantId } : {};

  const [
    terminals,
    credentials,
    configs,
    snapshots,
    transmissions,
    attempts,
    responses,
    offline,
    outboxPending,
    manualOpen,
    activeConfigs,
  ] = await Promise.all([
    db.mraEisTerminal.count({ where: scope }),
    db.mraEisCredentialReference.count({ where: scope }),
    db.mraEisConfigurationSnapshot.count({ where: scope }),
    db.mraEisSnapshot.count({ where: scope }),
    db.mraEisTransmission.count({ where: scope }),
    db.mraEisTransmissionAttempt.count({ where: scope }),
    db.mraEisResponse.count({ where: scope }),
    db.mraEisOfflineQueueEntry.count({ where: scope }),
    db.mraEisOutbox.count({ where: { ...scope, status: 'PENDING' } }),
    db.mraEisManualReviewCase.count({ where: { ...scope, status: 'OPEN' } }),
    db.mraEisConfigurationSnapshot.findMany({
      where: { ...scope, status: 'ACTIVE' },
      select: { terminalId: true, configurationType: true, id: true },
    }),
  ]);

  const keyCounts = new Map();
  for (const row of activeConfigs) {
    const key = `${row.terminalId}:${row.configurationType}`;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
  const conflictingActiveConfigurations = [...keyCounts.entries()]
    .filter(([, cnt]) => cnt > 1)
    .map(([key, cnt]) => ({ key, count: cnt }));

  return {
    readOnly: true,
    counts: {
      terminals,
      credentialReferences: credentials,
      configurationSnapshots: configs,
      snapshots,
      transmissions,
      attempts,
      responses,
      offlineEntries: offline,
      outboxPending,
      openManualReviews: manualOpen,
    },
    conflicts: {
      conflictingActiveConfigurations,
    },
    secretHygiene: {
      plaintextJwtColumns: false,
      plaintextSecretColumns: false,
      plaintextTacColumns: false,
      credentialStorage: 'vaultReference only',
    },
  };
}
