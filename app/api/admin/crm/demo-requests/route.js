import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createDemoRequest, listDemoRequests } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listDemoRequests(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      leadId: searchParams.get('leadId') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list demo requests' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo-requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM demo requests' },
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
    const result = await createDemoRequest(prisma, {
      admin,
      title: body.title,
      notes: body.notes,
      source: body.source,
      leadId: body.leadId,
      opportunityId: body.opportunityId,
      accountId: body.accountId,
      contactId: body.contactId,
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
        { success: false, error: result.error || 'Failed to create demo request' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, request: result.request, alreadyExists: result.alreadyExists },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM demo-requests create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM demo request' },
      { status: 500 }
    );
  }
}
