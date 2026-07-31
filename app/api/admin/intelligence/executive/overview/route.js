import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildExecutiveKpiPack,
  filterPackBySection,
} from '@/lib/admin/intelligence/executiveKpiPack';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const section = searchParams.get('section') || null;
    const now = new Date();
    const periodStart = new Date(now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5);

    let pack = await buildExecutiveKpiPack(prisma, {
      admin,
      periodStart,
      periodEnd: now,
      now,
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (section) {
      pack = filterPackBySection(pack, section);
    }

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('executive overview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build executive KPI pack' },
      { status: 500 }
    );
  }
}
