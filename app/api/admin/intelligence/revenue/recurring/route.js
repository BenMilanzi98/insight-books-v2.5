import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildRevenueKpiPack,
  filterRevenuePackBySection,
} from '@/lib/admin/revenue';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const currency = searchParams.get('currency') || 'MWK';
    const now = new Date();
    const periodStart = new Date(now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5);

    let pack = await buildRevenueKpiPack(prisma, {
      admin,
      periodStart,
      periodEnd: now,
      currency,
      now,
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    pack = filterRevenuePackBySection(pack, 'recurring');
    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('revenue recurring error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build recurring revenue pack' },
      { status: 500 }
    );
  }
}
