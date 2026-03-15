import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/**
 * TC-INV-014: Check terminal block status.
 * Uses POST /api/v1/utilities/get-terminal-blocking-message per MRA swagger.
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const status = await eisService.checkTerminalStatus(user.tenantId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Terminal status check error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check terminal status', blocked: false },
      { status: 500 }
    );
  }
}

/**
 * Check terminal unblock status.
 * Uses POST /api/v1/utilities/check-terminal-unblock-status per MRA swagger.
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const result = await eisService.checkTerminalUnblockStatus(user.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Terminal unblock check error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check terminal unblock status' },
      { status: 500 }
    );
  }
}
