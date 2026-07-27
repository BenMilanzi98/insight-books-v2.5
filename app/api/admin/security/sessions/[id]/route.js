import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * No persisted session store — do not fake termination success.
 */
export async function DELETE(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.manageSessions) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.view)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Session termination is not available: no persisted admin session store exists to revoke',
        sessionId: id,
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error terminating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to terminate session' },
      { status: 500 }
    );
  }
}
