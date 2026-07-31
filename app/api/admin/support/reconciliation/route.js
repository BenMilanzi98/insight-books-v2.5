import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { getSupportReconciliation, runSupportReconciliation } from '@/lib/admin/support';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getSupportReconciliation(prisma, { admin });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support reconciliation GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load support reconciliation' },
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
    const result = await runSupportReconciliation(prisma, {
      admin,
      persist: body.persist !== false,
      ticketLimit: body.ticketLimit,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support reconciliation POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run support reconciliation' },
      { status: 500 }
    );
  }
}
