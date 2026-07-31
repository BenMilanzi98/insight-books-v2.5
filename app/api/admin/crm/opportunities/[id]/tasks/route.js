import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  completeOpportunityTask,
  createOpportunityTask,
  listOpportunityTasks,
} from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const result = await listOpportunityTasks(prisma, {
      admin,
      opportunityId: params?.id,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunity tasks list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list opportunity tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body.complete === true || body.action === 'COMPLETE') {
      const result = await completeOpportunityTask(prisma, {
        admin,
        opportunityId: params?.id,
        taskId: body.taskId,
      });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'Complete failed', ...result },
          { status: result.notFound ? 404 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await createOpportunityTask(prisma, {
      admin,
      opportunityId: params?.id,
      title: body.title,
      dueAt: body.dueAt,
      assigneeAdminId: body.assigneeAdminId,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Create failed', ...result },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('CRM opportunity tasks mutate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mutate opportunity tasks' },
      { status: 500 }
    );
  }
}
