import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  postOpeningBalance,
  setOpeningBalancesStartingDate,
  getOpeningBalancesStartingDate,
  OPENING_BALANCE_TYPES,
} from '@/lib/openingBalanceService';
import { buildOpeningBalanceStatusReport } from '@/lib/openingBalanceReport';
import { isOpeningBalancesLocked } from '@/lib/openingBalanceLock';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'openingBalances.view',
      'accounts.view',
      'accounts.update',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const report = await buildOpeningBalanceStatusReport(user.tenantId);
    const startingDate = await getOpeningBalancesStartingDate(user.tenantId);

    return NextResponse.json({
      ...report,
      startingDate,
      types: OPENING_BALANCE_TYPES,
    });
  } catch (error) {
    console.error('opening-balances GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'openingBalances.post',
      'openingBalances.manage',
      'accounts.update',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (await isOpeningBalancesLocked(user.tenantId)) {
      return NextResponse.json(
        { error: 'Opening balances are locked after the first accounting period close.' },
        { status: 423 },
      );
    }

    const body = await request.json();

    if (body.action === 'setStartingDate') {
      const date = await setOpeningBalancesStartingDate(
        user.tenantId,
        body.asOfDate || body.startingDate,
        user.id,
      );
      return NextResponse.json({ ok: true, startingDate: date });
    }

    const {
      type,
      accountId,
      entityId,
      amount,
      asOfDate,
      description,
      metadata,
    } = body;

    if (!type || !OPENING_BALANCE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Valid opening balance type is required.' }, { status: 400 });
    }

    const startingDate = await getOpeningBalancesStartingDate(user.tenantId);
    const entryDate = asOfDate || startingDate || new Date();

    const result = await postOpeningBalance({
      tenantId: user.tenantId,
      type,
      accountId: accountId || null,
      entityId: entityId || null,
      amount,
      asOfDate: entryDate,
      description,
      metadata,
      createdBy: user.id,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      idempotencyKey: result.idempotencyKey,
      transactionId: result.transaction?.id || result.batch?.id || null,
      reference: result.transaction?.reference || result.batch?.id || result.idempotencyKey,
    });
  } catch (error) {
    console.error('opening-balances POST:', error);
    const status = error.message?.includes('locked') ? 423 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
