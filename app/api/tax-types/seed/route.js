import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensureMalawiTaxTypesForTenant } from '@/lib/malawiTaxSeed.js';

/**
 * POST /api/tax-types/seed
 * Idempotently provision Malawi MRA tax types + GL children under 2041 / 2045.
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const results = await ensureMalawiTaxTypesForTenant(user.tenantId, prisma);

    return NextResponse.json({
      message: 'Malawi tax catalog synced',
      ...results,
    });
  } catch (error) {
    console.error('tax-types seed error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Malawi tax catalog', details: error.message },
      { status: 500 }
    );
  }
}
