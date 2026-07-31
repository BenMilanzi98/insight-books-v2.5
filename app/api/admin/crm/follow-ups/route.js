import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createFollowUp, listFollowUps } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listFollowUps(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list follow-ups' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM follow-ups list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM follow-ups' },
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
    const result = await createFollowUp(prisma, {
      admin,
      subjectType: body.subjectType || 'LEAD',
      subjectId: body.subjectId || body.leadId || body.opportunityId,
      title: body.title,
      dueAt: body.dueAt,
      channel: body.channel,
      contactId: body.contactId,
      purpose: body.purpose,
      ownerAdminId: body.ownerAdminId,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create follow-up' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, followUp: result.followUp, activity: result.activity },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM follow-ups create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM follow-up' },
      { status: 500 }
    );
  }
}
