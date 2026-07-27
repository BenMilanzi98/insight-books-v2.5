import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { mockRetiredResponse } from '@/lib/admin/mockRetired';

/**
 * Platform update catalog is not persisted in this app.
 * Return honest empty — never invent security patches.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      updates: [],
      total: 0,
      source: 'none',
      message:
        'No in-app update registry. Deployments are managed outside InsightBooks admin.',
    });
  } catch (error) {
    console.error('updates GET:', error);
    return NextResponse.json(mockRetiredResponse('Platform updates'), { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'In-app update install is not supported',
      mockRetired: true,
    },
    { status: 501 }
  );
}
