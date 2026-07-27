/**
 * Fiscal snapshot orchestrator — Phase 12.
 * Claim → build in memory → final commit with optional number reservation.
 * No MRA API. No Journal. No Stock Movement.
 */
import prisma from '@/lib/prisma.js';
import { SNAPSHOT_STATUS, EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { BRIDGE_STATUS } from '../eligibility/salesBridgeService.js';
import { evaluateFiscalSnapshotReadiness } from './snapshotReadiness.js';
import {
  buildSellerSnapshot,
  buildBuyerSnapshot,
  buildTerminalSnapshot,
  buildLocationSnapshot,
  buildFiscalLines,
  buildPaymentSnapshot,
  buildTaxAndLevySummaries,
  buildTotalsSnapshot,
  buildCanonicalFiscalSnapshot,
} from './canonicalSnapshotBuilder.js';
import {
  reserveFiscalNumberAtomic,
  markReservationAssigned,
} from './fiscalSequenceService.js';
import { FiscalSnapshotErrors } from './fiscalSnapshotErrors.js';
import { canonicalize, CANONICALIZATION_VERSION } from '../../infrastructure/security/canonicalization.js';

export const SALES_PAYLOAD_REQUESTED_EVENT =
  EIS_OUTBOX_EVENT.SALES_PAYLOAD_REQUESTED || 'MRA_EIS_SALES_PAYLOAD_REQUESTED';

/**
 * Create or return completed snapshot for a READY bridge.
 */
export async function createFiscalSnapshotFromBridge({
  tenantId,
  businessId = tenantId,
  bridgeRecordId,
  expectedBridgeVersion = null,
  actorOrServiceContext = null,
  correlationId = null,
  requestId = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);

  const readiness = await evaluateFiscalSnapshotReadiness({
    tenantId,
    businessId,
    bridgeRecordId,
    expectedBridgeVersion,
    actorOrServiceContext,
    db,
  });

  const existingByBridge = await db.mraEisSnapshot.findFirst({
    where: { tenantId, businessId, bridgeRecordId },
    include: { lines: true, payments: true },
  });
  if (existingByBridge?.status === SNAPSHOT_STATUS.COMPLETED) {
    return {
      ok: true,
      duplicate: true,
      snapshot: existingByBridge,
      message: 'Existing completed fiscal snapshot returned (idempotent).',
      mraSubmitted: false,
      mraAccepted: false,
      qrGenerated: false,
    };
  }
  if (
    existingByBridge &&
    [SNAPSHOT_STATUS.NUMBER_PENDING, SNAPSHOT_STATUS.BUILDING, SNAPSHOT_STATUS.VALIDATING].includes(
      existingByBridge.status
    )
  ) {
    return {
      ok: true,
      duplicate: true,
      numberPending: existingByBridge.status === SNAPSHOT_STATUS.NUMBER_PENDING,
      snapshot: existingByBridge,
      message:
        'Existing draft/number-pending fiscal snapshot returned (idempotent). Not yet submitted to MRA.',
      mraSubmitted: false,
      mraAccepted: false,
      qrGenerated: false,
    };
  }

  // Allow content build when only number-contract blockers remain
  const hardBlockers = (readiness.blockers || []).filter(
    (b) =>
      b !== 'FISCAL_NUMBER_CONTRACT_UNVERIFIED' &&
      b !== 'FISCAL_NUMBER_SCOPE_AMBIGUOUS' &&
      !String(b).includes('SCOPE')
  );
  if (hardBlockers.length || !readiness.snapshotCreationAllowed) {
    throw FiscalSnapshotErrors.readiness({
      message: 'Fiscal snapshot readiness failed.',
      details: { blockers: readiness.blockers, warnings: readiness.warnings },
      requiredAction: 'RESOLVE_BLOCKERS',
    });
  }

  const { bridge, decision, source, lines, payments, terminal, accounting, inventory, checksumResult, scope } =
    readiness;

  // STEP A — claim draft snapshot
  let draft;
  try {
    draft = await db.mraEisSnapshot.create({
      data: {
        tenantId,
        businessId,
        branchId: bridge.branchId,
        terminalId: bridge.terminalId || terminal?.id || 'UNKNOWN',
        siteMappingId: bridge.siteMappingId,
        bridgeRecordId: bridge.id,
        eligibilityDecisionId: bridge.eligibilityDecisionId,
        sourceType: bridge.sourceType,
        sourceId: bridge.sourceId,
        sourceVersion: bridge.sourceVersion,
        sourceFinalizationIdentity: bridge.sourceFinalizationIdentity,
        sourceChecksum: checksumResult.sourceChecksum,
        localDocumentNumber: bridge.sourceTransactionNumber,
        transactionDate: bridge.sourceFinalizedAt || new Date(),
        postingDate: bridge.sourceFinalizedAt || new Date(),
        businessDate: bridge.businessDate || new Date(),
        environment: bridge.environment,
        status: SNAPSHOT_STATUS.BUILDING,
        policyVersion: bridge.eligibilityPolicyVersion || 'phase11-eligibility-policy-v1',
        subtotal: bridge.netAmount ?? source?.subtotal ?? 0,
        discountTotal: bridge.discountAmount ?? 0,
        taxTotal: bridge.taxAmount ?? 0,
        levyTotal: bridge.levyAmount ?? 0,
        invoiceTotal: bridge.grossAmount ?? source?.total ?? 0,
        currency: bridge.currency || 'MWK',
        snapshotChecksum: 'PENDING',
        canonicalSnapshot: { status: 'BUILDING' },
        createdByService: 'phase12-snapshot-orchestrator',
        version: 1,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.mraEisSnapshot.findFirst({
        where: {
          tenantId,
          businessId,
          sourceType: bridge.sourceType,
          sourceId: bridge.sourceId,
          sourceVersion: bridge.sourceVersion,
        },
      });
      if (existing?.status === SNAPSHOT_STATUS.COMPLETED) {
        return { ok: true, duplicate: true, snapshot: existing, mraSubmitted: false };
      }
      throw FiscalSnapshotErrors.idempotencyConflict({ details: { existingId: existing?.id } });
    }
    throw err;
  }

  // STEP B — build in memory
  const seller = buildSellerSnapshot({ bridge, terminal });
  const buyer = buildBuyerSnapshot({ bridge, decision, source, customer: readiness.customer });
  const terminalSnap = buildTerminalSnapshot({ terminal, bridge });
  const location = buildLocationSnapshot({ bridge });
  const fiscalLines = buildFiscalLines({ lines, bridge });
  const payment = buildPaymentSnapshot({ payments, bridge, source });
  const { taxSummary, levySummary } = buildTaxAndLevySummaries({ fiscalLines });
  const totals = buildTotalsSnapshot({ bridge, source, fiscalLines, payment });
  if (!totals.valid) {
    await db.mraEisSnapshot.update({
      where: { id: draft.id },
      data: { status: SNAPSHOT_STATUS.FAILED },
    });
    throw FiscalSnapshotErrors.totals({ details: { totals } });
  }

  let reservation = null;
  let fiscalNumber = null;
  let finalStatus = SNAPSHOT_STATUS.NUMBER_PENDING;

  if (readiness.numberAllocationAllowed && scope?.resolved) {
    const reserved = await reserveFiscalNumberAtomic({
      tenantId,
      businessId,
      fiscalSnapshotDraftId: draft.id,
      scopeResolution: scope,
      idempotencyKey: `fisc-res:${bridge.id}:${draft.id}`,
      correlationId,
      requestId,
      db,
    });
    reservation = reserved.reservation;
    fiscalNumber = {
      formatted: reservation.formattedFiscalNumber,
      rawSequence: reservation.reservationValue,
      isSynthetic: reservation.isSynthetic,
      contractVersion: scope.contractVersion,
      scopeKey: scope.scopeKey,
      reservationId: reservation.id,
    };
    finalStatus = SNAPSHOT_STATUS.COMPLETED;
  }

  const built = buildCanonicalFiscalSnapshot({
    bridge,
    decision,
    seller,
    buyer,
    terminalSnap,
    location,
    fiscalLines,
    taxSummary,
    levySummary,
    payment,
    totals,
    currency: bridge.currency || 'MWK',
    fiscalNumber,
    accountingPostingIdentity: accounting?.postingIdentity || null,
    inventoryPostingIdentity: inventory?.postingIdentity || null,
    sourceChecksum: checksumResult.sourceChecksum,
  });

  // STEP C — final persist
  const completed = await db.$transaction(async (tx) => {
    const bridgeLocked = await tx.mraEisSalesBridge.findFirst({
      where: { id: bridge.id, tenantId, businessId },
    });
    if (!bridgeLocked) throw FiscalSnapshotErrors.readiness({ message: 'Bridge disappeared.' });
    if (bridgeLocked.futureFiscalSnapshotId) {
      return tx.mraEisSnapshot.findUnique({
        where: { id: bridgeLocked.futureFiscalSnapshotId },
        include: { lines: true, payments: true },
      });
    }

    // Replace pending lines/payments
    await tx.mraEisSnapshotLine.deleteMany({ where: { snapshotId: draft.id } });
    await tx.mraEisSnapshotPayment.deleteMany({ where: { snapshotId: draft.id } });

    const header = await tx.mraEisSnapshot.update({
      where: { id: draft.id },
      data: {
        status: finalStatus,
        snapshotChecksum: built.snapshotChecksum,
        canonicalSnapshot: built.canonical,
        canonicalizationVersion: built.canonicalizationVersion,
        checksumAlgorithmVersion: built.checksumAlgorithmVersion,
        schemaVersion: built.schemaVersion,
        sellerTin: seller.sellerTin,
        sellerName: seller.legalName,
        tradingName: seller.tradingName,
        buyerCustomerId: buyer.localCustomerId,
        buyerName: buyer.buyerLegalName,
        buyerTin: buyer.buyerTin,
        subtotal: totals.headerNetTotal,
        discountTotal: totals.headerDiscountTotal,
        taxTotal: totals.headerTaxTotal,
        levyTotal: totals.headerLevyTotal,
        invoiceTotal: totals.headerGrossTotal,
        amountTendered: totals.amountTendered,
        changeAmount: totals.change,
        fiscalNumberAllocationId: reservation?.allocationId || null,
        immutableAt: finalStatus === SNAPSHOT_STATUS.COMPLETED ? new Date() : null,
        configurationVersionSummary: built.canonical.configuration,
        mappingVersionSummary: {
          siteMappingId: bridge.siteMappingId,
          warehouseMappingId: bridge.warehouseMappingId,
        },
        lines: {
          create: fiscalLines.map((l) => ({
            tenantId,
            businessId,
            sequence: l.lineNumber,
            localSourceLineId: l.sourceLineId,
            localItemId: l.localProductId,
            localServiceId: l.localServiceId,
            description: l.description,
            isProduct: l.isProduct,
            unitOfMeasure: l.unitOfMeasure,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: l.discountAmount,
            netAmount: l.netAmount,
            taxAmount: l.taxAmount,
            levyAmount: l.levyAmount,
            grossAmount: l.grossAmount,
            lineChecksum: l.lineChecksum,
          })),
        },
        payments: {
          create: payment.components.map((p) => ({
            tenantId,
            businessId,
            sequence: p.sequence,
            localPaymentReferenceId: p.localPaymentReferenceId,
            localPaymentMethodId: p.localPaymentMethodId,
            mraPaymentMethodCode: p.mraPaymentMethodCode,
            amount: p.amount,
            amountTendered: p.amountTendered,
            changeAmount: p.changeAmount,
            isCreditComponent: p.isCreditComponent,
            paymentChecksum: createSimpleChecksum(p),
          })),
        },
      },
      include: { lines: true, payments: true },
    });

    if (reservation) {
      await markReservationAssigned({
        reservationId: reservation.id,
        tenantId,
        businessId,
        db: tx,
      });
    }

    if (finalStatus === SNAPSHOT_STATUS.COMPLETED) {
      await tx.mraEisSalesBridge.update({
        where: { id: bridge.id },
        data: {
          futureFiscalSnapshotId: header.id,
          status: BRIDGE_STATUS.FISCAL_SNAPSHOT_CREATED,
          version: { increment: 1 },
          lastEvaluatedAt: new Date(),
        },
      });

      const payload = {
        eventVersion: '1',
        tenantId,
        businessId,
        fiscalSnapshotId: header.id,
        fiscalSnapshotVersion: String(header.version),
        snapshotChecksum: header.snapshotChecksum,
        fiscalNumberAssignmentId: reservation?.id || null,
        environment: bridge.environment,
        correlationId,
        occurredAt: new Date().toISOString(),
      };
      assertNoSecretsPayload(payload);
      await appendEisOutboxEvent({
        tenantId,
        businessId,
        aggregateType: 'MraEisSnapshot',
        aggregateId: header.id,
        eventType: SALES_PAYLOAD_REQUESTED_EVENT,
        eventVersion: '1',
        payload,
        idempotencyKey: `sales-payload-req:${header.id}:v${header.version}`,
        requestId,
        correlationId,
        db: tx,
      });
    }

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorId: actorOrServiceContext?.userId,
      actorType: actorOrServiceContext?.userId ? 'USER' : 'SERVICE',
      action:
        finalStatus === SNAPSHOT_STATUS.COMPLETED
          ? 'FISCAL_SNAPSHOT_COMPLETED'
          : 'FISCAL_SNAPSHOT_NUMBER_PENDING',
      resourceType: 'MraEisSnapshot',
      resourceId: header.id,
      metadata: {
        bridgeId: bridge.id,
        status: finalStatus,
        fiscalNumber: fiscalNumber?.formatted || null,
        isSynthetic: fiscalNumber?.isSynthetic || false,
        createsJournal: false,
        createsStockMovement: false,
        callsMraApi: false,
        mraAccepted: false,
      },
    }, tx).catch(() => {});

    return header;
  });

  return {
    ok: true,
    duplicate: false,
    snapshot: completed,
    readiness,
    fiscalNumber,
    numberPending: finalStatus === SNAPSHOT_STATUS.NUMBER_PENDING,
    phase13OutboxCreated: finalStatus === SNAPSHOT_STATUS.COMPLETED,
    message:
      finalStatus === SNAPSHOT_STATUS.COMPLETED
        ? 'Fiscal snapshot created locally. Not yet submitted to MRA.'
        : 'Fiscal snapshot content built; fiscal-number contract blocked — NUMBER_PENDING.',
    mraSubmitted: false,
    mraAccepted: false,
    qrGenerated: false,
  };
}

function createSimpleChecksum(obj) {
  return canonicalize(obj).checksum;
}

function assertNoSecretsPayload(payload) {
  const text = JSON.stringify(payload ?? {});
  if (
    /"(buyerAuthorizationCode|secretKey|jwt|tac|authorizationHeader|terminalSecret)"\s*:/i.test(text) ||
    /"authorization"\s*:\s*"/i.test(text) ||
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/.test(text)
  ) {
    throw FiscalSnapshotErrors.readiness({
      message: 'Outbox payload must not contain secrets.',
    });
  }
}

/**
 * Integrity verification — rebuilds from stored canonical snapshot, not mutable master data.
 */
export async function verifyFiscalSnapshotIntegrity(snapshotId, { db = prisma } = {}) {
  const snapshot = await db.mraEisSnapshot.findUnique({
    where: { id: snapshotId },
    include: { lines: true, payments: true },
  });
  if (!snapshot) {
    return { status: 'STORAGE_INCOMPLETE', blockers: ['SNAPSHOT_NOT_FOUND'] };
  }
  if (!snapshot.canonicalSnapshot || snapshot.snapshotChecksum === 'PENDING') {
    return { status: 'STORAGE_INCOMPLETE', blockers: ['CANONICAL_MISSING'] };
  }

  const rebuilt = canonicalize(snapshot.canonicalSnapshot, {
    canonicalizationVersion: snapshot.canonicalizationVersion || CANONICALIZATION_VERSION,
  });

  if (rebuilt.checksum !== snapshot.snapshotChecksum) {
    return {
      status: 'SNAPSHOT_CHECKSUM_MISMATCH',
      stored: snapshot.snapshotChecksum,
      calculated: rebuilt.checksum,
      blockers: ['SNAPSHOT_CHECKSUM_MISMATCH'],
    };
  }

  for (const line of snapshot.lines || []) {
    if (!line.lineChecksum) {
      return { status: 'LINE_CHECKSUM_MISMATCH', blockers: ['LINE_CHECKSUM_MISSING'] };
    }
  }

  return {
    status: 'VERIFIED',
    snapshotId,
    checksum: snapshot.snapshotChecksum,
    lineCount: snapshot.lines?.length || 0,
    fiscalNumberAllocationId: snapshot.fiscalNumberAllocationId,
    bridgeRecordId: snapshot.bridgeRecordId,
    mraAccepted: false,
    dependsOnMutableMasterData: false,
  };
}

/**
 * Guard: completed snapshots are immutable via ordinary updates.
 */
export async function assertSnapshotMutable(snapshotId, { db = prisma } = {}) {
  const snap = await db.mraEisSnapshot.findUnique({ where: { id: snapshotId } });
  if (snap?.status === SNAPSHOT_STATUS.COMPLETED || snap?.immutableAt) {
    throw FiscalSnapshotErrors.immutable({ details: { snapshotId } });
  }
  return snap;
}
