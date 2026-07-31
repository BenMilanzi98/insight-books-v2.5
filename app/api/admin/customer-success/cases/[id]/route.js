import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getCase, updateCase, listTasks, listInterventions } from '@/lib/admin/customerSuccess';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const caseId = params?.id;
    const result = await getCase(prisma, { admin, caseId });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to load case' },
        { status: 400 }
      );
    }

    const [tasks, interventions] = await Promise.all([
      listTasks(prisma, { admin, caseId, limit: 100 }),
      listInterventions(prisma, { admin, caseId, limit: 100 }),
    ]);

    return NextResponse.json({
      success: true,
      case: result.case,
      tasks: tasks.items || [],
      interventions: interventions.items || [],
    });
  } catch (error) {
    console.error('CS case detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load case' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await updateCase(prisma, {
      admin,
      caseId: params?.id,
      status: body.status,
      priority: body.priority,
      ownerAdminId: body.ownerAdminId,
      summary: body.summary,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update case' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS case update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update case' },
      { status: 500 }
    );
  }
}
