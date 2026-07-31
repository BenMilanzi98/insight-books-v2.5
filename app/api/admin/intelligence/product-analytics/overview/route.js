import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildProductAnalyticsOverviewPack } from '@/lib/admin/productAnalytics';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const pack = await buildProductAnalyticsOverviewPack(prisma, {
      admin,
      now: new Date(),
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('product-analytics overview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build product analytics overview' },
      { status: 500 }
    );
  }
}
