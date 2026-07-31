import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  accrueHireCost,
  approveHireUsage,
  clearHireAccrualAgainstBill,
  paySupplierDeposit,
  recordHireDelivery,
  recordHireUsage,
  transitionHireAgreement,
} from '@/lib/hiringV2/hireService';

const WRITE = ['rentals.update', 'purchases.create', 'purchases.update', 'purchases.approve'];

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, WRITE);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const body = await request.json().catch(() => ({}));
    const cmd = String(action || '').toLowerCase();

    if (['approve', 'activate', 'complete', 'cancel'].includes(cmd)) {
      const agreement = await transitionHireAgreement({
        tenantId: user.tenantId,
        agreementId: id,
        command: cmd,
      });
      return NextResponse.json({ agreement });
    }

    if (cmd === 'delivery') {
      const delivery = await recordHireDelivery({
        tenantId: user.tenantId,
        agreementId: id,
        ...body,
      });
      return NextResponse.json({ delivery });
    }

    if (cmd === 'usage') {
      const usage = await recordHireUsage({
        tenantId: user.tenantId,
        agreementId: id,
        ...body,
      });
      return NextResponse.json({ usage });
    }

    if (cmd === 'approve-usage') {
      if (!body.usageId) {
        return NextResponse.json({ error: 'usageId required' }, { status: 400 });
      }
      const usage = await approveHireUsage({
        tenantId: user.tenantId,
        usageId: body.usageId,
      });
      return NextResponse.json({ usage });
    }

    if (cmd === 'accrue') {
      const result = await accrueHireCost({
        tenantId: user.tenantId,
        userId: user.id,
        agreementId: id,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'deposit') {
      const result = await paySupplierDeposit({
        tenantId: user.tenantId,
        userId: user.id,
        agreementId: id,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'clear-accrual') {
      if (!body.accrualId || !body.supplierBillId) {
        return NextResponse.json(
          { error: 'accrualId and supplierBillId required' },
          { status: 400 }
        );
      }
      const result = await clearHireAccrualAgainstBill({
        tenantId: user.tenantId,
        userId: user.id,
        agreementId: id,
        ...body,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    console.error('hiring-v2 agreement action', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
