import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listOpportunityTimeline } from '@/lib/admin/crm';

export async function GET(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const result = await listOpportunityTimeline(prisma, {
      admin,
      opportunityId: params?.id,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
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
    console.error('CRM opportunity timeline error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load opportunity timeline' },
      { status: 500 }
    );
  }
}
