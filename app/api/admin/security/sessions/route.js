import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * No persisted admin session store in schema — return honest empty list.
 * Never invent mock users/sessions.
 */
function authorize(admin) {
  return (
    adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.view) ||
    adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.manageSessions)
  );
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!authorize(admin)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      sessions: [],
      total: 0,
      source: 'none',
      message: 'No persisted admin session store',
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Admin session creation is not supported; no persisted session store',
    },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Bulk session termination is not supported; no persisted session store',
    },
    { status: 501 }
  );
}
