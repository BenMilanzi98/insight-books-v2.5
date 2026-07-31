import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { createAccount, listAccounts } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listAccounts(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM accounts list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM accounts' },
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
    const result = await createAccount(prisma, {
      admin,
      displayName: body.displayName,
      type: body.type,
      status: body.status,
      country: body.country || null,
      region: body.region || null,
      ownerAdminId: body.ownerAdminId || null,
      customerId: body.customerId || null,
      tenantId: body.tenantId || null,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create account', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, account: result.account, accountNumber: result.account?.accountNumber },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM accounts create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM account' },
      { status: 500 }
    );
  }
}
