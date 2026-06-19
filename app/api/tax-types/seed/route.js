import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { ensureMalawiTaxTypesForTenant } from '@/lib/malawiTaxSeed.js';

/**
 * POST /api/tax-types/seed
 * Idempotently provision Malawi MRA tax types + GL children under 2041 / 2045.
 * Body: { applyCatalogRates?: boolean } — when true, reset system tax rates to MRA catalog defaults.
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'tax.update');
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const applyCatalogRates = body.applyCatalogRates === true;

    const results = await ensureMalawiTaxTypesForTenant(user.tenantId, prisma, {
      applyCatalogRates,
    });

    return NextResponse.json({
      message: applyCatalogRates
        ? 'Malawi tax catalog synced with MRA default rates'
        : 'Malawi tax catalog synced (custom rates preserved)',
      applyCatalogRates,
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
