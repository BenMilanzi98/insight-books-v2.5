import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listSlaPolicies } from '@/lib/admin/support';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await listSlaPolicies(prisma, { admin });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      items: result.items,
      meta: result.meta,
    });
  } catch (error) {
    console.error('Support SLA policies list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list SLA policies' },
      { status: 500 }
    );
  }
}
