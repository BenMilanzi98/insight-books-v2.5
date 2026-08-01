import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { transitionCampaignStatus, MARKETING_CAMPAIGN_STATUS } from '@/lib/admin/marketing';

const VALID_ACTIONS = Object.freeze({
  activate: MARKETING_CAMPAIGN_STATUS.ACTIVE,
  pause: MARKETING_CAMPAIGN_STATUS.PAUSED,
  complete: MARKETING_CAMPAIGN_STATUS.COMPLETED,
  archive: MARKETING_CAMPAIGN_STATUS.ARCHIVED,
});

export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, action } = await params;
    const normalizedAction = String(action || '').trim().toLowerCase();
    const toStatus = VALID_ACTIONS[normalizedAction];

    if (!toStatus) {
      return NextResponse.json(
        { success: false, error: 'Invalid action; expected activate|pause|complete|archive' },
        { status: 400 }
      );
    }

    const result = await transitionCampaignStatus(prisma, {
      admin,
      id,
      status: toStatus,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to transition campaign' },
        { status: result.statusCode === 404 ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Marketing campaign action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transition marketing campaign' },
      { status: 500 }
    );
  }
}
