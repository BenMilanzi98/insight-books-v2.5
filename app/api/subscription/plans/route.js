import { NextResponse } from 'next/server';
import { listPublicStorefrontPlans } from '@/lib/admin/publicPlans';

/**
 * GET — public storefront plans (core + published public MRA EIS).
 * No auth required.
 */
export async function GET() {
  try {
    const { plans, source } = await listPublicStorefrontPlans();
    return NextResponse.json({
      success: true,
      plans,
      source,
      groups: {
        core: plans.filter((p) => !p.requiresEIS),
        mraEis: plans.filter((p) => p.requiresEIS),
      },
    });
  } catch (error) {
    console.error('subscription/plans GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load plans',
        plans: [],
      },
      { status: 500 }
    );
  }
}
