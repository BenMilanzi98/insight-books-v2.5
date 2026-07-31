import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listTasks, createTask, updateTask } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listTasks(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
      caseId: searchParams.get('caseId') || undefined,
      status: searchParams.get('status') || undefined,
      assigneeAdminId: searchParams.get('assigneeAdminId') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS tasks list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list tasks' },
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
      caseId: body.caseId,
      tenantId: body.tenantId,
      title: body.title,
      status: body.status,
      assigneeAdminId: body.assigneeAdminId,
      dueAt: body.dueAt,
      stepId: body.stepId,
      executionId: body.executionId,
      idempotencyKey: body.idempotencyKey,
      notes: body.notes,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create task' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error('CS tasks create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await updateTask(prisma, {
      admin,
      taskId: body.taskId || body.id,
      status: body.status,
      assigneeAdminId: body.assigneeAdminId,
      title: body.title,
      notes: body.notes,
      dueAt: body.dueAt,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update task' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS tasks update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
