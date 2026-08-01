import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getCampaign, updateCampaign } from '@/lib/admin/marketing';

export async function GET(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getCampaign(prisma, { admin, id });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Campaign not found' },
        { status: result.statusCode === 404 ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, campaign: result.campaign });
  } catch (error) {
    console.error('Marketing campaign get error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load marketing campaign' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await updateCampaign(prisma, { admin, id, patch: body });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update campaign' },
        { status: result.statusCode === 404 ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, campaign: result.campaign });
  } catch (error) {
    console.error('Marketing campaign update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update marketing campaign' },
      { status: 500 }
    );
  }
}
