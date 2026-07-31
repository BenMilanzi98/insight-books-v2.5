import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getAccount } from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await getAccount(prisma, { admin, id: params?.id });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to load account' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, account: result.account });
  } catch (error) {
    console.error('CRM account detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load CRM account' },
      { status: 500 }
    );
  }
}
