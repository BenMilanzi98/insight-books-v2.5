import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { mockRetiredResponse } from '@/lib/admin/mockRetired';

/**
 * Backup orchestration is external — never invent backup file lists.
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
      backups: [],
      total: 0,
      source: 'none',
      message:
        'Backup orchestration is external to this application. No in-app backup catalog is available.',
    });
  } catch (error) {
    console.error('Admin backups error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backups data' },
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
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.manageIncidents)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      {
        ...mockRetiredResponse('In-app backup creation'),
        message:
          'Backup creation is not performed by this API. Use your external DB/host backup tooling.',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Admin backup creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}
