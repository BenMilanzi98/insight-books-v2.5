import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listExpansionHandoffs, createExpansionHandoff } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listExpansionHandoffs(prisma, {
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
    console.error('CS handoffs list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list handoffs' },
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
    const result = await createExpansionHandoff(prisma, {
      admin,
      tenantId: body.tenantId,
      reason: body.reason,
      notes: body.notes,
      recommendedAction: body.recommendedAction,
      status: body.status,
      payload: body.payload,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create handoff', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('CS handoffs create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create handoff' },
      { status: 500 }
    );
  }
}
