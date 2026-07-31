import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getCrmFoundations } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await getCrmFoundations(prisma, {
      admin,
      kind: searchParams.get('kind') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to load foundations' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM foundations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load CRM foundations' },
      { status: 500 }
    );
  }
}
