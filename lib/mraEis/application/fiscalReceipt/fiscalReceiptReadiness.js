/**
 * Phase 14 — server-authoritative fiscal receipt generation readiness.
 */

import prisma from '@/lib/prisma.js';
import { TRANSMISSION_STATUS, SNAPSHOT_STATUS } from '../../domain/operationalEnums.js';
import { verifyFiscalSnapshotIntegrity } from '../fiscalSnapshot/snapshotOrchestrator.js';
import { resolveReceiptContract, RECEIPT_TYPE } from './receiptContractRegistry.js';
import { resolveQrSourceContract } from './qrSourceContractRegistry.js';
import { resolveReceiptTemplate } from './receiptTemplateRegistry.js';
import { resolveQrSource } from './qrSourceResolution.js';
import { validateMraValidationUrl } from './validationUrlSecurity.js';

const ACCEPTED_TX = new Set([
  TRANSMISSION_STATUS.ACCEPTED_ONLINE,
  TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
  TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
]);

export async function evaluateFiscalReceiptGenerationReadiness({
  tenantId,
  businessId,
  transmissionId,
  acceptedAttemptId = null,
  responseEvidenceId = null,
  expectedResponseChecksum = null,
  environment = null,
  receiptTypes = null,
  actorOrServiceContext = null,
  db = prisma,
} = {}) {
  const blockers = [];
  const warnings = [];
  const requiredActions = [];
  const evaluatedAt = new Date().toISOString();

  const result = {
    transmissionExists: false,
    transmissionOwnershipValid: false,
    transmissionAccepted: false,
    acceptedAttemptExists: false,
    acceptedAttemptMatches: false,
    responseEvidenceExists: false,
    responseEvidenceMatches: false,
    responseSchemaValid: false,
    responseChecksumMatches: false,
    mraTransactionIdAvailable: false,
    fiscalSnapshotExists: false,
    fiscalSnapshotCompleted: false,
    fiscalSnapshotIntegrityVerified: false,
    fiscalNumberVerified: false,
    receiptContractAvailable: false,
    receiptTemplateAvailable: false,
    QRSourceContractAvailable: false,
    QRSourceAvailable: false,
    validationUrlValid: false,
    QRPayloadValid: false,
    sellerDataComplete: false,
    buyerDataComplete: false,
    linesComplete: false,
    taxSummaryComplete: false,
    levySummaryComplete: false,
    paymentDataComplete: false,
    totalsReconciled: false,
    originalReceiptAlreadyExists: false,
    receiptGenerationAllowed: false,
    blockers,
    warnings,
    requiredActions,
    readinessVersion: 'phase14-receipt-readiness-v1',
    evaluatedAt,
    actorOrServiceContext: actorOrServiceContext?.serviceId || actorOrServiceContext?.userId || null,
  };

  if (!tenantId || !businessId || !transmissionId) {
    blockers.push('TRANSMISSION_NOT_FOUND');
    return result;
  }

  const transmission = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!transmission) {
    blockers.push('TRANSMISSION_NOT_FOUND');
    return result;
  }
  result.transmissionExists = true;
  result.transmissionOwnershipValid = true;

  const env = environment || transmission.environment || 'SANDBOX';
  const mode = transmission.mode || 'MOCK';

  if (ACCEPTED_TX.has(transmission.status)) {
    result.transmissionAccepted = true;
  } else {
    blockers.push('TRANSMISSION_NOT_ACCEPTED');
  }

  const attemptId = acceptedAttemptId || transmission.currentAttemptId;
  const attempt = attemptId
    ? await db.mraEisTransmissionAttempt.findFirst({
        where: { id: attemptId, transmissionId, tenantId, businessId },
      })
    : null;

  if (!attempt) {
    blockers.push('ACCEPTED_ATTEMPT_NOT_FOUND');
  } else {
    result.acceptedAttemptExists = true;
    result.acceptedAttemptMatches = attempt.outcome === 'ACCEPTED';
    if (!result.acceptedAttemptMatches) blockers.push('ACCEPTED_ATTEMPT_NOT_FOUND');
  }

  const responseId = responseEvidenceId || transmission.latestResponseId;
  const response = responseId
    ? await db.mraEisResponse.findFirst({
        where: { id: responseId, transmissionId, tenantId, businessId },
      })
    : null;

  if (!response) {
    blockers.push('RESPONSE_EVIDENCE_NOT_FOUND');
  } else {
    result.responseEvidenceExists = true;
    result.responseEvidenceMatches = !attempt || response.attemptId === attempt.id;
    if (!result.responseEvidenceMatches) blockers.push('RESPONSE_EVIDENCE_NOT_FOUND');

    const acceptedCategories = new Set([
      'ACCEPTED',
      'ACCEPTED_WITH_CONFIGURATION_REFRESH',
      'ACCEPTED_WITH_TERMINAL_BLOCK',
    ]);
    // HTTP 200 alone is never acceptance — require application outcome category
    result.responseSchemaValid = acceptedCategories.has(response.responseCategory);
    if (!result.responseSchemaValid) blockers.push('RESPONSE_SCHEMA_INVALID');

    if (expectedResponseChecksum) {
      result.responseChecksumMatches = response.sourceChecksum === expectedResponseChecksum;
      if (!result.responseChecksumMatches) blockers.push('RESPONSE_CHECKSUM_MISMATCH');
    } else {
      result.responseChecksumMatches = Boolean(response.sourceChecksum);
    }

    const mraTxn =
      response.sanitizedCanonicalResponse?.mraTransactionId ||
      transmission.mraApplicationStatus /* not txn */ ||
      null;
    const mraTransactionId = response.sanitizedCanonicalResponse?.mraTransactionId || null;
    result.mraTransactionIdAvailable = Boolean(mraTransactionId);
    if (!result.mraTransactionIdAvailable) blockers.push('MRA_TRANSACTION_ID_MISSING');
    void mraTxn;
  }

  const snapshot = transmission.snapshotId
    ? await db.mraEisSnapshot.findFirst({
        where: { id: transmission.snapshotId, tenantId, businessId },
      })
    : null;

  if (!snapshot) {
    blockers.push('FISCAL_SNAPSHOT_NOT_FOUND');
  } else {
    result.fiscalSnapshotExists = true;
    result.fiscalSnapshotCompleted =
      snapshot.status === SNAPSHOT_STATUS.COMPLETED || Boolean(snapshot.immutableAt);
    if (!result.fiscalSnapshotCompleted) blockers.push('FISCAL_SNAPSHOT_NOT_FOUND');

    const integrity = await verifyFiscalSnapshotIntegrity(snapshot.id, { db });
    result.fiscalSnapshotIntegrityVerified = integrity.status === 'VERIFIED';
    if (!result.fiscalSnapshotIntegrityVerified) {
      blockers.push('FISCAL_SNAPSHOT_INTEGRITY_FAILURE');
    }

    const fiscalNumber = snapshot.canonicalSnapshot?.fiscalNumber?.formatted || null;
    result.fiscalNumberVerified = Boolean(fiscalNumber && snapshot.fiscalNumberAllocationId);
    if (!result.fiscalNumberVerified) blockers.push('FISCAL_NUMBER_MISMATCH');

    const canon = snapshot.canonicalSnapshot || {};
    result.sellerDataComplete = Boolean(canon.seller?.sellerTin || canon.seller?.legalName);
    result.buyerDataComplete = true; // anonymous B2C allowed
    result.linesComplete = Array.isArray(canon.lines) && canon.lines.length > 0;
    result.taxSummaryComplete = Array.isArray(canon.taxSummary);
    result.levySummaryComplete = Array.isArray(canon.levySummary);
    result.paymentDataComplete = Boolean(canon.payment?.classification || canon.payment?.totalPaymentAmount);
    result.totalsReconciled = Boolean(canon.totals?.headerGrossTotal);

    if (!result.sellerDataComplete) blockers.push('REQUIRED_SELLER_FIELD_MISSING');
    if (!result.linesComplete) blockers.push('REQUIRED_RECEIPT_FIELD_MISSING');
    if (!result.totalsReconciled) blockers.push('TOTALS_MISMATCH');
  }

  const contractResult = resolveReceiptContract({ environment: env, mode });
  result.receiptContractAvailable = contractResult.allowsGeneration;
  if (!result.receiptContractAvailable) {
    blockers.push('RECEIPT_CONTRACT_UNAVAILABLE');
    requiredActions.push('Await verified receipt contract / use MOCK only');
  }

  const types =
    receiptTypes ||
    [RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM, RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4];
  let templatesOk = true;
  for (const t of types) {
    const tpl = resolveReceiptTemplate({ receiptType: t, environment: env });
    if (!tpl.resolved) {
      if (t === RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM) {
        warnings.push('THERMAL_WIDTH_NOT_SUPPORTED');
      } else {
        templatesOk = false;
        blockers.push('RECEIPT_TEMPLATE_UNAVAILABLE');
      }
    }
  }
  result.receiptTemplateAvailable = templatesOk;

  const qrContractResult = resolveQrSourceContract({ environment: env, mode });
  result.QRSourceContractAvailable = qrContractResult.allowsQrGeneration;
  if (!result.QRSourceContractAvailable) {
    blockers.push('QR_CONTRACT_UNVERIFIED');
  }

  if (response && qrContractResult.allowsQrGeneration) {
    const qrResolved = resolveQrSource({
      responseEvidence: response,
      qrSourceContract: qrContractResult.contract,
      environment: env,
    });
    result.QRSourceAvailable = qrResolved.resolved;
    result.QRPayloadValid = qrResolved.resolved;
    if (qrResolved.resolved && qrResolved.validationUrl) {
      const urlCheck = validateMraValidationUrl(
        qrResolved.validationUrl,
        qrContractResult.contract.URLPolicy || {}
      );
      result.validationUrlValid = urlCheck.valid;
      if (!urlCheck.valid) blockers.push('VALIDATION_URL_UNTRUSTED');
    } else if (qrResolved.resolved) {
      result.validationUrlValid = true;
    }
    if (!qrResolved.resolved) {
      blockers.push(...(qrResolved.blockers.length ? qrResolved.blockers : ['QR_SOURCE_MISSING']));
    }
    warnings.push(...qrResolved.warnings);
  }

  const existing = await db.mraEisFiscalReceipt.findFirst({
    where: {
      tenantId,
      businessId,
      transmissionId,
      environment: env,
      receiptContractVersion: contractResult.contract.contractVersion,
    },
  });
  if (existing?.state === 'COMPLETED' || existing?.state === 'COMPLETED_WITH_WARNINGS') {
    result.originalReceiptAlreadyExists = true;
    // Idempotent reuse is allowed — not a blocker for generation orchestration
    warnings.push('ORIGINAL_RECEIPT_ALREADY_EXISTS');
  }

  if (String(env).toUpperCase() !== 'PRODUCTION' || mode === 'MOCK') {
    warnings.push('SANDBOX_RECEIPT');
  }

  // Deduplicate blockers
  result.blockers = [...new Set(blockers)];
  result.warnings = [...new Set(warnings)];

  // Allow when original already exists (idempotent) OR when no hard blockers remain
  const hardBlockers = result.blockers.filter((b) => b !== 'ORIGINAL_RECEIPT_CONFLICT');
  result.receiptGenerationAllowed =
    result.originalReceiptAlreadyExists ||
    (result.transmissionAccepted &&
      result.acceptedAttemptMatches &&
      result.responseEvidenceExists &&
      result.fiscalSnapshotIntegrityVerified &&
      result.fiscalNumberVerified &&
      result.receiptContractAvailable &&
      result.receiptTemplateAvailable &&
      result.QRSourceAvailable &&
      hardBlockers.length === 0);

  if (!result.receiptGenerationAllowed && !result.originalReceiptAlreadyExists) {
    requiredActions.push('Resolve readiness blockers before receipt generation');
  }

  return result;
}
