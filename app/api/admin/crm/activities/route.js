import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createCrmActivity, listCrmActivities } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const myWork =
      searchParams.get('myWork') === 'true' || searchParams.get('myWork') === '1';
    const result = await listCrmActivities(prisma, {
      admin,
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      primarySubjectType: searchParams.get('primarySubjectType') || undefined,
      primarySubjectId: searchParams.get('primarySubjectId') || undefined,
      myWork,
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
        { success: false, error: result.error || 'Failed to list activities' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM activities list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM activities' },
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
    const result = await createCrmActivity(prisma, {
      admin,
      type: body.type,
      status: body.status,
      direction: body.direction,
      title: body.title,
      outcome: body.outcome,
      ownerAdminId: body.ownerAdminId,
      timezone: body.timezone,
      dueAt: body.dueAt,
      primarySubjectType: body.primarySubjectType || body.subjectType,
      primarySubjectId: body.primarySubjectId || body.subjectId,
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
        { success: false, error: result.error || 'Failed to create activity' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, activity: result.activity, alreadyExists: Boolean(result.alreadyExists) },
      { status: result.alreadyExists ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM activities create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM activity' },
      { status: 500 }
    );
  }
}
