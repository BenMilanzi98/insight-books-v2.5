import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { preflightMraEisSaleEligibility } from '@/lib/mraEis/application/eligibility/preflightEligibility.js';
import { getMraEisSalesEligibilityPolicyRegistry } from '@/lib/mraEis/application/eligibility/eligibilityPolicyRegistry.js';
import { listEligibilityPolicies } from '@/lib/mraEis/application/eligibility/eligibilityPolicyRegistry.js';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

/**
 * GET — policy registry summary
 * POST — preflight eligibility (non-mutating)
 */
export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get('policies') === '1') {
    return NextResponse.json({
      registry: getMraEisSalesEligibilityPolicyRegistry(),
      policies: listEligibilityPolicies(),
    });
  }

  return NextResponse.json({
    phase: 11,
    endpoints: {
      preflight: 'POST /api/mra-eis/sales-eligibility',
      bridge: 'GET /api/mra-eis/sales-bridge',
      reconcile: 'POST /api/mra-eis/sales-bridge?action=reconcile',
    },
    maxStatus: 'EIS_READY_FOR_FISCAL_SNAPSHOT',
    mraApiCalls: false,
    fiscalNumbers: false,
    qrCodes: false,
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const result = await preflightMraEisSaleEligibility({
      ...body,
      tenantId: user.tenantId,
      businessId: user.tenantId,
      actorContext: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      ...result,
      mraSubmitted: false,
      mraAccepted: false,
    });
  } catch (err) {
    if (err instanceof MraEisControlError) {
      return NextResponse.json(err.toJSON(), { status: err.httpStatus || 400 });
    }
    console.error('sales-eligibility preflight:', err);
    return NextResponse.json({ error: 'Preflight failed', code: 'PREFLIGHT_ERROR' }, { status: 500 });
  }
}
