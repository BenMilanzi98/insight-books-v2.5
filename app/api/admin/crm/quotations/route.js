import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createQuotation, listCommercialDocuments } from '@/lib/admin/crm';
import { CRM_COMMERCIAL_DOCUMENT_FAMILY } from '@/lib/admin/crm/commercial';

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
      documentFamily: CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION,
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
        { success: false, error: result.error || 'Failed to list quotations' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      quotations: result.documents,
      domain: result.domain,
      tenantQuotationDomain: 'WRONG_DOMAIN',
    });
  } catch (error) {
    console.error('CRM quotations list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM quotations' },
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
    const result = await createQuotation(prisma, {
      admin,
      actorContext: { admin },
      title: body.title,
      opportunityId: body.opportunityId,
      accountId: body.accountId,
      contactId: body.contactId,
      demoId: body.demoId,
      requestId: body.requestId,
      currency: body.currency,
      ownerAdminId: body.ownerAdminId,
      idempotencyKey: body.idempotencyKey,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create quotation' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        document: result.document,
        version: result.version,
        quotation: result.quotation,
        alreadyExists: result.alreadyExists,
        tenantQuotationDomain: 'WRONG_DOMAIN',
      },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM quotations create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM quotation' },
      { status: 500 }
    );
  }
}
