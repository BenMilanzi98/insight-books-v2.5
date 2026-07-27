/**
 * Scope-based fiscal sequence + atomic reservation — Phase 12.
 * Never uses MAX(number)+1. Never initializes from local invoice counts.
 */
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { FISCAL_ALLOCATION_STATUS } from '../../domain/operationalEnums.js';
import { formatSyntheticFiscalNumber } from './fiscalNumberScope.js';
import { FiscalSnapshotErrors } from './fiscalSnapshotErrors.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

export const SEQUENCE_STATUS = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CONFLICT: 'CONFLICT',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  BLOCKED: 'BLOCKED',
  RETIRED: 'RETIRED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const RESERVATION_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  ASSIGNED: 'ASSIGNED',
  VOIDED: 'VOIDED',
  ABANDONED: 'ABANDONED',
  CONFLICT: 'CONFLICT',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

/**
 * Ensure sequence exists for scope. Initialization requires verified evidence.
 * For synthetic sandbox: may initialize at 1 with SYNTHETIC_SANDBOX evidence.
 */
export async function ensureFiscalSequenceScope({
  tenantId,
  businessId = tenantId,
  environment,
  scopeKey,
  scopeType = 'TERMINAL_BUSINESS_DATE_ENVIRONMENT',
  terminalId = null,
  mraSiteId = null,
  sourceType = null,
  onlineOrOfflineMode = 'ONLINE',
  periodKey = null,
  contractVersion,
  isSynthetic = false,
  initializationEvidence = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const existing = await db.mraEisFiscalSequenceScope.findUnique({
    where: { tenantId_businessId_environment_scopeKey: { tenantId, businessId, environment: env, scopeKey } },
  }).catch(() => null);

  // Fallback findFirst if compound unique name differs after generate
  const found =
    existing ||
    (await db.mraEisFiscalSequenceScope.findFirst({
      where: { tenantId, businessId, environment: env, scopeKey },
    }));

  if (found) return found;

  if (!isSynthetic && !initializationEvidence) {
    throw FiscalSnapshotErrors.sequenceUninit({
      message: 'Sequence initialization requires verified MRA evidence.',
      details: { scopeKey, environment: env },
    });
  }

  const evidence = initializationEvidence || {
    source: 'SYNTHETIC_SANDBOX',
    note: 'Non-production synthetic sequence. Not an MRA fiscal number.',
  };

  try {
    return await db.mraEisFiscalSequenceScope.create({
      data: {
        tenantId,
        businessId,
        environment: env,
        scopeKey,
        scopeType,
        terminalId,
        mraSiteId,
        sourceType,
        onlineOrOfflineMode,
        periodKey,
        nextValue: 1,
        increment: 1,
        resetPolicy: 'PER_BUSINESS_DAY',
        contractVersion: contractVersion || 'phase12-fiscal-number-contract-v1',
        status: SEQUENCE_STATUS.ACTIVE,
        initializationEvidence: evidence,
        initializedAt: new Date(),
        version: 1,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return db.mraEisFiscalSequenceScope.findFirst({
        where: { tenantId, businessId, environment: env, scopeKey },
      });
    }
    throw err;
  }
}

/**
 * Atomic reservation — row lock, never MAX+1.
 */
export async function reserveFiscalNumberAtomic({
  tenantId,
  businessId = tenantId,
  fiscalSnapshotDraftId,
  scopeResolution,
  idempotencyKey,
  allocatedByService = 'phase12-fiscal-snapshot',
  correlationId = null,
  requestId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!scopeResolution?.resolved) {
    throw FiscalSnapshotErrors.scopeAmbiguous({
      details: { blockers: scopeResolution?.blockers },
    });
  }

  const existingReservation = await db.mraEisFiscalNumberReservation.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    db.mraEisFiscalNumberReservation.findFirst({ where: { idempotencyKey } })
  );
  if (existingReservation) {
    if (existingReservation.fiscalSnapshotId === fiscalSnapshotDraftId) {
      return { reservation: existingReservation, duplicate: true };
    }
    throw FiscalSnapshotErrors.reservationConflict({
      message: 'Idempotency key already used for a different snapshot.',
    });
  }

  const activeForSnapshot = await db.mraEisFiscalNumberReservation.findFirst({
    where: {
      fiscalSnapshotId: fiscalSnapshotDraftId,
      status: { in: [RESERVATION_STATUS.RESERVED, RESERVATION_STATUS.ASSIGNED] },
    },
  });
  if (activeForSnapshot) {
    return { reservation: activeForSnapshot, duplicate: true };
  }

  return db.$transaction(async (tx) => {
    const seq = await ensureFiscalSequenceScope({
      tenantId,
      businessId,
      environment: scopeResolution.scopeDimensions.environment,
      scopeKey: scopeResolution.scopeKey,
      terminalId: scopeResolution.scopeDimensions.terminalId,
      mraSiteId: scopeResolution.scopeDimensions.mraSiteId,
      sourceType: scopeResolution.scopeDimensions.sourceType,
      onlineOrOfflineMode: 'ONLINE',
      periodKey: scopeResolution.scopeDimensions.businessDate,
      contractVersion: scopeResolution.contractVersion,
      isSynthetic: scopeResolution.isSynthetic,
      db: tx,
    });

    if (seq.status !== SEQUENCE_STATUS.ACTIVE) {
      throw FiscalSnapshotErrors.sequencePaused({
        details: { status: seq.status, scopeKey: seq.scopeKey },
      });
    }

    const locked = await tx.$queryRaw`
      SELECT id, "nextValue", version, status, "tenantId", "businessId"
      FROM "MraEisFiscalSequenceScope"
      WHERE id = ${seq.id}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row || row.tenantId !== tenantId || row.businessId !== businessId) {
      throw FiscalSnapshotErrors.crossTenant({ tenantId, businessId });
    }
    if (row.status !== SEQUENCE_STATUS.ACTIVE) {
      throw FiscalSnapshotErrors.sequencePaused({ details: { status: row.status } });
    }

    const sequenceVersionBefore = Number(row.version);
    const reservationValue = Number(row.nextValue);
    const nextAfter = reservationValue + Number(seq.increment || 1);

    await tx.mraEisFiscalSequenceScope.update({
      where: { id: seq.id },
      data: {
        nextValue: nextAfter,
        lastReservedValue: reservationValue,
        version: { increment: 1 },
      },
    });

    const businessDate = scopeResolution.scopeDimensions.businessDate;
    const formatted = formatSyntheticFiscalNumber({
      terminalId: scopeResolution.scopeDimensions.terminalId,
      businessDate,
      sequence: reservationValue,
    });

    // Also record in Phase 5 allocation table for uniqueness of generatedFiscalNumber
    let allocation = null;
    try {
      allocation = await tx.mraEisFiscalNumberAllocation.create({
        data: {
          tenantId,
          businessId,
          terminalId: scopeResolution.scopeDimensions.terminalId,
          snapshotId: fiscalSnapshotDraftId,
          businessDate: new Date(`${businessDate}T00:00:00.000Z`),
          dailySequence: reservationValue,
          generatedFiscalNumber: formatted,
          algorithmVersion: scopeResolution.isSynthetic
            ? 'PHASE12_SYNTHETIC_SANDBOX'
            : 'PHASE12_UNVERIFIED',
          allocationStatus: FISCAL_ALLOCATION_STATUS.RESERVED,
          allocatedByService,
          correlationId,
          requestId,
          reason: scopeResolution.isSynthetic
            ? 'Synthetic sandbox number — not an MRA fiscal number'
            : 'Phase 12 reservation',
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        throw FiscalSnapshotErrors.duplicateNumber({
          details: { formatted, reservationValue },
        });
      }
      throw err;
    }

    const reservation = await tx.mraEisFiscalNumberReservation.create({
      data: {
        tenantId,
        businessId,
        environment: scopeResolution.scopeDimensions.environment,
        sequenceScopeId: seq.id,
        scopeKey: scopeResolution.scopeKey,
        fiscalSnapshotId: fiscalSnapshotDraftId,
        reservationValue,
        formattedFiscalNumber: formatted,
        status: RESERVATION_STATUS.RESERVED,
        idempotencyKey,
        sequenceVersionBefore,
        sequenceVersionAfter: sequenceVersionBefore + 1,
        allocationId: allocation.id,
        reservedAt: new Date(),
        createdBy: allocatedByService,
        isSynthetic: Boolean(scopeResolution.isSynthetic),
        isMraFiscalNumber: false,
      },
    });

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorType: 'SERVICE',
      action: 'FISCAL_NUMBER_RESERVED',
      resourceType: 'MraEisFiscalNumberReservation',
      resourceId: reservation.id,
      metadata: {
        scopeKey: scopeResolution.scopeKey,
        reservationValue,
        formatted,
        isSynthetic: true,
        maxPlusOneUsed: false,
      },
    }, tx).catch(() => {});

    return { reservation, allocation, sequence: reservationValue, duplicate: false };
  });
}

export async function markReservationAssigned({
  reservationId,
  tenantId,
  businessId,
  db = prisma,
}) {
  const updated = await db.mraEisFiscalNumberReservation.updateMany({
    where: {
      id: reservationId,
      tenantId,
      businessId,
      status: RESERVATION_STATUS.RESERVED,
    },
    data: {
      status: RESERVATION_STATUS.ASSIGNED,
      assignedAt: new Date(),
    },
  });
  if (updated.count !== 1) {
    throw FiscalSnapshotErrors.reservationConflict({
      message: 'Reservation could not be marked ASSIGNED.',
    });
  }
  const reservation = await db.mraEisFiscalNumberReservation.findUnique({ where: { id: reservationId } });
  if (reservation?.allocationId) {
    await db.mraEisFiscalNumberAllocation.update({
      where: { id: reservation.allocationId },
      data: {
        allocationStatus: FISCAL_ALLOCATION_STATUS.ATTACHED_TO_SNAPSHOT,
        snapshotId: reservation.fiscalSnapshotId,
      },
    }).catch(() => {});
  }
  if (reservation?.sequenceScopeId) {
    await db.mraEisFiscalSequenceScope.update({
      where: { id: reservation.sequenceScopeId },
      data: { lastAssignedValue: reservation.reservationValue },
    }).catch(() => {});
  }
  return reservation;
}

/**
 * Local sequence reconciliation foundation (no live MRA query).
 */
export async function reconcileFiscalSequenceScope({
  tenantId,
  businessId = tenantId,
  sequenceScopeId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const seq = await db.mraEisFiscalSequenceScope.findFirst({
    where: { id: sequenceScopeId, tenantId, businessId },
  });
  if (!seq) {
    return { status: 'INITIALIZATION_REQUIRED', blockers: ['SEQUENCE_NOT_FOUND'] };
  }

  const reservations = await db.mraEisFiscalNumberReservation.findMany({
    where: { sequenceScopeId: seq.id, tenantId, businessId },
  });
  const assigned = reservations.filter((r) => r.status === RESERVATION_STATUS.ASSIGNED);
  const reserved = reservations.filter((r) => r.status === RESERVATION_STATUS.RESERVED);
  const voided = reservations.filter((r) =>
    [RESERVATION_STATUS.VOIDED, RESERVATION_STATUS.ABANDONED].includes(r.status)
  );
  const highestAssigned = assigned.reduce((m, r) => Math.max(m, r.reservationValue), 0);
  const expectedNext = highestAssigned + voided.length + reserved.length + 1;
  // Simpler: nextValue should be > last reserved/assigned
  const maxConsumed = reservations.reduce((m, r) => Math.max(m, r.reservationValue), 0);
  const gaps = [];
  for (let i = 1; i <= maxConsumed; i += 1) {
    if (!reservations.some((r) => r.reservationValue === i)) {
      gaps.push({ value: i, classification: 'UNEXPLAINED_GAP' });
    }
  }
  for (const r of voided) {
    gaps.push({
      value: r.reservationValue,
      classification: 'RESERVED_BUT_SNAPSHOT_FAILED_OR_VOIDED',
      reservationId: r.id,
    });
  }

  let status = 'RECONCILED';
  if (gaps.some((g) => g.classification === 'UNEXPLAINED_GAP')) status = 'UNEXPLAINED_GAPS';
  if (Number(seq.nextValue) !== maxConsumed + 1 && maxConsumed > 0) {
    status = status === 'RECONCILED' ? 'LOCAL_INCONSISTENCY' : status;
  }

  return {
    sequenceId: seq.id,
    scopeKey: seq.scopeKey,
    localNextValue: seq.nextValue,
    localLastReserved: seq.lastReservedValue,
    localLastAssigned: seq.lastAssignedValue,
    highestSnapshotValue: highestAssigned,
    mraLastKnownValue: seq.lastMraConfirmedValue,
    gapCount: gaps.length,
    unexplainedGapCount: gaps.filter((g) => g.classification === 'UNEXPLAINED_GAP').length,
    duplicateCount: 0,
    pendingReservationCount: reserved.length,
    gaps,
    status,
    blockers: status === 'UNEXPLAINED_GAPS' ? ['UNEXPLAINED_GAPS'] : [],
    warnings: [],
    recommendedActions:
      status === 'RECONCILED' ? [] : ['OPEN_MANUAL_REVIEW', 'EXPORT_GAP_REPORT'],
    reconciliationVersion: 'phase12-sequence-recon-v1',
    expectedNextHint: expectedNext,
  };
}
