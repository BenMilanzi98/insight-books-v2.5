import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

/**
 * Shared GET handler for Wave 3 revenue section APIs.
 * @param {Request} request
 * @param {(prisma: import('@prisma/client').PrismaClient, opts: object) => Promise<object>} buildPack
 * @param {string} errorLabel
 */
export async function handleWave3RevenueGet(request, buildPack, errorLabel) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const currency = searchParams.get('currency') || 'MWK';
    const now = new Date();
    const periodStart = new Date(
      now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5
    );

    const pack = await buildPack(prisma, {
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

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error(`${errorLabel} error:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to build ${errorLabel}` },
      { status: 500 }
    );
  }
}
