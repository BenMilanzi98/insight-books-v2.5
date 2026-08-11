import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { loadCogsSourceSoldItems } from '@/lib/cogsSourceSoldItems';

/**
 * GET /api/expenses/cogs-source
 * Sold line items for a COGS expense register row (Invoice-COGS / Sale-COGS).
 *
 * Query: sourceType, sourceId, linkedSaleId (optional aliases)
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');
    const linkedSaleId = searchParams.get('linkedSaleId');

    if (!sourceId && !linkedSaleId) {
      return NextResponse.json(
        { error: 'sourceId or linkedSaleId is required' },
        { status: 400 }
      );
    }

    const result = await loadCogsSourceSoldItems(prisma, {
      tenantId: user.tenantId,
      sourceType,
      sourceId,
      linkedSaleId,
    });

    if (!result.found) {
      return NextResponse.json(
        {
          found: false,
          reason: result.reason || 'not_found',
          items: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('cogs-source GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load COGS source items' },
      { status: 500 }
    );
  }
}
