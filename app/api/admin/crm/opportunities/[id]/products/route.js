import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listOpportunityProducts, addOpportunityProduct } from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await listOpportunityProducts(prisma, {
      admin,
      opportunityId: params?.id,
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
        { success: false, error: result.error || 'Failed to list products' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      products: result.products,
      binding: result.binding,
      createsEntitlement: false,
    });
  } catch (error) {
    console.error('CRM opportunity products GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list opportunity products' },
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

    const result = await addOpportunityProduct(prisma, {
      admin,
      opportunityId: params?.id,
      featureCode: body.featureCode,
      moduleCode: body.moduleCode,
      unknownInterest: body.unknownInterest,
      label: body.label,
      quantity: body.quantity,
      unitAmountEstimate: body.unitAmountEstimate,
      currency: body.currency,
      note: body.note,
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
        { success: false, error: result.error || 'Failed to add product', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      product: result.product,
      createsEntitlement: false,
      createsSubscriptionLine: false,
      createsInvoiceLine: false,
    });
  } catch (error) {
    console.error('CRM opportunity products POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add opportunity product' },
      { status: 500 }
    );
  }
}
