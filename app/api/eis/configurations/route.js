import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/** TC-CONF-010: Get latest configs from MRA */
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

    const result = await eisService.getLatestConfigs(user.tenantId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Get configs error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
