import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  evaluateFiscalReceiptGenerationReadiness,
  generateFiscalReceiptFromAcceptedTransmission,
  processAcceptedReceiptOutboxBatch,
  verifyFiscalReceiptIntegrity,
  requestFiscalReceiptReprint,
  getReceiptContractDecision,
  getQrSourceContractDecision,
  readArtifactBytes,
  RECEIPT_TYPE,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

function sanitizeReceipt(r) {
  if (!r) return null;
  return {
    id: r.id,
    transmissionId: r.transmissionId,
    fiscalSnapshotId: r.fiscalSnapshotId,
    fiscalNumber: r.fiscalNumber,
    mraTransactionId: r.mraTransactionId,
    validationUrl: r.validationUrl,
    state: r.state,
    environment: r.environment,
    receiptClassification: r.receiptClassification,
    receiptContractVersion: r.receiptContractVersion,
    qrSourceContractVersion: r.qrSourceContractVersion,
    receiptDataChecksum: r.receiptDataChecksum,
    originalGeneratedAt: r.originalGeneratedAt,
    latestReprintSequence: r.latestReprintSequence,
    safeStatusSummary: r.safeStatusSummary,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const transmissionId = searchParams.get('transmissionId');
  const downloadArtifactId = searchParams.get('downloadArtifactId');
  const verifyId = searchParams.get('verify');

  if (downloadArtifactId) {
    const artifact = await prisma.mraEisFiscalReceiptArtifact.findFirst({
      where: {
        id: downloadArtifactId,
        tenantId: user.tenantId,
        businessId: user.tenantId,
      },
    });
    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }
    try {
      const { bytes } = await readArtifactBytes({
        tenantId: user.tenantId,
        storageKey: artifact.storageKey,
      });
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': artifact.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="fiscal-receipt-${artifact.id}.${artifact.artifactType.includes('PDF') ? 'pdf' : 'html'}"`,
          'Cache-Control': 'private, no-store',
          'X-Fiscal-Receipt-Id': artifact.fiscalReceiptId,
          'X-Artifact-Checksum': artifact.artifactChecksum,
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err.message || 'Download failed', code: err.code },
        { status: err.httpStatus || 403 }
      );
    }
  }

  if (verifyId) {
    const receipt = await prisma.mraEisFiscalReceipt.findFirst({
      where: { id: verifyId, tenantId: user.tenantId, businessId: user.tenantId },
    });
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    const integrity = await verifyFiscalReceiptIntegrity(verifyId);
    return NextResponse.json({ integrity });
  }

  if (id) {
    const receipt = await prisma.mraEisFiscalReceipt.findFirst({
      where: { id, tenantId: user.tenantId, businessId: user.tenantId },
      include: {
        artifacts: { orderBy: { createdAt: 'asc' } },
        qrEvidence: true,
      },
    });
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    return NextResponse.json({
      receipt: sanitizeReceipt(receipt),
      receiptData: receipt.receiptDataJson,
      artifacts: receipt.artifacts.map((a) => ({
        id: a.id,
        artifactType: a.artifactType,
        originalOrReprint: a.originalOrReprint,
        reprintSequence: a.reprintSequence,
        mimeType: a.mimeType,
        byteLength: a.byteLength,
        artifactChecksum: a.artifactChecksum,
        templateVersion: a.templateVersion,
        rendererVersion: a.rendererVersion,
        generatedAt: a.generatedAt,
      })),
      qrEvidence: receipt.qrEvidence.map((q) => ({
        id: q.id,
        sourceType: q.sourceType,
        sourceField: q.sourceField,
        exactSourceChecksum: q.exactSourceChecksum,
        decodeVerified: q.decodeVerified,
        validationUrl: q.validationUrl,
        dimensions: q.dimensions,
        generatorVersion: q.generatorVersion,
      })),
      // Never return credentials / BAC
    });
  }

  if (transmissionId) {
    const receipt = await prisma.mraEisFiscalReceipt.findFirst({
      where: {
        transmissionId,
        tenantId: user.tenantId,
        businessId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ receipt: sanitizeReceipt(receipt) });
  }

  const recent = await prisma.mraEisFiscalReceipt.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return NextResponse.json({
    receipts: recent.map(sanitizeReceipt),
    contractDecision: getReceiptContractDecision(),
    qrContractDecision: getQrSourceContractDecision(),
    note: 'Fiscal receipts are created only from conclusively accepted MRA transmissions. HTTP 200 alone is insufficient.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action || new URL(request.url).searchParams.get('action');
    const tenantId = user.tenantId;
    const businessId = user.tenantId;

    // Reject client-controlled fiscal / QR fields
    if (
      body.qrContent ||
      body.validationUrl ||
      body.fiscalNumber ||
      body.mraTransactionId ||
      body.forceCompleted ||
      body.receiptHtml ||
      body.templateHtml
    ) {
      return NextResponse.json(
        {
          error:
            'Client cannot supply QR content, validation URL, fiscal number, MRA transaction ID, HTML, or force completion.',
          code: 'CLIENT_RECEIPT_FIELDS_REJECTED',
        },
        { status: 400 }
      );
    }

    if (action === 'readiness') {
      const result = await evaluateFiscalReceiptGenerationReadiness({
        tenantId,
        businessId,
        transmissionId: body.transmissionId,
        acceptedAttemptId: body.acceptedAttemptId || null,
        responseEvidenceId: body.responseEvidenceId || null,
        expectedResponseChecksum: body.expectedResponseChecksum || null,
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json(result);
    }

    if (action === 'generate') {
      const outcome = await generateFiscalReceiptFromAcceptedTransmission({
        tenantId,
        businessId,
        transmissionId: body.transmissionId,
        acceptedAttemptId: body.acceptedAttemptId || null,
        responseEvidenceId: body.responseEvidenceId || null,
        expectedResponseChecksum: body.expectedResponseChecksum || null,
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json({
        receipt: sanitizeReceipt(outcome.receipt),
        duplicate: outcome.duplicate,
        warnings: outcome.warnings || [],
        mraSalesCalled: false,
        createsJournal: false,
        createsStockMovement: false,
      });
    }

    if (action === 'process-outbox') {
      const result = await processAcceptedReceiptOutboxBatch({
        limit: Math.min(Number(body.limit) || 10, 50),
        workerId: `api-phase14-${user.id}`,
      });
      return NextResponse.json(result);
    }

    if (action === 'reprint') {
      const result = await requestFiscalReceiptReprint({
        fiscalReceiptId: body.fiscalReceiptId,
        receiptType: body.receiptType || RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
        reasonCode: body.reasonCode || 'CUSTOMER_REQUEST',
        reasonText: body.reasonText || null,
        actorContext: { userId: user.id },
        idempotencyKey: body.idempotencyKey || null,
      });
      return NextResponse.json(result);
    }

    if (action === 'verify') {
      const integrity = await verifyFiscalReceiptIntegrity(body.fiscalReceiptId);
      return NextResponse.json({ integrity });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            requiredAction: err.requiredAction,
            retryable: err.retryable,
            details: err.details || null,
          },
        },
        { status: err.httpStatus || 400 }
      );
    }
    console.error('fiscal-receipts API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
