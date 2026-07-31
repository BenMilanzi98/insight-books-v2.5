import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildCustomer360 } from '@/lib/admin/customers';

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

    const result = await buildCustomer360(prisma, {
      admin,
      tenantId,
      currency,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Customer not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to build customer 360' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer 360 error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build customer 360' },
      { status: 500 }
    );
  }
}
