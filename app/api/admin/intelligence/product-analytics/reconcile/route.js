import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildProductReconciliation,
  resolveProductAnalyticsAccess,
} from '@/lib/admin/productAnalytics';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveProductAnalyticsAccess(admin);
    if (!access.canView) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pack = await buildProductReconciliation(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
      now: new Date(),
      requireReconPerm: false,
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('product-analytics reconcile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reconcile product analytics' },
      { status: 500 }
    );
  }
}
