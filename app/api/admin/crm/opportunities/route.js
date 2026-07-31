import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createOpportunityFromHandoff, listOpportunities } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listOpportunities(prisma, {
      admin,
      stageCode: searchParams.get('stageCode') || undefined,
      leadId: searchParams.get('leadId') || undefined,
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      myPipeline:
        searchParams.get('myPipeline') === '1' ||
        searchParams.get('myPipeline') === 'true',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!result.ok && result.status === 'UNAVAILABLE') {
      return NextResponse.json(
        { success: false, error: result.error, items: [] },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunities list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM opportunities' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await createOpportunityFromHandoff(prisma, {
      admin,
      handoffPayload: body.handoffPayload || body,
      title: body.title || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Lead not found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create opportunity', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        opportunity: result.opportunity,
        created: result.created !== false,
        idempotent: Boolean(result.idempotent),
        leadConversion: result.leadConversion || null,
        subscriptionCreated: false,
        invoiceCreated: false,
        tenantCreated: false,
      },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM opportunity create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM opportunity' },
      { status: 500 }
    );
  }
}
