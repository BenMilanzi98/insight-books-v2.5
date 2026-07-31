import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getFoundationStatus } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') || searchParams.get('section') || '';
    const result = await getFoundationStatus(prisma, {
      admin,
      kind,
      tenantId: searchParams.get('tenantId') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid foundation request' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS foundations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load foundation status' },
      { status: 500 }
    );
  }
}
