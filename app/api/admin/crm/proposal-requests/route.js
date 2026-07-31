import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createProposalRequest, listProposalRequests } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listProposalRequests(prisma, {
      admin,
      actorContext: { admin },
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list proposal requests' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM proposal-requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM proposal requests' },
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
    const result = await createProposalRequest(prisma, {
      admin,
      actorContext: { admin },
      source: body.source,
      sourceRef: body.sourceRef,
      opportunityId: body.opportunityId,
      accountId: body.accountId,
      contactId: body.contactId,
      demoId: body.demoId,
      leadId: body.leadId,
      requestedDocumentType: body.requestedDocumentType,
      currency: body.currency,
      title: body.title,
      notes: body.notes,
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
        { success: false, error: result.error || 'Failed to create proposal request' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        request: result.request,
        alreadyExists: result.alreadyExists,
        proposalCreated: false,
      },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM proposal-requests create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM proposal request' },
      { status: 500 }
    );
  }
}
