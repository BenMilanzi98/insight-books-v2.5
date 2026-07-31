import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  resolveProductAnalyticsAccess,
  evaluateAdoptionState,
  ADOPTION_STATE,
  ADOPTION_RULE_VERSION,
} from '@/lib/admin/productAnalytics';

/** GET — evaluate (read) current adoption state. Query: tenantId, featureCode */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const access = resolveProductAnalyticsAccess(admin);
    if (!access.canView) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const featureCode = searchParams.get('featureCode');
    // GET is read-only by default; persist only with explicit ?persist=1|true
    const persistFlag = searchParams.get('persist');
    const persist = persistFlag === '1' || persistFlag === 'true';
    if (!tenantId || !featureCode) {
      return NextResponse.json(
        { success: false, error: 'tenantId and featureCode required' },
        { status: 400 }
      );
    }

    const result = await evaluateAdoptionState(prisma, {
      tenantId,
      featureCode,
      persist,
    });
    return NextResponse.json({
      success: true,
      result,
      states: ADOPTION_STATE,
      ruleVersion: ADOPTION_RULE_VERSION,
    });
  } catch (error) {
    console.error('product-analytics adoption GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate adoption' },
      { status: 500 }
    );
  }
}

/** POST — evaluate adoption (optional persist) */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const access = resolveProductAnalyticsAccess(admin);
    if (!access.canView) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || body.tenant_id;
    const featureCode = body.featureCode || body.feature_code;
    if (!tenantId || !featureCode) {
      return NextResponse.json(
        { success: false, error: 'tenantId and featureCode required' },
        { status: 400 }
      );
    }

    // Persist only on explicit flag (POST is not mutate-by-default)
    const persist = body.persist === true || body.persist === 1 || body.persist === '1';
    const result = await evaluateAdoptionState(prisma, {
      tenantId,
      featureCode,
      persist,
      asOf: body.asOf ? new Date(body.asOf) : undefined,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('product-analytics adoption POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate adoption' },
      { status: 500 }
    );
  }
}
