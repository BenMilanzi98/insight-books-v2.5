import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateConversionReadiness } from '@/lib/admin/crm';

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const result = await evaluateConversionReadiness(prisma, {
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

    return NextResponse.json({
      success: true,
      ...result,
      conversionExecuted: false,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
    });
  } catch (error) {
    console.error('CRM conversion readiness error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate conversion readiness' },
      { status: 500 }
    );
  }
}
