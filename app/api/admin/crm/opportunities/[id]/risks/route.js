import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { evaluateOpportunityRisks, listOpportunityRisks } from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const evaluate = searchParams.get('evaluate') === '1' || searchParams.get('evaluate') === 'true';

    const result = evaluate
      ? await evaluateOpportunityRisks(prisma, {
          admin,
          opportunityId: params?.id,
          persist: searchParams.get('persist') !== '0',
        })
      : await listOpportunityRisks(prisma, {
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

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunity risks error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load opportunity risks' },
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
    const result = await evaluateOpportunityRisks(prisma, {
      admin,
      opportunityId: params?.id,
      persist: true,
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

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunity risk evaluate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate opportunity risks' },
      { status: 500 }
    );
  }
}
