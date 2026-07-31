import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  getMraEisFiscalNumberContractRegistry,
  resolveFiscalNumberContract,
  getOnlineOfflineNumberPolicy,
  reconcileFiscalSequenceScope,
  getLastOnlineTransaction,
  getLastOfflineTransaction,
} from '@/lib/mraEis';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const environment = (searchParams.get('environment') || 'SANDBOX').toUpperCase();

  if (id) {
    const seq = await prisma.mraEisFiscalSequenceScope.findFirst({
      where: { id, tenantId: user.tenantId, businessId: user.tenantId },
    });
    if (!seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    const reservations = await prisma.mraEisFiscalNumberReservation.findMany({
      where: { sequenceScopeId: seq.id, tenantId: user.tenantId },
      orderBy: { reservationValue: 'asc' },
      take: 100,
    });
    return NextResponse.json({
      sequence: seq,
      reservations,
      note: 'nextValue is not editable. Direct sequence edits are prohibited.',
      mraAccepted: false,
    });
  }

  const sequences = await prisma.mraEisFiscalSequenceScope.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    sequences,
    contract: resolveFiscalNumberContract({ environment }),
    registry: getMraEisFiscalNumberContractRegistry(),
    onlineOffline: getOnlineOfflineNumberPolicy(),
    note: 'Production MRA fiscal numbers remain blocked until contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action || new URL(request.url).searchParams.get('action');

    // Hard reject client attempts to set next number
    if (body.nextValue != null || body.setNextNumber != null || body.fiscalNumber) {
      return NextResponse.json(
        {
          error: 'Direct nextValue / fiscal number assignment is prohibited.',
          code: 'SEQUENCE_EDIT_PROHIBITED',
        },
        { status: 400 }
      );
    }

    if (action === 'reconcile') {
      if (!body.sequenceScopeId) {
        return NextResponse.json({ error: 'sequenceScopeId required' }, { status: 400 });
      }
      const result = await reconcileFiscalSequenceScope({
        tenantId: user.tenantId,
        businessId: user.tenantId,
        sequenceScopeId: body.sequenceScopeId,
      });
      return NextResponse.json({ success: true, reconciliation: result });
    }

    if (action === 'pause') {
      if (!body.sequenceScopeId) {
        return NextResponse.json({ error: 'sequenceScopeId required' }, { status: 400 });
      }
      const updated = await prisma.mraEisFiscalSequenceScope.updateMany({
        where: {
          id: body.sequenceScopeId,
          tenantId: user.tenantId,
          businessId: user.tenantId,
          status: 'ACTIVE',
        },
        data: { status: 'PAUSED' },
      });
      return NextResponse.json({
        success: updated.count === 1,
        message: updated.count === 1 ? 'Sequence paused.' : 'Sequence not paused.',
      });
    }

    if (action === 'last-online' || action === 'last-offline') {
      const result =
        action === 'last-online'
          ? await getLastOnlineTransaction({ tenantId: user.tenantId })
          : await getLastOfflineTransaction({ tenantId: user.tenantId });
      return NextResponse.json({ success: false, ...result });
    }

    if (action === 'initialize-request') {
      return NextResponse.json({
        success: false,
        blocked: true,
        code: 'SEQUENCE_INIT_REQUIRES_VERIFIED_EVIDENCE',
        message:
          'Production sequence initialization requires verified MRA evidence. Arbitrary user values are rejected. Local invoice counts are not used.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('fiscal-sequences:', err);
    return NextResponse.json({ error: 'Fiscal sequence action failed' }, { status: 500 });
  }
}
