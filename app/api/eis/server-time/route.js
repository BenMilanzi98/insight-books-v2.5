import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/**
 * TC-INV-003: Ping MRA server for server time.
 * Uses POST /api/v1/utilities/ping per MRA swagger spec.
 * Falls back to local server time if MRA is unreachable.
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

    try {
      const result = await eisService.ping(user.tenantId);
      return NextResponse.json({
        serverTime: result.data?.serverDate || new Date().toISOString(),
        source: 'mra',
      });
    } catch {
      // Fallback to local server time if MRA is unreachable
      return NextResponse.json({
        serverTime: new Date().toISOString(),
        source: 'local',
      });
    }
  } catch (error) {
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      source: 'local',
      error: error.message,
    });
  }
}
