import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { mockRetiredResponse } from '@/lib/admin/mockRetired';

/**
 * Legacy mock reports endpoint retired.
 * Use /api/admin/platform-reports instead.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.dashboard.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.audit.view)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      {
        ...mockRetiredResponse('Admin reports'),
        migrateTo: '/api/admin/platform-reports',
        message:
          'This mock reports API is gone. Use /api/admin/platform-reports for platform reporting.',
      },
      { status: 410 }
    );
  } catch (error) {
    console.error('Admin reports fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
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

    return NextResponse.json(
      {
        ...mockRetiredResponse('Admin report generation'),
        migrateTo: '/api/admin/platform-reports',
        message:
          'Report generation via this mock endpoint is retired. Use /api/admin/platform-reports.',
      },
      { status: 410 }
    );
  } catch (error) {
    console.error('Admin report generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
