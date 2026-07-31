import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildProductCohortsPack } from '@/lib/admin/productAnalytics';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pack = await buildProductCohortsPack(prisma, {
      admin,
      featureCode: searchParams.get('featureCode') || undefined,
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
    console.error('product-analytics cohorts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build product cohorts pack' },
      { status: 500 }
    );
  }
}
