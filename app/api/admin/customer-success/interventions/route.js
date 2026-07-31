import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listInterventions, logIntervention } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listInterventions(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
      caseId: searchParams.get('caseId') || undefined,
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
    console.error('CS interventions list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list interventions' },
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
    const result = await logIntervention(prisma, {
      admin,
      caseId: body.caseId,
      tenantId: body.tenantId,
      type: body.type,
      notes: body.notes,
      channel: body.channel,
      performedAt: body.performedAt,
      payload: body.payload,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to log intervention' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('CS interventions create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log intervention' },
      { status: 500 }
    );
  }
}
