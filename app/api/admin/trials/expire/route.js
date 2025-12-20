import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { checkAndExpireTrials, getTenantsWithExpiredTrials, forceExpireTrial } from '@/lib/trialExpirationService';

/**
 * GET - Get all tenants with expired trials
 */
export async function GET(request) {
  try {
    // Check if user is admin
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has admin role (you might want to add more specific admin checks)
    if (user.role?.name !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const expiredTrials = await getTenantsWithExpiredTrials();

    return NextResponse.json({
      success: true,
      data: expiredTrials,
      count: expiredTrials.length
    });

  } catch (error) {
    console.error('Error getting expired trials:', error);
    return NextResponse.json(
      { error: 'Failed to get expired trials' },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually expire trials or run expiration check
 */
export async function POST(request) {
  try {
    // Check if user is admin
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has admin role
    if (user.role?.name !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, tenantId } = body;

    if (action === 'check_and_expire') {
      // Run the expiration check
      const result = await checkAndExpireTrials();
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        expiredCount: result.expiredCount
      });

    } else if (action === 'force_expire' && tenantId) {
      // Force expire a specific tenant's trial
      const result = await forceExpireTrial(tenantId, user.id);
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Trial force expired successfully' : 'Failed to force expire trial',
        error: result.error
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing tenantId' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in trial expiration API:', error);
    return NextResponse.json(
      { error: 'Failed to process trial expiration request' },
      { status: 500 }
    );
  }
}
