import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listCalls, planCall, logManualCall } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listCalls(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      status: searchParams.get('status') || undefined,
      activityId: searchParams.get('activityId') || undefined,
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
        { success: false, error: result.error || 'Failed to list calls' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM calls list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM calls' },
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
    const mode = String(body.mode || body.action || 'plan').trim().toLowerCase();

    const result =
      mode === 'log' || mode === 'manual'
        ? await logManualCall(prisma, {
            admin,
            direction: body.direction,
            outcome: body.outcome,
            title: body.title,
            subjectType: body.subjectType || 'LEAD',
            subjectId: body.subjectId || body.leadId || body.opportunityId,
            contactId: body.contactId,
            purpose: body.purpose,
            phoneNumber: body.phoneNumber,
            completedAt: body.completedAt,
            notes: body.notes,
            ownerAdminId: body.ownerAdminId,
            idempotencyKey: body.idempotencyKey,
          })
        : await planCall(prisma, {
            admin,
            direction: body.direction,
            title: body.title,
            subjectType: body.subjectType || 'LEAD',
            subjectId: body.subjectId || body.leadId || body.opportunityId,
            contactId: body.contactId,
            purpose: body.purpose,
            phoneNumber: body.phoneNumber,
            scheduledAt: body.scheduledAt || body.dueAt,
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
        { success: false, error: result.error || 'Failed to create call' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        call: result.call,
        activity: result.activity,
        telephony: result.telephony,
        alreadyExists: result.alreadyExists,
        blocked: result.blocked,
      },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM calls create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM call' },
      { status: 500 }
    );
  }
}
