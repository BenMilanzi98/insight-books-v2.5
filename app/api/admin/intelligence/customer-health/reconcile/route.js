import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildHealthReconciliation } from '@/lib/admin/health';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await buildHealthReconciliation(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
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
    console.error('customer-health reconcile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reconcile customer health' },
      { status: 500 }
    );
  }
}
