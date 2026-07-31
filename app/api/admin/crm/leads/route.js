import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createLead, listLeads } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const myWork =
      searchParams.get('myWork') === 'true' || searchParams.get('myWork') === '1';
    const result = await listLeads(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      ownerAdminId: searchParams.get('ownerAdminId') || undefined,
      myWork,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM leads list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM leads' },
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
    const result = await createLead(prisma, {
      admin,
      type: body.type,
      personOrOrganisation: body.personOrOrganisation,
      title: body.title,
      summary: body.summary,
      source: body.source,
      accountId: body.accountId || null,
      contactId: body.contactId || null,
      ownerAdminId: body.ownerAdminId || null,
      sourceIdempotencyKey: body.sourceIdempotencyKey || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create lead', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead: result.lead,
        leadNumber: result.lead?.leadNumber,
        created: result.created !== false,
        idempotentReplay: Boolean(result.idempotentReplay),
      },
      { status: result.idempotentReplay ? 200 : 201 }
    );
  } catch (error) {
    console.error('CRM leads create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM lead' },
      { status: 500 }
    );
  }
}
