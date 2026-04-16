import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { validateSystemCoaPayload } from '@/lib/systemCoaPayload';
import { applySystemCoaPayloadToAllTenants } from '@/lib/applySystemCoaToAllTenants';

const DEFAULT_ID = 'default';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let payload = body.payload;

    if (!payload) {
      const row = await prisma.systemCoaDefinition.findUnique({
        where: { id: DEFAULT_ID },
      });
      if (!row?.payload) {
        return NextResponse.json({ error: 'No system CoA definition saved yet' }, { status: 400 });
      }
      payload = row.payload;
    }

    const validated = validateSystemCoaPayload(payload);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const result = await applySystemCoaPayloadToAllTenants(prisma, validated.payload);

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'APPLY_SYSTEM_COA_ALL_TENANTS',
        entityType: 'SystemCoaDefinition',
        entityId: DEFAULT_ID,
        details: JSON.stringify({
          tenantCount: result.tenantCount,
          successCount: result.successCount,
          failureCount: result.failures.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('admin system-coa apply:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to apply system chart of accounts' },
      { status: 500 }
    );
  }
}
