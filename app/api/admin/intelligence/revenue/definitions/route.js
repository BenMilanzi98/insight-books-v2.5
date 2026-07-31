import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { buildRevenueDefinitionsPayload } from '@/lib/admin/revenue';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const view = authorizeAdminDecision({
      admin,
      permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
    });
    const intel = authorizeAdminDecision({
      admin,
      permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
    });
    if (!view.allowed && !intel.allowed) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const payload = buildRevenueDefinitionsPayload();
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('revenue definitions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load revenue definitions' },
      { status: 500 }
    );
  }
}
