import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listUnassignedCustomers } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listUnassignedCustomers(prisma, {
      admin,
      q: searchParams.get('q') || '',
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.ok === false && result.status === 'UNAVAILABLE') {
      return NextResponse.json(
        { success: false, error: result.error || 'Unassigned list unavailable', ...result },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('unassigned customers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list unassigned customers' },
      { status: 500 }
    );
  }
}
