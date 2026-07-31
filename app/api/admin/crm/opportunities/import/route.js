import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { previewOpportunityImport, confirmOpportunityImport } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'preview').trim().toLowerCase();
    const rows = body.rows;

    if (action === 'confirm') {
      const result = await confirmOpportunityImport(prisma, { admin, rows });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges', reason: result.reason },
          { status: 403 }
        );
      }
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'import_confirm_failed', ...result },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    const result = await previewOpportunityImport(prisma, { admin, rows });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'import_preview_failed', ...result },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunity import error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process opportunity import' },
      { status: 500 }
    );
  }
}
