import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { importTenantIdentityPackage } from '@/lib/admin/tenantIdentity';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pkg = body.package || body;
    const result = await importTenantIdentityPackage(pkg, { commit: false }, prisma);
    return NextResponse.json({ success: result.success, ...result });
  } catch (error) {
    console.error('tenant-identity dry-run error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Dry-run failed' },
      { status: 500 }
    );
  }
}
