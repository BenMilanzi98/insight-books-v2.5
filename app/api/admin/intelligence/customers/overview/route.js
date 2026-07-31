import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildCustomerOverviewPack } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'MWK';

    const pack = await buildCustomerOverviewPack(prisma, {
      admin,
      currency,
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
    console.error('customer overview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build customer overview pack' },
      { status: 500 }
    );
  }
}
