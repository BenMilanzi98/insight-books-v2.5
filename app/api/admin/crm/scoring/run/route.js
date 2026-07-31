import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { runLeadScore } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await runLeadScore(prisma, {
      admin,
      leadId: body.leadId,
      definitionVersionId: body.definitionVersionId || null,
      dimensionScores: body.dimensionScores || {},
      flags: body.flags || [],
      label: body.label || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Score run failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM score run error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run lead score' },
      { status: 500 }
    );
  }
}
