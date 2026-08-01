import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listCampaigns, createCampaign } from '@/lib/admin/marketing';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listCampaigns(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      skip: searchParams.get('offset') || searchParams.get('skip') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list campaigns' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Marketing campaigns list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list marketing campaigns' },
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
    const result = await createCampaign(prisma, {
      admin,
      name: body.name,
      objective: body.objective,
      campaignType: body.campaignType || body.type,
      description: body.description,
      channelId: body.channelId || null,
      sourceId: body.sourceId || null,
      mediumId: body.mediumId || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create campaign' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        campaign: result.campaign,
        campaignNumber: result.campaign?.campaignNumber,
        created: result.created !== false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Marketing campaigns create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create marketing campaign' },
      { status: 500 }
    );
  }
}
