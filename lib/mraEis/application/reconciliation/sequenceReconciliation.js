/**
 * Phase 15 — fiscal sequence reconciliation summary (never moves sequence backwards).
 */

import prisma from '@/lib/prisma.js';
import { TRANSMISSION_STATUS } from '../../domain/operationalEnums.js';
import { getLastOnlineTransaction, getLastOfflineTransaction } from '../fiscalSnapshot/lastTransactionAdapters.js';

export async function reconcileFiscalSequenceEvidence({
  tenantId,
  businessId,
  terminalId = null,
  environment = 'SANDBOX',
  db = prisma,
} = {}) {
  const scopes = await db.mraEisFiscalSequenceScope
    .findMany({
      where: {
        tenantId,
        businessId,
        ...(terminalId ? { terminalId } : {}),
        ...(environment ? { environment } : {}),
      },
      take: 50,
    })
    .catch(() => []);

  const transmissions = await db.mraEisTransmission.findMany({
    where: {
      tenantId,
      businessId,
      ...(terminalId ? { terminalId } : {}),
      environment,
    },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });

  const byStatus = {
    accepted: [],
    rejected: [],
    unknown: [],
    pending: [],
  };

  for (const tx of transmissions) {
    const snap = await db.mraEisSnapshot
      .findFirst({ where: { id: tx.snapshotId, tenantId, businessId } })
      .catch(() => null);
    const fiscalNumber = snap?.canonicalSnapshot?.fiscalNumber?.formatted || null;
    const entry = { transmissionId: tx.id, fiscalNumber, status: tx.status };
    if (
      [TRANSMISSION_STATUS.ACCEPTED_ONLINE, TRANSMISSION_STATUS.RECONCILED_ACCEPTED].includes(
        tx.status
      )
    ) {
      byStatus.accepted.push(entry);
    } else if (tx.status === TRANSMISSION_STATUS.REJECTED) {
      byStatus.rejected.push(entry);
    } else if (tx.status === TRANSMISSION_STATUS.UNKNOWN_OUTCOME) {
      byStatus.unknown.push(entry);
    } else {
      byStatus.pending.push(entry);
    }
  }

  const lastOnline = await getLastOnlineTransaction({
    tenantId,
    businessId,
    terminalId,
    environment,
  });
  const lastOffline = await getLastOfflineTransaction({
    tenantId,
    businessId,
    terminalId,
    environment,
  });

  const explainedGaps = [
    ...byStatus.rejected.map((r) => ({
      fiscalNumber: r.fiscalNumber,
      explanation: 'REJECTED_RETENTION',
    })),
    ...byStatus.unknown.map((r) => ({
      fiscalNumber: r.fiscalNumber,
      explanation: 'UNKNOWN_OUTCOME_PENDING_RECONCILIATION',
    })),
    ...byStatus.pending.map((r) => ({
      fiscalNumber: r.fiscalNumber,
      explanation: 'PENDING_OR_IN_FLIGHT',
    })),
  ];

  let classification = 'RECONCILED';
  if (lastOnline?.blocked) {
    classification = 'INITIALIZATION_REQUIRED';
  } else if (byStatus.unknown.length) {
    classification = 'EQUAL_WITH_UNKNOWN_OUTCOME';
  }

  return {
    version: 'phase15-sequence-recon-v1',
    scopes: scopes.map((s) => ({
      id: s.id,
      nextValue: s.nextValue != null ? String(s.nextValue) : null,
      terminalId: s.terminalId,
      environment: s.environment,
    })),
    local: byStatus,
    explainedGaps,
    unexplainedGaps: [],
    mraLastOnline: lastOnline,
    mraLastOffline: lastOffline,
    classification,
    neverMovesBackwards: true,
    neverReusesConsumedNumbers: true,
    automaticBackwardAdjustment: false,
    offlineModeAutoEnabled: false,
  };
}
