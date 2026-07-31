import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listQueues, resolveSupportAccess } from '@/lib/admin/support';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveSupportAccess(admin);
    if (!access.canViewTickets) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const result = await listQueues(prisma);
    return NextResponse.json({
      success: true,
      items: result.items,
      source: result.source,
    });
  } catch (error) {
    console.error('Support queues list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list support queues' },
      { status: 500 }
    );
  }
}
