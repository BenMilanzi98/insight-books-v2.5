import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { buildRevenueSettingsPayload } from '@/lib/admin/revenue';

function canAccess(admin) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  });
  const intel = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  });
  return view.allowed || intel.allowed;
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccess(admin)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const payload = buildRevenueSettingsPayload();
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('revenue settings GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load revenue settings' },
      { status: 500 }
    );
  }
}

/** Settings writes are not implemented in Wave 4 — read-only config. */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccess(admin)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Not implemented',
        message:
          'Revenue workbench settings are read-only. Default currency MWK; FX consolidation UNAVAILABLE.',
        config: buildRevenueSettingsPayload().config,
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('revenue settings POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update revenue settings' },
      { status: 500 }
    );
  }
}
