import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

/** TC-RS-016: Validate VAT 5 certificate with MRA */
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

    const body = await request.json();
    const result = await eisService.validateVat5Certificate(user.tenantId, body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('VAT5 validation error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
