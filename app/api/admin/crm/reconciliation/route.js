import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { runCrmReconciliation } from '@/lib/admin/crm';

export async function GET(request) {
  return run(request, false);
}

export async function POST(request) {
  return run(request, true);
}

async function run(request, persist) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runCrmReconciliation(prisma, {
      admin,
      persist,
    });

    if (result.forbidden) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient admin privileges',
          reason: result.reason,
          status: result.status,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM reconciliation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run CRM reconciliation' },
      { status: 500 }
    );
  }
}
