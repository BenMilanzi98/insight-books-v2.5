import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  acceptCommercialDocument,
  getCommercialDomainContract,
  getESignatureProviderStatus,
  projectContentForAudience,
  recordCustomerView,
  rejectCommercialDocument,
  resolveReviewAccessByToken,
  submitCustomerComment,
  submitRevisionRequest,
} from '@/lib/admin/crm';

/**
 * Token-gated customer commercial review API.
 * High-entropy token required; non-enumerable (no list/browse).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: 'invalid_or_expired_token' },
        { status: 401 }
      );
    }

    const resolved = await resolveReviewAccessByToken(prisma, token);
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, error: resolved.error || 'invalid_or_expired_token' },
        { status: 401 }
      );
    }

    const access = resolved.reviewAccess;
    const version = await prisma.crmCommercialDocumentVersion.findUnique({
      where: { id: access.documentVersionId },
    });
    if (!version) {
      return NextResponse.json(
        { success: false, error: 'document_version_not_found' },
        { status: 404 }
      );
    }

    let authorityRole = null;
    if (access.recipientId && typeof prisma.crmCommercialRecipient?.findUnique === 'function') {
      const recipient = await prisma.crmCommercialRecipient.findUnique({
        where: { id: access.recipientId },
      });
      authorityRole = recipient?.authorityRole
        ? String(recipient.authorityRole).trim().toUpperCase()
        : null;
    }

    const customerSafe = projectContentForAudience(version.contentJson, 'ISSUED');

    return NextResponse.json({
      success: true,
      review: {
        documentVersionId: version.id,
        versionLabel: version.versionLabel,
        status: version.status,
        content: customerSafe,
        artifactId: access.artifactId,
        checksumSha256: access.checksumSha256,
        recipientId: access.recipientId,
        authorityRole,
      },
      domain: getCommercialDomainContract(),
      eSign: getESignatureProviderStatus(),
    });
  } catch (error) {
    console.error('Customer commercial review GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load review' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token || '';
    if (!token || String(token).length < 16) {
      return NextResponse.json(
        { success: false, error: 'invalid_or_expired_token' },
        { status: 401 }
      );
    }

    const action = String(body.action || 'view').trim().toLowerCase();
    let result;

    if (action === 'view') {
      result = await recordCustomerView(prisma, {
        token,
        recipientId: body.recipientId,
      });
    } else if (action === 'comment') {
      result = await submitCustomerComment(prisma, {
        token,
        body: body.body || body.comment,
        recipientId: body.recipientId,
      });
    } else if (action === 'revision') {
      result = await submitRevisionRequest(prisma, {
        token,
        reason: body.reason,
        detailsJson: body.detailsJson,
        idempotencyKey: body.idempotencyKey,
        recipientId: body.recipientId,
      });
    } else if (action === 'accept' || action === 'reject') {
      // Must resolve token → bound recipient/version/access (length-only is insufficient)
      const resolved = await resolveReviewAccessByToken(prisma, token);
      if (!resolved.ok) {
        return NextResponse.json(
          { success: false, error: resolved.error || 'invalid_or_expired_token' },
          { status: 401 }
        );
      }
      const access = resolved.reviewAccess;
      const bound = {
        token,
        documentVersionId: access.documentVersionId,
        artifactId: access.artifactId,
        checksumSha256: access.checksumSha256,
        recipientId: access.recipientId,
        idempotencyKey: body.idempotencyKey,
      };
      result =
        action === 'accept'
          ? await acceptCommercialDocument(prisma, {
              ...bound,
              authorityRole: body.authorityRole,
            })
          : await rejectCommercialDocument(prisma, {
              ...bound,
              reason: body.reason,
            });
    } else {
      return NextResponse.json(
        { success: false, error: 'unknown_action' },
        { status: 400 }
      );
    }

    if (!result.ok) {
      const statusCode =
        result.status === 'UNAVAILABLE'
          ? 503
          : result.error === 'invalid_or_expired_token' ||
              result.error === 'review_access_expired' ||
              result.error === 'review_access_revoked'
            ? 401
            : result.status === 'UNVERIFIED'
              ? 403
              : 400;
      return NextResponse.json(
        { success: false, error: result.error || 'action_failed' },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      eSign: getESignatureProviderStatus(),
    });
  } catch (error) {
    console.error('Customer commercial review POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed review action' },
      { status: 500 }
    );
  }
}
