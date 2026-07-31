import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createTask, listTasks } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const myWork =
      searchParams.get('myWork') === 'true' || searchParams.get('myWork') === '1';
    const result = await listTasks(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || undefined,
      subjectId: searchParams.get('subjectId') || searchParams.get('leadId') || undefined,
      status: searchParams.get('status') || undefined,
      assigneeAdminId: searchParams.get('assigneeAdminId') || undefined,
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
        { success: false, error: result.error || 'Failed to list tasks' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM tasks list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM tasks' },
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
    const result = await createTask(prisma, {
      admin,
      subjectType: body.subjectType || 'LEAD',
      subjectId: body.subjectId || body.leadId,
      title: body.title,
      dueAt: body.dueAt,
      assigneeAdminId: body.assigneeAdminId,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create task' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, task: result.task }, { status: 201 });
  } catch (error) {
    console.error('CRM tasks create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM task' },
      { status: 500 }
    );
  }
}
