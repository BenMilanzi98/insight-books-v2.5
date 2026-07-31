import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { transitionContract } from '@/lib/rentalV2/contractService';
import {
  applyDepositToReceivable,
  createDepositRecord,
  forfeitDeposit,
  receiveDeposit,
  refundDeposit,
} from '@/lib/rentalV2/depositService';
import {
  approveCharge,
  createDispatch,
  createInspection,
  createReturn,
} from '@/lib/rentalV2/operationsService';
import { billContractPeriod } from '@/lib/rentalV2/billingService';
import { invoiceContractPeriod } from '@/lib/rentalV2/invoiceService';

const WRITE_PERMS = ['rentals.create', 'rentals.update', 'invoices.create', 'invoices.update'];

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, WRITE_PERMS);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const body = await request.json().catch(() => ({}));
    const cmd = String(action || '').toLowerCase();

    if (
      ['submit', 'approve', 'readyfordispatch', 'activate', 'cancel', 'complete'].includes(cmd)
    ) {
      const mapped = cmd === 'readyfordispatch' ? 'readyForDispatch' : cmd;
      const contract = await transitionContract({
        tenantId: user.tenantId,
        contractId: id,
        command: mapped,
        userId: user.id,
      });
      return NextResponse.json({ contract });
    }

    if (cmd === 'deposit') {
      const deposit = await createDepositRecord({
        tenantId: user.tenantId,
        contractId: id,
        amount: body.amount,
        depositType: body.depositType,
        idempotencyKey: body.idempotencyKey,
      });
      if (body.receive && body.cashAccountId && body.depositLiabilityAccountId) {
        const result = await receiveDeposit({
          tenantId: user.tenantId,
          userId: user.id,
          depositId: deposit.id,
          amount: body.amount,
          cashAccountId: body.cashAccountId,
          depositLiabilityAccountId: body.depositLiabilityAccountId,
          date: body.date,
        });
        return NextResponse.json(result);
      }
      return NextResponse.json({ deposit });
    }

    if (cmd === 'deposit-refund') {
      if (!body.depositId) {
        return NextResponse.json({ error: 'depositId required' }, { status: 400 });
      }
      const result = await refundDeposit({
        tenantId: user.tenantId,
        userId: user.id,
        depositId: body.depositId,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'deposit-apply') {
      if (!body.depositId) {
        return NextResponse.json({ error: 'depositId required' }, { status: 400 });
      }
      const result = await applyDepositToReceivable({
        tenantId: user.tenantId,
        userId: user.id,
        depositId: body.depositId,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'deposit-forfeit') {
      if (!body.depositId) {
        return NextResponse.json({ error: 'depositId required' }, { status: 400 });
      }
      const result = await forfeitDeposit({
        tenantId: user.tenantId,
        userId: user.id,
        depositId: body.depositId,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'dispatch') {
      const dispatch = await createDispatch({
        tenantId: user.tenantId,
        userId: user.id,
        contractId: id,
        ...body,
      });
      return NextResponse.json({ dispatch });
    }

    if (cmd === 'return') {
      const rentalReturn = await createReturn({
        tenantId: user.tenantId,
        userId: user.id,
        contractId: id,
        ...body,
      });
      return NextResponse.json({ return: rentalReturn });
    }

    if (cmd === 'inspect') {
      if (!body.returnId) {
        return NextResponse.json({ error: 'returnId required' }, { status: 400 });
      }
      const result = await createInspection({
        tenantId: user.tenantId,
        userId: user.id,
        ...body,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'approve-charge') {
      if (!body.chargeId) {
        return NextResponse.json({ error: 'chargeId required' }, { status: 400 });
      }
      const charge = await approveCharge({
        tenantId: user.tenantId,
        chargeId: body.chargeId,
        userId: user.id,
      });
      return NextResponse.json({ charge });
    }

    if (cmd === 'bill') {
      // Prefer full invoice+post when createInvoice !== false
      if (body.createInvoice === false) {
        const result = await billContractPeriod({
          tenantId: user.tenantId,
          contractId: id,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          invoiceId: body.invoiceId,
          amount: body.amount,
        });
        return NextResponse.json(result);
      }
      const result = await invoiceContractPeriod({
        tenantId: user.tenantId,
        userId: user.id,
        contractId: id,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        taxRatePercent: body.taxRatePercent,
        notes: body.notes,
        includeApprovedCharges: body.includeApprovedCharges !== false,
      });
      return NextResponse.json(result);
    }

    if (cmd === 'invoice') {
      const result = await invoiceContractPeriod({
        tenantId: user.tenantId,
        userId: user.id,
        contractId: id,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        taxRatePercent: body.taxRatePercent,
        notes: body.notes,
        includeApprovedCharges: body.includeApprovedCharges !== false,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    console.error('rentals-v2 contract action', e);
    return NextResponse.json({ error: e.message || 'Action failed' }, { status: 400 });
  }
}
