import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  evaluateCustomerHealth,
  getLatestHealthSnapshot,
} from '@/lib/admin/health';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const tenantId = params?.tenantId;
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'MWK';

    const evaluation = await evaluateCustomerHealth(prisma, {
      admin,
      tenantId,
      currency,
      now: new Date(),
    });

    if (evaluation.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (evaluation.notFound) {
      return NextResponse.json(
        { success: false, error: evaluation.error || 'Customer not found' },
        { status: 404 }
      );
    }

    if (!evaluation.ok) {
      return NextResponse.json(
        { success: false, error: evaluation.error || 'Failed to evaluate health' },
        { status: 500 }
      );
    }

    let snapshot = null;
    const latest = await getLatestHealthSnapshot(prisma, {
      admin,
      tenantId,
      now: new Date(),
    });
    if (latest.ok) snapshot = latest.snapshot;

    return NextResponse.json({
      success: true,
      evaluation,
      latestSnapshot: snapshot,
    });
  } catch (error) {
    console.error('customer-health tenant error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load customer health' },
      { status: 500 }
    );
  }
}
