import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateAttentionQueue } from '@/lib/admin/customers';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queue = searchParams.get('queue') || 'attention';
    const limit = searchParams.get('limit') || '50';
    const currency = searchParams.get('currency') || 'MWK';

    const result = await evaluateAttentionQueue(prisma, {
      admin,
      queue,
      limit,
      currency,
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (result.ok === false) {
      return NextResponse.json(
        { success: false, error: result.error || 'Signals unavailable', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer signals queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate attention queue' },
      { status: 500 }
    );
  }
}
