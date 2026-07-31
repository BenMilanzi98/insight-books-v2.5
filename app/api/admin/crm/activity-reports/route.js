import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getActivityReport,
  evaluateActivityDataQuality,
  runActivityReconciliation,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = String(searchParams.get('view') || 'report').trim().toLowerCase();

    if (view === 'data-quality' || view === 'dq') {
      const result = await evaluateActivityDataQuality(prisma, { admin });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (view === 'reconciliation' || view === 'recon') {
      const result = await runActivityReconciliation(prisma, { admin });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await getActivityReport(prisma, {
      admin,
      type: searchParams.get('type') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM activity reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load activity report' },
      { status: 500 }
    );
  }
}
