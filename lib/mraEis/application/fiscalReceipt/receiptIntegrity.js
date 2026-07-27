/**
 * Phase 14 — fiscal receipt integrity verification against immutable evidence.
 */

import prisma from '@/lib/prisma.js';
import crypto from 'crypto';
import { readArtifactBytes } from './receiptArtifactStorage.js';
import { decodePngQr } from './qrCodeGenerator.js';

export async function verifyFiscalReceiptIntegrity(fiscalReceiptId, { db = prisma } = {}) {
  const receipt = await db.mraEisFiscalReceipt.findUnique({
    where: { id: fiscalReceiptId },
    include: {
      artifacts: true,
      qrEvidence: true,
    },
  });
  if (!receipt) {
    return { status: 'MANUAL_REVIEW', blockers: ['RECEIPT_NOT_FOUND'] };
  }

  const blockers = [];
  const transmission = await db.mraEisTransmission.findFirst({
    where: {
      id: receipt.transmissionId,
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
    },
  });
  if (!transmission) blockers.push('RESPONSE_REFERENCE_MISMATCH');

  const response = await db.mraEisResponse.findFirst({
    where: {
      id: receipt.responseEvidenceId,
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
    },
  });
  if (!response) blockers.push('RESPONSE_REFERENCE_MISMATCH');

  const snapshot = await db.mraEisSnapshot.findFirst({
    where: {
      id: receipt.fiscalSnapshotId,
      tenantId: receipt.tenantId,
      businessId: receipt.businessId,
    },
  });
  if (!snapshot) blockers.push('SNAPSHOT_REFERENCE_MISMATCH');

  const snapFiscal = snapshot?.canonicalSnapshot?.fiscalNumber?.formatted;
  if (snapFiscal && snapFiscal !== receipt.fiscalNumber) {
    blockers.push('FISCAL_NUMBER_MISMATCH');
  }

  const mraTxn = response?.sanitizedCanonicalResponse?.mraTransactionId;
  if (mraTxn && mraTxn !== receipt.mraTransactionId) {
    blockers.push('RESPONSE_REFERENCE_MISMATCH');
  }

  if (receipt.receiptDataJson && receipt.receiptDataChecksum) {
    const calc = crypto
      .createHash('sha256')
      .update(JSON.stringify(receipt.receiptDataJson))
      .digest('hex');
    if (calc !== receipt.receiptDataChecksum) {
      blockers.push('RECEIPT_DATA_CHECKSUM_MISMATCH');
    }
  }

  for (const qr of receipt.qrEvidence || []) {
    if (!qr.decodeVerified) blockers.push('QR_DECODE_FAILURE');
    if (qr.exactSourceValue && qr.decodedValueChecksum) {
      const expected = crypto
        .createHash('sha256')
        .update(qr.exactSourceValue, 'utf8')
        .digest('hex');
      if (expected !== qr.exactSourceChecksum) {
        blockers.push('QR_SOURCE_MISMATCH');
      }
    }
    if (qr.artifactStorageReference) {
      try {
        const { bytes, checksum } = await readArtifactBytes({
          tenantId: receipt.tenantId,
          storageKey: qr.artifactStorageReference,
        });
        if (checksum !== qr.artifactChecksum) {
          blockers.push('QR_ARTIFACT_MISMATCH');
        } else if (qr.exactSourceValue) {
          const decoded = await decodePngQr(bytes);
          if (!decoded.ok || decoded.value !== qr.exactSourceValue) {
            blockers.push('QR_DECODE_FAILURE');
          }
        }
      } catch {
        blockers.push('STORAGE_OBJECT_MISSING');
      }
    }
  }

  for (const art of receipt.artifacts || []) {
    if (art.originalOrReprint !== 'ORIGINAL') continue;
    try {
      const { checksum } = await readArtifactBytes({
        tenantId: receipt.tenantId,
        storageKey: art.storageKey,
      });
      if (checksum !== art.artifactChecksum) {
        blockers.push('RECEIPT_ARTIFACT_MISMATCH');
      }
      if (art.receiptDataChecksum && art.receiptDataChecksum !== 'pending') {
        if (receipt.receiptDataChecksum && art.receiptDataChecksum !== receipt.receiptDataChecksum) {
          blockers.push('RECEIPT_DATA_CHECKSUM_MISMATCH');
        }
      }
    } catch {
      blockers.push('STORAGE_OBJECT_MISSING');
    }
  }

  if (blockers.length) {
    return {
      status: blockers[0],
      blockers: [...new Set(blockers)],
      fiscalReceiptId,
      transmissionId: receipt.transmissionId,
    };
  }

  return {
    status: 'VERIFIED',
    fiscalReceiptId,
    receiptDataChecksum: receipt.receiptDataChecksum,
    fiscalNumber: receipt.fiscalNumber,
    mraTransactionId: receipt.mraTransactionId,
    artifactCount: receipt.artifacts?.length || 0,
    qrEvidenceCount: receipt.qrEvidence?.length || 0,
  };
}
