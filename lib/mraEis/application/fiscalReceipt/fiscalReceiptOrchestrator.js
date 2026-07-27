/**
 * Phase 14 — Fiscal receipt generation from accepted MRA evidence only.
 * Never calls MRA Sales. Never creates Journal/Stock Movement. Never mutates snapshot/response/number.
 */

import prisma from '@/lib/prisma.js';
import {
  FISCAL_RECEIPT_STATUS,
  FISCAL_RECEIPT_ARTIFACT_TYPE,
  RECEIPT_EIS_STATUS,
  TRANSMISSION_STATUS,
} from '../../domain/operationalEnums.js';
import { evaluateFiscalReceiptGenerationReadiness } from './fiscalReceiptReadiness.js';
import { resolveReceiptContract, RECEIPT_TYPE } from './receiptContractRegistry.js';
import { resolveQrSourceContract } from './qrSourceContractRegistry.js';
import { resolveReceiptTemplate } from './receiptTemplateRegistry.js';
import { resolveQrSource } from './qrSourceResolution.js';
import { generateAndVerifyQr, QR_GENERATOR_VERSION } from './qrCodeGenerator.js';
import { buildImmutableReceiptData } from './receiptDataBuilder.js';
import {
  renderPos80Html,
  renderFiscalHtmlView,
  renderSalesInvoiceA4Pdf,
  evaluatePos58Support,
} from './receiptRenderer.js';
import { storeImmutableArtifact } from './receiptArtifactStorage.js';
import { FiscalReceiptErrors } from './fiscalReceiptErrors.js';

const ACCEPTED_TX = new Set([
  TRANSMISSION_STATUS.ACCEPTED_ONLINE,
  TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
  TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
]);

async function transition(db, receipt, nextState, extra = {}) {
  return db.mraEisFiscalReceipt.update({
    where: { id: receipt.id, version: receipt.version },
    data: {
      previousState: receipt.state,
      state: nextState,
      version: { increment: 1 },
      ...extra,
    },
  });
}

async function persistArtifact(db, {
  tenantId,
  businessId,
  fiscalReceiptId,
  artifactType,
  originalOrReprint,
  reprintSequence,
  receiptContractVersion,
  templateVersion,
  rendererVersion,
  qrEvidenceId,
  storage,
  mimeType,
  receiptDataChecksum,
  pageCount = null,
  paperWidthMm = null,
  generatedBy,
  reason = null,
  reprintReasonCode = null,
  reprintReasonText = null,
}) {
  const existing = await db.mraEisFiscalReceiptArtifact.findFirst({
    where: {
      fiscalReceiptId,
      artifactType,
      originalOrReprint,
      reprintSequence: reprintSequence ?? null,
    },
  });
  if (existing) {
    if (existing.artifactChecksum !== storage.artifactChecksum) {
      throw FiscalReceiptErrors.idempotencyConflict({
        details: { artifactType, reason: 'CHECKSUM_CONFLICT' },
      });
    }
    return existing;
  }

  return db.mraEisFiscalReceiptArtifact.create({
    data: {
      tenantId,
      businessId,
      fiscalReceiptId,
      artifactType,
      originalOrReprint,
      reprintSequence: reprintSequence ?? null,
      reprintReasonCode,
      reprintReasonText,
      receiptContractVersion,
      templateVersion,
      rendererVersion,
      qrEvidenceId,
      storageProvider: storage.storageProvider,
      storageKey: storage.storageKey,
      mimeType,
      byteLength: storage.byteLength,
      pageCount,
      paperWidthMm,
      artifactChecksumAlgorithm: storage.artifactChecksumAlgorithm,
      artifactChecksum: storage.artifactChecksum,
      receiptDataChecksum,
      generatedBy,
      reason,
      immutable: true,
      retentionClass: originalOrReprint === 'ORIGINAL' ? 'FISCAL_ORIGINAL' : 'FISCAL_REPRINT',
    },
  });
}

