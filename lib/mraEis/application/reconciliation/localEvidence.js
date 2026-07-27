/**
 * Phase 15 — authoritative local reconciliation evidence (immutable sources only).
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { verifyFiscalSnapshotIntegrity } from '../fiscalSnapshot/snapshotOrchestrator.js';
import { classifyDispatchCertainty } from './dispatchCertainty.js';
import { ReconciliationErrors } from './reconciliationErrors.js';

function sha256Json(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

export async function loadLocalReconciliationEvidence({
  tenantId,
  businessId,
  transmissionId,
  triggeringAttemptId = null,
  db = prisma,
} = {}) {
  const transmission = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!transmission) {
    throw ReconciliationErrors.localEvidenceInvalid({
      message: 'Transmission not found in tenant/business scope.',
    });
  }

  const attempts = await db.mraEisTransmissionAttempt.findMany({
    where: { transmissionId, tenantId, businessId },
    orderBy: { attemptNumber: 'asc' },
  });

  const attemptId = triggeringAttemptId || transmission.currentAttemptId;
  const triggeringAttempt = attempts.find((a) => a.id === attemptId) || attempts[attempts.length - 1] || null;

  const responses = await db.mraEisResponse.findMany({
    where: { transmissionId, tenantId, businessId },
    orderBy: { receivedAt: 'asc' },
  });

  const snapshot = transmission.snapshotId
    ? await db.mraEisSnapshot.findFirst({
        where: { id: transmission.snapshotId, tenantId, businessId },
      })
    : null;

  let snapshotIntegrity = null;
  if (snapshot) {
    snapshotIntegrity = await verifyFiscalSnapshotIntegrity(snapshot.id, { db });
  }

  const fiscalNumber = snapshot?.canonicalSnapshot?.fiscalNumber?.formatted || null;
  const triggeringResponse =
    responses.find((r) => r.attemptId === triggeringAttempt?.id) || null;

  const dispatch = classifyDispatchCertainty(triggeringAttempt, triggeringResponse);

  const outboxAccepted = await db.mraEisOutbox
    .findMany({
      where: {
        tenantId,
        businessId,
        aggregateId: transmissionId,
        eventType: {
          in: [
            'MRA_EIS_ACCEPTED_RECEIPT_REQUESTED',
            'MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED',
          ],
        },
      },
      take: 20,
    })
    .catch(() => []);

  const receipt = await db.mraEisFiscalReceipt
    .findFirst({
      where: { transmissionId, tenantId, businessId },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => null);

  const evidence = {
    schemaVersion: 'local-reconciliation-evidence-v1',
    tenant: { tenantId },
    business: { businessId },
    terminal: { terminalId: transmission.terminalId },
    Site: { siteMappingId: snapshot?.siteMappingId || null },
    environment: transmission.environment,
    mode: transmission.mode,
    transmission: {
      id: transmission.id,
      status: transmission.status,
      attemptCount: transmission.attemptCount,
      acceptedAt: transmission.acceptedAt,
      validationUrl: transmission.validationUrl,
      latestResponseId: transmission.latestResponseId,
      version: transmission.version,
    },
    snapshot: snapshot
      ? {
          id: snapshot.id,
          status: snapshot.status,
          snapshotChecksum: snapshot.snapshotChecksum,
          fiscalNumberAllocationId: snapshot.fiscalNumberAllocationId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          localDocumentNumber: snapshot.localDocumentNumber,
          integrityStatus: snapshotIntegrity?.status || null,
          sellerTin: snapshot.canonicalSnapshot?.seller?.sellerTin || snapshot.sellerTin,
          currency: snapshot.canonicalSnapshot?.currency?.transactionCurrency || snapshot.currency,
          grossTotal: snapshot.canonicalSnapshot?.totals?.headerGrossTotal || String(snapshot.invoiceTotal),
          taxTotal: snapshot.canonicalSnapshot?.totals?.headerTaxTotal || String(snapshot.taxTotal),
          levyTotal: snapshot.canonicalSnapshot?.totals?.headerLevyTotal || String(snapshot.levyTotal),
          transactionDate: snapshot.transactionDate,
        }
      : null,
    fiscalNumber,
    attempts: attempts.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      outcome: a.outcome,
      httpStatus: a.httpStatus,
      requestChecksum: a.requestChecksum,
      responseChecksum: a.responseChecksum,
      retryClassification: a.retryClassification,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })),
    requestEvidence: attempts.map((a) => ({
      attemptId: a.id,
      requestChecksum: a.requestChecksum,
    })),
    responseEvidence: responses.map((r) => ({
      id: r.id,
      attemptId: r.attemptId,
      responseCategory: r.responseCategory,
      httpStatus: r.httpStatus,
      sourceChecksum: r.sourceChecksum,
      validationUrl: r.validationUrl,
      mraTransactionId: r.sanitizedCanonicalResponse?.mraTransactionId || null,
    })),
    dispatchEvidence: dispatch,
    sequenceEvidence: {
      fiscalNumberAllocationId: snapshot?.fiscalNumberAllocationId || null,
      fiscalNumber,
    },
    downstreamEventEvidence: {
      outboxEvents: (outboxAccepted || []).map((e) => ({
        id: e.id,
        eventType: e.eventType,
        status: e.status,
      })),
    },
    receiptEvidence: receipt
      ? {
          id: receipt.id,
          state: receipt.state,
          fiscalNumber: receipt.fiscalNumber,
          mraTransactionId: receipt.mraTransactionId,
        }
      : null,
    triggeringAttemptId: triggeringAttempt?.id || null,
  };

  const blockers = [];
  if (!snapshot) blockers.push('FISCAL_SNAPSHOT_NOT_FOUND');
  if (snapshotIntegrity && snapshotIntegrity.status !== 'VERIFIED') {
    blockers.push('SNAPSHOT_INTEGRITY_FAILURE');
  }
  if (!fiscalNumber) blockers.push('FISCAL_NUMBER_MISMATCH');
  if (!triggeringAttempt) blockers.push('ATTEMPT_MISSING');

  const acceptedAttempts = attempts.filter((a) => a.outcome === 'ACCEPTED');
  if (acceptedAttempts.length > 1) blockers.push('DUPLICATE_ACCEPTED_ATTEMPT');

  const localEvidenceChecksum = sha256Json(evidence);

  return {
    evidence,
    localEvidenceChecksum,
    blockers,
    valid: blockers.length === 0,
    dispatch,
    transmission,
    snapshot,
    triggeringAttempt,
    responses,
  };
}
