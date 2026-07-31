import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { intakeHandoffAsLead } from '@/lib/admin/crm';

/**
 * POST — CS / Support / Product handoff → Lead (link-only; no source mutation).
 * Body: { handoffType, handoffId, featureCode?, tenantId?, summary?, ... }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await intakeHandoffAsLead(prisma, {
      admin,
      handoffType: body.handoffType,
      handoffId: body.handoffId,
      featureCode: body.featureCode || null,
      tenantId: body.tenantId || null,
      summary: body.summary || body.notes || null,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      businessName: body.businessName || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'not_found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'handoff_intake_failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead: result.lead,
        created: result.created !== false,
        idempotent: Boolean(result.idempotent),
        meta: result.meta,
      },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM handoff intake error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to intake handoff as lead' },
      { status: 500 }
    );
  }
}
