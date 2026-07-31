import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateQualification } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await evaluateQualification(prisma, {
      admin,
      leadId: body.leadId,
      definitionVersionId: body.definitionVersionId || null,
      responses: body.responses || [],
      applyQualifiedStatus: body.applyQualifiedStatus !== false,
      override: body.override === true,
      overrideReason: body.overrideReason || null,
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
        { success: false, error: result.error || 'Qualification failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM qualification evaluate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate qualification' },
      { status: 500 }
    );
  }
}