/**
 * Generate original fiscal receipt for an accepted transmission.
 */
export async function generateFiscalReceiptFromAcceptedTransmission({
  tenantId,
  businessId,
  transmissionId,
  acceptedAttemptId = null,
  responseEvidenceId = null,
  expectedResponseChecksum = null,
  correlationId = null,
  actorOrServiceContext = null,
  workerId = 'phase14-receipt-worker',
  db = prisma,
} = {}) {
  const readiness = await evaluateFiscalReceiptGenerationReadiness({
    tenantId,
    businessId,
    transmissionId,
    acceptedAttemptId,
    responseEvidenceId,
    expectedResponseChecksum,
    actorOrServiceContext,
    db,
  });

  const transmission = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!transmission) throw FiscalReceiptErrors.transmissionNotAccepted();
  if (!ACCEPTED_TX.has(transmission.status)) {
    throw FiscalReceiptErrors.transmissionNotAccepted({
      details: { status: transmission.status },
    });
  }

  const env = transmission.environment || 'SANDBOX';
  const mode = transmission.mode || 'MOCK';
  const contractResult = resolveReceiptContract({ environment: env, mode });
  if (!contractResult.allowsGeneration) {
    throw FiscalReceiptErrors.contractUnavailable({
      details: { decision: contractResult.decision },
    });
  }

  // Idempotent reuse
  const existing = await db.mraEisFiscalReceipt.findFirst({
    where: {
      tenantId,
      businessId,
      transmissionId,
      environment: env,
      receiptContractVersion: contractResult.contract.contractVersion,
    },
    include: { artifacts: true, qrEvidence: true },
  });
  if (
    existing &&
    (existing.state === FISCAL_RECEIPT_STATUS.COMPLETED ||
      existing.state === FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS)
  ) {
    return {
      receipt: existing,
      duplicate: true,
      readiness,
      createsJournal: false,
      createsStockMovement: false,
      mraSalesCalled: false,
    };
  }

  if (!readiness.receiptGenerationAllowed && !readiness.originalReceiptAlreadyExists) {
    throw FiscalReceiptErrors.readiness({
      details: { blockers: readiness.blockers, warnings: readiness.warnings },
      requiredAction: readiness.requiredActions?.[0] || null,
    });
  }

  const attempt = await db.mraEisTransmissionAttempt.findFirst({
    where: {
      id: acceptedAttemptId || transmission.currentAttemptId,
      transmissionId,
      tenantId,
      businessId,
    },
  });
  if (!attempt || attempt.outcome !== 'ACCEPTED') {
    throw FiscalReceiptErrors.attemptMismatch();
  }

  const response = await db.mraEisResponse.findFirst({
    where: {
      id: responseEvidenceId || transmission.latestResponseId,
      transmissionId,
      attemptId: attempt.id,
      tenantId,
      businessId,
    },
  });
  if (!response) throw FiscalReceiptErrors.responseEvidence();
  if (
    expectedResponseChecksum &&
    response.sourceChecksum !== expectedResponseChecksum
  ) {
    throw FiscalReceiptErrors.responseChecksum();
  }

  const snapshot = await db.mraEisSnapshot.findFirst({
    where: { id: transmission.snapshotId, tenantId, businessId },
  });
  if (!snapshot?.canonicalSnapshot) throw FiscalReceiptErrors.snapshotIntegrity();

  const fiscalNumber = snapshot.canonicalSnapshot?.fiscalNumber?.formatted;
  const mraTransactionId = response.sanitizedCanonicalResponse?.mraTransactionId;
  if (!fiscalNumber) throw FiscalReceiptErrors.fiscalNumberMismatch();
  if (!mraTransactionId) throw FiscalReceiptErrors.responseEvidence();

  let receipt = existing;
  if (!receipt) {
    try {
      receipt = await db.mraEisFiscalReceipt.create({
        data: {
          tenantId,
          businessId,
          branchId: snapshot.branchId,
          terminalId: snapshot.terminalId,
          transmissionId,
          acceptedAttemptId: attempt.id,
          responseEvidenceId: response.id,
          fiscalSnapshotId: snapshot.id,
          fiscalNumberAssignmentId: snapshot.fiscalNumberAllocationId,
          environment: env,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
          localTransactionNumber: snapshot.localDocumentNumber,
          fiscalNumber,
          mraTransactionId,
          validationUrl: response.validationUrl,
          state: FISCAL_RECEIPT_STATUS.CREATED,
          receiptContractVersion: contractResult.contract.contractVersion,
          qrSourceContractVersion: contractResult.contract.QRSourceContractVersion,
          safeStatusSummary: 'Receipt generation started',
          correlationId,
          claimOwner: workerId,
          claimExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } catch (err) {
      // Unique race — reload
      receipt = await db.mraEisFiscalReceipt.findFirst({
        where: {
          tenantId,
          businessId,
          transmissionId,
          environment: env,
          receiptContractVersion: contractResult.contract.contractVersion,
        },
        include: { artifacts: true, qrEvidence: true },
      });
      if (
        receipt &&
        (receipt.state === FISCAL_RECEIPT_STATUS.COMPLETED ||
          receipt.state === FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS)
      ) {
        return {
          receipt,
          duplicate: true,
          readiness,
          createsJournal: false,
          createsStockMovement: false,
          mraSalesCalled: false,
        };
      }
      if (!receipt) throw err;
    }
  }

  await db.mraEisReceiptProjection.updateMany({
    where: { snapshotId: snapshot.id, tenantId, businessId },
    data: {
      eisStatus: RECEIPT_EIS_STATUS.EIS_RECEIPT_GENERATING,
      transmissionId,
      projectionVersion: { increment: 1 },
    },
  }).catch(() => {});

  try {
    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.VALIDATING_READINESS);
    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.BUILDING_RECEIPT_DATA);

    const qrContract = resolveQrSourceContract({ environment: env, mode });
    if (!qrContract.allowsQrGeneration) {
      receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.BLOCKED, {
        safeStatusSummary: 'QR contract blocked',
      });
      throw FiscalReceiptErrors.qrContractUnverified();
    }

    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.QR_SOURCE_VALIDATING);
    const qrResolved = resolveQrSource({
      responseEvidence: response,
      qrSourceContract: qrContract.contract,
      environment: env,
    });
    if (!qrResolved.resolved) {
      receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.QR_INVALID, {
        safeStatusSummary: qrResolved.blockers.join(','),
      });
      await db.mraEisReceiptProjection.updateMany({
        where: { snapshotId: snapshot.id, tenantId, businessId },
        data: {
          eisStatus: RECEIPT_EIS_STATUS.EIS_RECEIPT_QR_INVALID,
          projectionVersion: { increment: 1 },
        },
      }).catch(() => {});
      throw FiscalReceiptErrors.qrSourceMissing({ details: { blockers: qrResolved.blockers } });
    }

    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.QR_GENERATING);
    const qr = await generateAndVerifyQr({
      exactSourceValue: qrResolved.exactSourceValue,
      errorCorrectionLevel: qrContract.contract.errorCorrectionLevel || 'M',
      quietZoneModules: qrContract.contract.quietZone || 4,
      minimumPixelSize: qrContract.contract.minimumPixelSize || 160,
    });

    let qrEvidence = await db.mraEisQrEvidence.findFirst({
      where: {
        fiscalReceiptId: receipt.id,
        qrSourceContractVersion: qrContract.contract.contractVersion,
        exactSourceChecksum: qr.exactSourceChecksum,
        generatorVersion: QR_GENERATOR_VERSION,
      },
    });

    if (!qrEvidence) {
      const qrPngStorage = await storeImmutableArtifact({
        tenantId,
        businessId,
        fiscalReceiptId: receipt.id,
        artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.QR_PNG,
        bytes: qr.pngBuffer,
        mimeType: 'image/png',
        extension: 'png',
      });
      const qrSvgStorage = await storeImmutableArtifact({
        tenantId,
        businessId,
        fiscalReceiptId: receipt.id,
        artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.QR_SVG,
        bytes: qr.svgString,
        mimeType: 'image/svg+xml',
        extension: 'svg',
      });

      qrEvidence = await db.mraEisQrEvidence.create({
        data: {
          tenantId,
          businessId,
          fiscalReceiptId: receipt.id,
          responseEvidenceId: response.id,
          environment: env,
          qrSourceContractVersion: qrContract.contract.contractVersion,
          sourceType: qrResolved.sourceType,
          exactSourceChecksum: qr.exactSourceChecksum,
          normalizedSourceChecksum: qr.exactSourceChecksum,
          sourceLength: qrResolved.exactSourceValue.length,
          sourceField: qrResolved.sourceResponseField,
          exactSourceValue: qrResolved.exactSourceValue,
          validationUrl: qrResolved.validationUrl,
          generatorVersion: QR_GENERATOR_VERSION,
          outputFormat: 'PNG',
          dimensions: qr.dimensions,
          errorCorrectionLevel: qr.errorCorrectionLevel,
          quietZone: qr.quietZone,
          artifactStorageReference: qrPngStorage.storageKey,
          artifactChecksum: qr.pngChecksum,
          decodeVerified: true,
          decodedValueChecksum: qr.decodedValueChecksum,
          verifiedAt: new Date(),
          immutable: true,
        },
      });

      await persistArtifact(db, {
        tenantId,
        businessId,
        fiscalReceiptId: receipt.id,
        artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.QR_PNG,
        originalOrReprint: 'ORIGINAL',
        reprintSequence: null,
        receiptContractVersion: contractResult.contract.contractVersion,
        templateVersion: 'n/a',
        rendererVersion: QR_GENERATOR_VERSION,
        qrEvidenceId: qrEvidence.id,
        storage: qrPngStorage,
        mimeType: 'image/png',
        receiptDataChecksum: 'pending',
        generatedBy: workerId,
      });
      await persistArtifact(db, {
        tenantId,
        businessId,
        fiscalReceiptId: receipt.id,
        artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.QR_SVG,
        originalOrReprint: 'ORIGINAL',
        reprintSequence: null,
        receiptContractVersion: contractResult.contract.contractVersion,
        templateVersion: 'n/a',
        rendererVersion: QR_GENERATOR_VERSION,
        qrEvidenceId: qrEvidence.id,
        storage: qrSvgStorage,
        mimeType: 'image/svg+xml',
        receiptDataChecksum: 'pending',
        generatedBy: workerId,
      });
    }

    const tpl80 = resolveReceiptTemplate({
      receiptType: RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
      environment: env,
    });
    const tplA4 = resolveReceiptTemplate({
      receiptType: RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4,
      environment: env,
    });
    if (!tpl80.resolved || !tplA4.resolved) {
      throw FiscalReceiptErrors.templateUnavailable();
    }

    const { receiptData, receiptDataChecksum } = buildImmutableReceiptData({
      identity: {
        fiscalReceiptId: receipt.id,
        transmissionId,
        acceptedAttemptId: attempt.id,
        responseEvidenceId: response.id,
        fiscalSnapshotId: snapshot.id,
        fiscalNumberAssignmentId: snapshot.fiscalNumberAllocationId,
        fiscalNumber,
        mraTransactionId,
        localTransactionNumber: snapshot.localDocumentNumber,
        terminalId: snapshot.terminalId,
        sourceType: snapshot.sourceType,
        snapshotChecksum: snapshot.snapshotChecksum,
        mode,
      },
      environment: env,
      originalOrReprint: 'ORIGINAL',
      canonicalSnapshot: snapshot.canonicalSnapshot,
      responseEvidence: response,
      qrResolution: qrResolved,
      receiptContract: contractResult.contract,
      template: tpl80.template,
      qrEvidenceMeta: qr,
    });

    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.RENDERING, {
      receiptDataJson: receiptData,
      receiptDataChecksum,
      validationUrl: qrResolved.validationUrl,
      receiptClassification: receiptData.receiptClassification,
    });

    const pos58 = evaluatePos58Support();
    const warnings = [...readiness.warnings];
    if (!pos58.supported) warnings.push('THERMAL_WIDTH_NOT_SUPPORTED');

    receipt = await transition(db, receipt, FISCAL_RECEIPT_STATUS.STORING);

    const qrDataUrl = `data:image/png;base64,${qr.pngBuffer.toString('base64')}`;
    const html80 = renderPos80Html({
      receiptData,
      qrPngDataUrl: qrDataUrl,
      paperWidthMm: 80,
    });
    const htmlView = renderFiscalHtmlView({ receiptData, qrPngDataUrl: qrDataUrl });
    const pdf = renderSalesInvoiceA4Pdf({ receiptData, qrPngBuffer: qr.pngBuffer });
    const evidenceJson = JSON.stringify({
      schemaVersion: 'fiscal-receipt-evidence-v1',
      receiptDataChecksum,
      qrSourceChecksum: qr.exactSourceChecksum,
      responseChecksum: response.sourceChecksum,
      snapshotChecksum: snapshot.snapshotChecksum,
      fiscalNumber,
      mraTransactionId,
    });

    const stored80 = await storeImmutableArtifact({
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.POS_80MM_HTML,
      bytes: html80.html,
      mimeType: 'text/html; charset=utf-8',
      extension: 'html',
    });
    const storedHtml = await storeImmutableArtifact({
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.HTML,
      bytes: htmlView.html,
      mimeType: 'text/html; charset=utf-8',
      extension: 'view.html',
    });
    const storedPdf = await storeImmutableArtifact({
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.SALES_INVOICE_A4_PDF,
      bytes: pdf.buffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
    });
    const storedEvidence = await storeImmutableArtifact({
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.EVIDENCE_JSON,
      bytes: evidenceJson,
      mimeType: 'application/json',
      extension: 'json',
    });

    const art80 = await persistArtifact(db, {
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.POS_80MM_HTML,
      originalOrReprint: 'ORIGINAL',
      reprintSequence: null,
      receiptContractVersion: contractResult.contract.contractVersion,
      templateVersion: tpl80.template.templateVersion,
      rendererVersion: html80.rendererVersion,
      qrEvidenceId: qrEvidence.id,
      storage: stored80,
      mimeType: 'text/html; charset=utf-8',
      receiptDataChecksum,
      paperWidthMm: 80,
      generatedBy: workerId,
    });
    await persistArtifact(db, {
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.HTML,
      originalOrReprint: 'ORIGINAL',
      reprintSequence: null,
      receiptContractVersion: contractResult.contract.contractVersion,
      templateVersion: tpl80.template.templateVersion,
      rendererVersion: htmlView.rendererVersion,
      qrEvidenceId: qrEvidence.id,
      storage: storedHtml,
      mimeType: 'text/html; charset=utf-8',
      receiptDataChecksum,
      generatedBy: workerId,
    });
    await persistArtifact(db, {
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.SALES_INVOICE_A4_PDF,
      originalOrReprint: 'ORIGINAL',
      reprintSequence: null,
      receiptContractVersion: contractResult.contract.contractVersion,
      templateVersion: tplA4.template.templateVersion,
      rendererVersion: pdf.rendererVersion,
      qrEvidenceId: qrEvidence.id,
      storage: storedPdf,
      mimeType: 'application/pdf',
      receiptDataChecksum,
      pageCount: pdf.pageCount,
      generatedBy: workerId,
    });
    await persistArtifact(db, {
      tenantId,
      businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.EVIDENCE_JSON,
      originalOrReprint: 'ORIGINAL',
      reprintSequence: null,
      receiptContractVersion: contractResult.contract.contractVersion,
      templateVersion: 'n/a',
      rendererVersion: 'phase14-evidence-v1',
      qrEvidenceId: qrEvidence.id,
      storage: storedEvidence,
      mimeType: 'application/json',
      receiptDataChecksum,
      generatedBy: workerId,
    });

    const finalState =
      warnings.length > 0
        ? FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS
        : FISCAL_RECEIPT_STATUS.COMPLETED;

    receipt = await transition(db, receipt, finalState, {
      originalArtifactId: art80.id,
      originalGeneratedAt: new Date(),
      safeStatusSummary:
        finalState === FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS
          ? `Completed with warnings: ${warnings.join(',')}`
          : 'Fiscal receipt ready',
      claimOwner: null,
      claimExpiresAt: null,
    });

    const eisStatus =
      finalState === FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS
        ? RECEIPT_EIS_STATUS.EIS_RECEIPT_READY_WITH_WARNINGS
        : RECEIPT_EIS_STATUS.EIS_RECEIPT_READY;

    await db.mraEisReceiptProjection.updateMany({
      where: { snapshotId: snapshot.id, tenantId, businessId },
      data: {
        eisStatus,
        validationUrl: qrResolved.validationUrl,
        qrContentChecksum: qr.exactSourceChecksum,
        qrAssetReference: qrEvidence.artifactStorageReference,
        fiscalNumber,
        acceptedAt: transmission.acceptedAt || new Date(),
        projectionVersion: { increment: 1 },
      },
    }).catch(() => {});

    return {
      receipt,
      qrEvidence,
      readiness,
      warnings,
      duplicate: false,
      createsJournal: false,
      createsStockMovement: false,
      mraSalesCalled: false,
      snapshotMutated: false,
      responseMutated: false,
      fiscalNumberMutated: false,
    };
  } catch (err) {
    const code = err?.code || 'RENDER_FAILED';
    let state = FISCAL_RECEIPT_STATUS.RENDER_FAILED;
    let eisStatus = RECEIPT_EIS_STATUS.EIS_RECEIPT_RENDER_FAILED;
    if (code.includes('QR_') || code.includes('VALIDATION_URL')) {
      state = FISCAL_RECEIPT_STATUS.QR_INVALID;
      eisStatus = RECEIPT_EIS_STATUS.EIS_RECEIPT_QR_INVALID;
    } else if (code.includes('STORAGE')) {
      state = FISCAL_RECEIPT_STATUS.STORAGE_FAILED;
      eisStatus = RECEIPT_EIS_STATUS.EIS_RECEIPT_STORAGE_FAILED;
    } else if (code.includes('MANUAL_REVIEW') || code.includes('CHECKSUM') || code.includes('INTEGRITY')) {
      state = FISCAL_RECEIPT_STATUS.MANUAL_REVIEW;
      eisStatus = RECEIPT_EIS_STATUS.EIS_RECEIPT_MANUAL_REVIEW;
    }

    if (receipt?.id) {
      await db.mraEisFiscalReceipt
        .update({
          where: { id: receipt.id },
          data: {
            previousState: receipt.state,
            state,
            safeStatusSummary: String(err.message || code).slice(0, 240),
            version: { increment: 1 },
            claimOwner: null,
            claimExpiresAt: null,
          },
        })
        .catch(() => {});
    }

    await db.mraEisReceiptProjection
      .updateMany({
        where: { snapshotId: transmission.snapshotId, tenantId, businessId },
        data: { eisStatus, projectionVersion: { increment: 1 } },
      })
      .catch(() => {});

    // Acceptance is never removed
    throw err;
  }
}
