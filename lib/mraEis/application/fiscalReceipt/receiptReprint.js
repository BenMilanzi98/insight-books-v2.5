/**
 * Phase 14 — controlled reprint. Same fiscal content/QR; never a new MRA submission.
 */

import prisma from '@/lib/prisma.js';
import {
  FISCAL_RECEIPT_STATUS,
  FISCAL_RECEIPT_ARTIFACT_TYPE,
} from '../../domain/operationalEnums.js';
import { FiscalReceiptErrors } from './fiscalReceiptErrors.js';
import { verifyFiscalReceiptIntegrity } from './receiptIntegrity.js';
import { resolveReceiptTemplate } from './receiptTemplateRegistry.js';
import { RECEIPT_TYPE } from './receiptContractRegistry.js';
import { renderPos80Html, renderSalesInvoiceA4Pdf } from './receiptRenderer.js';
import { storeImmutableArtifact, readArtifactBytes } from './receiptArtifactStorage.js';
import { resolveReceiptContract } from './receiptContractRegistry.js';

const REPRINT_REASONS = new Set([
  'CUSTOMER_REQUEST',
  'PRINTER_FAILURE',
  'EMAIL_DELIVERY_FAILURE',
  'LOST_RECEIPT',
  'AUDIT_REQUEST',
  'INTERNAL_SUPPORT',
  'LEGAL_REQUEST',
  'OTHER_WITH_REASON',
]);

