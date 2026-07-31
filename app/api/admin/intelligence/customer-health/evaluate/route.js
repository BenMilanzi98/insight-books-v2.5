import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  evaluateCustomerHealth,
  persistHealthSnapshot,
  resolveHealthAccess,
} from '@/lib/admin/health';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || body.tenant_id;
    const persist = Boolean(body.persist || body.snapshot);
    const asOf = body.asOf || undefined;
    const definitionVersion = body.definitionVersion || undefined;
    const currency = body.currency || 'MWK';

    const evaluation = await evaluateCustomerHealth(prisma, {
      admin,
      tenantId,
      asOf,
      definitionVersion,
      currency,
    });

    if (evaluation.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (evaluation.notFound) {
      return NextResponse.json(
        { success: false, error: evaluation.error || 'Customer not found' },
        { status: 404 }
      );
    }

    if (!evaluation.ok) {
      return NextResponse.json(
        { success: false, error: evaluation.error || 'Evaluation failed' },
        { status: 400 }
      );
    }

    let snapshot = null;
    if (persist) {
      const access = resolveHealthAccess(admin);
      if (!access.canRebuild) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rebuild/persist requires customerHealth.rebuild',
            evaluation,
          },
          { status: 403 }
        );
      }
      snapshot = await persistHealthSnapshot(prisma, evaluation);
    }

    return NextResponse.json({ success: true, evaluation, snapshot });
  } catch (error) {
    console.error('customer-health evaluate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate customer health' },
      { status: 500 }
    );
  }
}
