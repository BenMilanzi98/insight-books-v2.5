import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';

/**
 * Diagnostic endpoint — admin-only. Previously unauthenticated (SECURITY_RISK).
 */
export async function DELETE(request) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'DELETE method is working',
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'Test endpoint is working',
    methods: ['GET', 'DELETE'],
  });
}
