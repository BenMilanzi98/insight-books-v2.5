import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({
        status: 'not_configured',
        configured: false,
        mraConnected: false,
        timestamp: new Date().toISOString(),
      });
    }

    const health = await eisService.getHealthStatus();
    // Always return 200 so clients can read status from body; avoids 503 in console when MRA is unreachable
    return NextResponse.json({ ...health, configured: true });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      configured: true,
      mraConnected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
