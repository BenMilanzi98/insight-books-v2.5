import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  listPaychanguBackfillPlan,
  runPaychanguLedgerBackfill,
} from '@/lib/admin/paychanguLedgerBackfill';

/**
 * GET — dry-run plan of historical PayChangu ledger gaps.
 * POST — { dryRun?: boolean, limit?: number, maxExecute?: number }
 *         Default dryRun=true. Execute requires reconciliation permission.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const plan = await listPaychanguBackfillPlan(prisma, { limit });

    return NextResponse.json({
      success: true,
      dryRun: true,
      ...plan,
      note:
        'Dry-run only. POST with dryRun:false to execute (billing.reconciliation). Covers account+branch, orphan link, create_payment; unmatched orphans reported only.',
    });
  } catch (error) {
    console.error('paychangu-backfill GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to plan PayChangu ledger backfill',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
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

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const limit = parseInt(body?.limit || '100', 10);
    const maxExecute = parseInt(body?.maxExecute || '50', 10);

    if (!dryRun) {
      if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Executing backfill requires systemAdmin.billing.reconciliation',
          },
          { status: 403 }
        );
      }
    } else if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const result = await runPaychanguLedgerBackfill(prisma, {
      dryRun,
      limit,
      maxExecute,
    });

    return NextResponse.json({
      success: result.ok || result.dryRun === true,
      ...result,
    });
  } catch (error) {
    console.error('paychangu-backfill POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run PayChangu ledger backfill',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
