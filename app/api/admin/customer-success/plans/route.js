import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listSuccessPlans, createSuccessPlan, addSuccessGoal } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listSuccessPlans(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
      status: searchParams.get('status') || undefined,
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
    console.error('CS plans list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list success plans' },
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
    const mode = String(body.mode || 'plan').toLowerCase();

    const result =
      mode === 'goal'
        ? await addSuccessGoal(prisma, {
            admin,
            planId: body.planId,
            title: body.title,
            status: body.status,
            targetNote: body.targetNote,
            dueAt: body.dueAt,
            sortOrder: body.sortOrder,
          })
        : await createSuccessPlan(prisma, {
            admin,
            tenantId: body.tenantId,
            title: body.title,
            summary: body.summary,
            status: body.status,
            ownerAdminId: body.ownerAdminId,
            startedAt: body.startedAt,
            targetAt: body.targetAt,
            goals: body.goals,
          });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create plan/goal', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : result.notFound ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('CS plans create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create success plan' },
      { status: 500 }
    );
  }
}
