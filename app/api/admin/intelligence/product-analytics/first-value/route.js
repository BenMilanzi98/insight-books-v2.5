import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  resolveProductAnalyticsAccess,
  recordOrLoadFirstValue,
  loadFirstValue,
  FIRST_VALUE_RULE_VERSION,
} from '@/lib/admin/productAnalytics';

/** GET — read first-value fact. Query: tenantId, featureCode */
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
    if (!tenantId || !featureCode) {
      return NextResponse.json(
        { success: false, error: 'tenantId and featureCode required' },
        { status: 400 }
      );
    }

    const fact = await loadFirstValue(prisma, {
      tenantId,
      featureCode,
      ruleVersion: FIRST_VALUE_RULE_VERSION,
    });
    return NextResponse.json({
      success: true,
      fact,
      ruleVersion: FIRST_VALUE_RULE_VERSION,
    });
  } catch (error) {
    console.error('product-analytics first-value GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load first value' },
      { status: 500 }
    );
  }
}

/** POST — record or load first value from a source event */
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
    const sourceEvent = body.sourceEvent || body.source_event;
    if (!tenantId || !featureCode || !sourceEvent) {
      return NextResponse.json(
        { success: false, error: 'tenantId, featureCode, and sourceEvent required' },
        { status: 400 }
      );
    }

    const result = await recordOrLoadFirstValue(prisma, {
      tenantId,
      featureCode,
      sourceEvent,
      ruleVersion: body.ruleVersion,
    });
    return NextResponse.json({ success: result.ok !== false, result });
  } catch (error) {
    console.error('product-analytics first-value POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record first value' },
      { status: 500 }
    );
  }
}
