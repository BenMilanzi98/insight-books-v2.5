import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getCommercialDomainContract,
  listCommercialDocuments,
  transitionDocumentStatus,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listCommercialDocuments(prisma, {
      admin,
      actorContext: { admin },
      documentFamily: searchParams.get('documentFamily') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
      requestId: searchParams.get('requestId') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list commercial documents' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: result.documents,
      domain: getCommercialDomainContract(),
    });
  } catch (error) {
    console.error('CRM commercial list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list commercial documents' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.action === 'transitionStatus') {
      try {
        const result = await transitionDocumentStatus(prisma, {
          admin,
          actorContext: { admin },
          documentVersionId: body.documentVersionId,
          toStatus: body.toStatus,
          reason: body.reason,
        });
        return NextResponse.json({ success: true, ...result });
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err?.message || 'invalid_status_transition' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        domain: getCommercialDomainContract(),
        message: 'Commercial overview stub — use proposal-requests / proposals / quotations',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('CRM commercial action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed commercial action' },
      { status: 500 }
    );
  }
}
