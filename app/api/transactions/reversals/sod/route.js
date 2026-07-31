import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { resolveReversalSodPolicy } from '@/lib/reversals';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sod = await resolveReversalSodPolicy({ tenantId: user.tenantId });
    return NextResponse.json({ sod });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, [
      'journal.reverse',
      'journalEntries.update',
      'settings.update',
      'system.update',
    ]);
    if (perm) return perm;

    const body = await request.json();
    if (typeof body.requireSeparateApprover !== 'boolean') {
      return NextResponse.json(
        { error: 'requireSeparateApprover boolean is required' },
        { status: 400 }
      );
    }

    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        reversalRequireSeparateApprover: body.requireSeparateApprover,
      },
      update: {
        reversalRequireSeparateApprover: body.requireSeparateApprover,
      },
      select: { reversalRequireSeparateApprover: true },
    });

    return NextResponse.json({
      success: true,
      sod: {
        requireSeparateApprover: settings.reversalRequireSeparateApprover,
        source: 'tenantSettings',
      },
    });
  } catch (error) {
    console.error('PUT /api/transactions/reversals/sod:', error);
    return NextResponse.json(
      {
        error:
          error.message ||
          'Failed to update SoD setting (run prisma migrate + generate if column missing)',
      },
      { status: 500 }
    );
  }
}
