import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildCustomerReconciliation } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await buildCustomerReconciliation(prisma, {
      admin,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer reconciliation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build customer reconciliation' },
      { status: 500 }
    );
  }
}
