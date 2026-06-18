import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { syncCapitalContributionAssets } from '@/lib/capitalContributionAssetRegister';

/**
 * POST — backfill Asset register from historical capital-account asset contributions.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const results = await syncCapitalContributionAssets(user.tenantId, user.id);

    return NextResponse.json({
      message: 'Capital contribution asset sync completed',
      ...results,
    });
  } catch (error) {
    console.error('sync-capital-contributions error:', error);
    return NextResponse.json(
      { error: 'Failed to sync capital contribution assets' },
      { status: 500 }
    );
  }
}
