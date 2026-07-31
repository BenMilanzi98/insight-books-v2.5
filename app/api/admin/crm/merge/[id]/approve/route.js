import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { approveMerge } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await approveMerge(prisma, {
      admin,
      mergeRequestId: params?.id,
    });

    if (result.forbidden || result.error === 'SOD_VIOLATION') {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Insufficient admin privileges',
          reason: result.reason,
        },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Merge request not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to approve merge' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, mergeRequest: result.mergeRequest });
  } catch (error) {
    console.error('CRM merge approve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve CRM merge' },
      { status: 500 }
    );
  }
}