export async function requestFiscalReceiptReprint({
  fiscalReceiptId,
  receiptType = RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
  reasonCode,
  reasonText = null,
  actorContext = null,
  idempotencyKey = null,
  db = prisma,
} = {}) {
  if (!REPRINT_REASONS.has(reasonCode)) {
    throw FiscalReceiptErrors.reprint({ message: 'Invalid reprint reason code' });
  }

  const receipt = await db.mraEisFiscalReceipt.findUnique({
    where: { id: fiscalReceiptId },
    include: { qrEvidence: true },
  });
  if (!receipt) throw FiscalReceiptErrors.reprint({ message: 'Receipt not found' });

  if (
    receipt.state !== FISCAL_RECEIPT_STATUS.COMPLETED &&
    receipt.state !== FISCAL_RECEIPT_STATUS.COMPLETED_WITH_WARNINGS
  ) {
    throw FiscalReceiptErrors.state({
      message: 'Only completed receipts may be reprinted',
    });
  }

  if (!receipt.receiptDataJson || !receipt.receiptDataChecksum) {
    throw FiscalReceiptErrors.immutable({ message: 'Receipt data missing' });
  }

  const integrity = await verifyFiscalReceiptIntegrity(fiscalReceiptId, { db });
  if (integrity.status !== 'VERIFIED') {
    throw FiscalReceiptErrors.integrity({ details: integrity });
  }

  // Atomic reprint sequence
  const updated = await db.mraEisFiscalReceipt.update({
    where: { id: receipt.id, version: receipt.version },
    data: {
      latestReprintSequence: { increment: 1 },
      version: { increment: 1 },
    },
  });
  const reprintSequence = updated.latestReprintSequence;

  if (idempotencyKey) {
    const prior = await db.mraEisFiscalReceiptArtifact.findFirst({
      where: {
        fiscalReceiptId,
        originalOrReprint: 'REPRINT',
        reason: idempotencyKey,
        artifactType:
          receiptType === RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4
            ? FISCAL_RECEIPT_ARTIFACT_TYPE.SALES_INVOICE_A4_PDF
            : FISCAL_RECEIPT_ARTIFACT_TYPE.POS_80MM_HTML,
      },
    });
    if (prior) {
      return {
        reprintSequence: prior.reprintSequence,
        artifact: prior,
        duplicate: true,
        mraSalesCalled: false,
        fiscalNumber: receipt.fiscalNumber,
        mraTransactionId: receipt.mraTransactionId,
      };
    }
  }

  const qr = receipt.qrEvidence?.[0];
  let qrPngBuffer = null;
  let qrDataUrl = null;
  if (qr?.artifactStorageReference) {
    const { bytes } = await readArtifactBytes({
      tenantId: receipt.tenantId,
      storageKey: qr.artifactStorageReference,
    });
    qrPngBuffer = bytes;
    qrDataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  }

  const contractResult = resolveReceiptContract({
    environment: receipt.environment,
    mode: receipt.environment === 'PRODUCTION' ? 'PRODUCTION' : 'MOCK',
  });

  // Rebuild reprint-labelled data from stored immutable JSON + same checksum identity
  const baseData = {
    ...receipt.receiptDataJson,
    originalOrReprint: 'REPRINT',
    reprintSequence,
    footer: {
      ...(receipt.receiptDataJson.footer || {}),
      originalOrReprintWording:
        contractResult.contract.reprintWording || 'REPRINT / COPY — NOT A NEW SALE',
    },
  };
  // Keep same receiptDataChecksum reference to original fiscal content
  // Reprint artifact checksum differs; fiscal content checksum stays original.

  const tpl = resolveReceiptTemplate({
    receiptType,
    environment: receipt.environment,
  });
  if (!tpl.resolved) throw FiscalReceiptErrors.templateUnavailable();

  let storage;
  let artifactType;
  let rendererVersion;
  let mimeType;
  let pageCount = null;
  let paperWidthMm = null;

  if (receiptType === RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4) {
    const pdf = renderSalesInvoiceA4Pdf({
      receiptData: baseData,
      qrPngBuffer,
    });
    storage = await storeImmutableArtifact({
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.SALES_INVOICE_A4_PDF,
      originalOrReprint: 'REPRINT',
      reprintSequence,
      bytes: pdf.buffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
    });
    artifactType = FISCAL_RECEIPT_ARTIFACT_TYPE.SALES_INVOICE_A4_PDF;
    rendererVersion = pdf.rendererVersion;
    mimeType = 'application/pdf';
    pageCount = pdf.pageCount;
  } else {
    const html = renderPos80Html({
      receiptData: baseData,
      qrPngDataUrl: qrDataUrl,
      paperWidthMm: 80,
    });
    storage = await storeImmutableArtifact({
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
      fiscalReceiptId: receipt.id,
      artifactType: FISCAL_RECEIPT_ARTIFACT_TYPE.POS_80MM_HTML,
      originalOrReprint: 'REPRINT',
      reprintSequence,
      bytes: html.html,
      mimeType: 'text/html; charset=utf-8',
      extension: 'html',
    });
    artifactType = FISCAL_RECEIPT_ARTIFACT_TYPE.POS_80MM_HTML;
    rendererVersion = html.rendererVersion;
    mimeType = 'text/html; charset=utf-8';
    paperWidthMm = 80;
  }

  const artifact = await db.mraEisFiscalReceiptArtifact.create({
    data: {
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
      fiscalReceiptId: receipt.id,
      artifactType,
      originalOrReprint: 'REPRINT',
      reprintSequence,
      reprintReasonCode: reasonCode,
      reprintReasonText: reasonText,
      receiptContractVersion: receipt.receiptContractVersion,
      templateVersion: tpl.template.templateVersion,
      rendererVersion,
      qrEvidenceId: qr?.id || null,
      storageProvider: storage.storageProvider,
      storageKey: storage.storageKey,
      mimeType,
      byteLength: storage.byteLength,
      pageCount,
      paperWidthMm,
      artifactChecksumAlgorithm: storage.artifactChecksumAlgorithm,
      artifactChecksum: storage.artifactChecksum,
      receiptDataChecksum: receipt.receiptDataChecksum,
      generatedBy: actorContext?.userId || actorContext?.serviceId || 'reprint',
      reason: idempotencyKey || reasonCode,
      immutable: true,
      retentionClass: 'FISCAL_REPRINT',
    },
  });

  return {
    reprintSequence,
    artifact,
    duplicate: false,
    mraSalesCalled: false,
    createsJournal: false,
    createsStockMovement: false,
    fiscalNumber: receipt.fiscalNumber,
    mraTransactionId: receipt.mraTransactionId,
    qrSourceChecksum: qr?.exactSourceChecksum || null,
    originalReceiptDataChecksum: receipt.receiptDataChecksum,
    legalReplacement: false,
  };
}
