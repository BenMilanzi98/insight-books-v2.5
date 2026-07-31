import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getOpportunityCommercial,
  setOpportunityCommercial,
} from '@/lib/admin/crm';

function parseUiGate(source = {}) {
  return {
    honestyOk: source.honestyOk === true || source.honestyOk === 'true',
    currencyOk: source.currencyOk === true || source.currencyOk === 'true',
    reliabilityOk:
      source.reliabilityOk === true || source.reliabilityOk === 'true',
  };
}

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const uiGate = parseUiGate({
      honestyOk: searchParams.get('honestyOk'),
      currencyOk: searchParams.get('currencyOk'),
      reliabilityOk: searchParams.get('reliabilityOk'),
    });

    const result = await getOpportunityCommercial(prisma, {
      admin,
      opportunityId: params?.id,
      uiGate,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to get commercial' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      commercial: result.commercial,
      amountHistory: result.amountHistory,
      /** Gated unlock only — never raw WEIGHTED_PIPELINE_UI_ENABLED. */
      weightedUiEnabled: result.weightedUiEnabled === true,
      weightedUiCapability: result.weightedUiCapability === true,
      isRevenue: false,
      isIndicativeOnly: true,
      indicativeWeighted: result.indicativeWeighted,
    });
  } catch (error) {
    console.error('CRM opportunity commercial GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get opportunity commercial' },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json().catch(() => ({}));
    const uiGate = parseUiGate(body.uiGate || body);

    const result = await setOpportunityCommercial(prisma, {
      admin,
      opportunityId: params?.id,
      amount: body.amount,
      currency: body.currency,
      amountBasis: body.amountBasis,
      recurringAnnualAmount: body.recurringAnnualAmount,
      oneTimeAmount: body.oneTimeAmount,
      reason: body.reason,
      uiGate,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to set commercial', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity: result.opportunity,
      historyId: result.historyId,
      postsRevenue: false,
      postsSubscription: false,
      isBinding: false,
      isRevenue: false,
      /** Gated unlock only — never raw WEIGHTED_PIPELINE_UI_ENABLED. */
      weightedUiEnabled: result.weightedUiEnabled === true,
      weightedUiCapability: result.weightedUiCapability === true,
    });
  } catch (error) {
    console.error('CRM opportunity commercial POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set opportunity commercial' },
      { status: 500 }
    );
  }
}
