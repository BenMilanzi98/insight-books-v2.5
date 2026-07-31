import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  resolveProductAnalyticsAccess,
  evaluateActivation,
  evaluateAdoptionState,
  evaluateRepeatValue,
  recordOrLoadFirstValue,
} from '@/lib/admin/productAnalytics';

/**
 * POST — evaluate activation / adoption / repeat-value / first-value for a tenant feature.
 * Body: { tenantId, featureCode?, moduleCode?, level?, action?, sourceEvent?, persist? }
 */
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
    const moduleCode = body.moduleCode || body.module_code;
    const level = body.level || 'feature';
    const action = String(body.action || 'adoption').toLowerCase();
    // Persist adoption history only on explicit flag (align with adoption route).
    const persist =
      body.persist === true || body.persist === 1 || body.persist === '1';

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId required' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'first-value' || action === 'first_value') {
      if (!featureCode || !body.sourceEvent) {
        return NextResponse.json(
          { success: false, error: 'featureCode and sourceEvent required for first-value' },
          { status: 400 }
        );
      }
      result = await recordOrLoadFirstValue(prisma, {
        tenantId,
        featureCode,
        sourceEvent: body.sourceEvent,
      });
    } else if (action === 'repeat-value' || action === 'repeat_value') {
      result = await evaluateRepeatValue(prisma, {
        tenantId,
        featureCode,
        rule: body.rule,
      });
    } else if (action === 'activation') {
      result = await evaluateActivation(prisma, {
        tenantId,
        featureCode,
        moduleCode,
        level,
      });
    } else {
      result = await evaluateAdoptionState(prisma, {
        tenantId,
        featureCode,
        persist,
        asOf: body.asOf ? new Date(body.asOf) : undefined,
      });
    }

    return NextResponse.json({ success: true, action, result });
  } catch (error) {
    console.error('product-analytics evaluate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate product analytics' },
      { status: 500 }
    );
  }
}
