import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getCommercialDomainContract,
  getESignatureProviderStatus,
  issueCommercialDocument,
  renderCommercialDocument,
  withdrawCommercialDocument,
} from '@/lib/admin/crm';

export async function GET() {
  return NextResponse.json({
    success: true,
    domain: getCommercialDomainContract(),
    eSign: getESignatureProviderStatus(),
  });
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'issue').trim().toLowerCase();

    let result;
    if (action === 'render') {
      result = await renderCommercialDocument(prisma, {
        admin,
        actorContext: { admin },
        versionId: body.versionId || body.documentVersionId,
        projection: body.projection || 'ISSUED',
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'withdraw') {
      result = await withdrawCommercialDocument(prisma, {
        admin,
        actorContext: { admin },
        documentVersionId: body.documentVersionId || body.commercialDocumentVersionId,
        reason: body.reason,
      });
    } else {
      result = await issueCommercialDocument(prisma, {
        admin,
        actorContext: { admin },
        commercialDocumentVersionId:
          body.commercialDocumentVersionId || body.documentVersionId,
        artifactId: body.artifactId,
        recipientIds: body.recipientIds,
        deliveryMethod: body.deliveryMethod,
        validUntil: body.validUntil,
        idempotencyKey: body.idempotencyKey,
        evidenceJson: body.evidenceJson,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Commercial issue action failed' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    // Never return private storage buffers on admin JSON APIs
    const safe = { ...result };
    if (safe.artifact?.buffer) {
      delete safe.artifact.buffer;
    }

    return NextResponse.json(
      { success: true, ...safe, eSign: getESignatureProviderStatus() },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM commercial issue error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed CRM commercial issue action' },
      { status: 500 }
    );
  }
}
