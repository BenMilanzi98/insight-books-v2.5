import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listCustomerDirectory } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '25';
    const lifecycle = searchParams.get('lifecycle') || undefined;
    const currency = searchParams.get('currency') || 'MWK';

    const result = await listCustomerDirectory(prisma, {
      admin,
      q,
      page,
      pageSize,
      lifecycle,
      currency,
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
        { success: false, error: result.error || 'Directory unavailable', ...result },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer directory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list customer directory' },
      { status: 500 }
    );
  }
}
