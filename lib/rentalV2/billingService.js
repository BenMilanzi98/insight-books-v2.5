import prisma from '@/lib/prisma';
import { parseMoney } from '@/lib/money';
import { billingIdempotencyKey, computePeriodAmount } from './billing.js';
import { getContract } from './contractService.js';
import { CONTRACT_STATUS } from './contractState.js';

/**
 * Record a billed period uniquely (no duplicate invoice for same period+version).
 * Invoice creation can be wired later; this persists the uniqueness gate.
 */
export async function billContractPeriod({
  tenantId,
  contractId,
  periodStart,
  periodEnd,
  invoiceId,
  amount,
}) {
  const contract = await getContract({ tenantId, contractId });
  const start = periodStart ? new Date(periodStart) : new Date(contract.startAt);
  const end = periodEnd ? new Date(periodEnd) : new Date(contract.endAt);
  const pricingVersion = contract.pricingVersion || 1;
  const idempotencyKey = billingIdempotencyKey({
    tenantId,
    contractId,
    periodStart: start,
    periodEnd: end,
    pricingVersion,
  });

  const existing = await prisma.rentalBillingPeriod.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
  });
  if (existing) return { period: existing, duplicate: true };

  const billedAmount =
    amount != null ? parseMoney(amount) : computePeriodAmount(contract, { periodStart: start, periodEnd: end });

  try {
    const period = await prisma.rentalBillingPeriod.create({
      data: {
        tenantId,
        contractId,
        periodStart: start,
        periodEnd: end,
        pricingVersion,
        amount: billedAmount,
        invoiceId: invoiceId || null,
        status: invoiceId ? 'INVOICED' : 'BILLED',
        idempotencyKey,
      },
    });

    await prisma.rentalContract.update({
      where: { id: contractId },
      data: {
        billingStatus: 'BILLED',
        status:
          contract.status === CONTRACT_STATUS.FINAL_BILLING_PENDING
            ? CONTRACT_STATUS.COMPLETED
            : contract.status,
        version: { increment: 1 },
      },
    });

    return { period, duplicate: false };
  } catch (e) {
    if (e?.code === 'P2002') {
      const again = await prisma.rentalBillingPeriod.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      return { period: again, duplicate: true };
    }
    throw e;
  }
}

export async function reconcileContractBilling({ tenantId, contractId }) {
  const contract = await getContract({ tenantId, contractId });
  const periods = contract.billingPeriods || [];
  const charges = (contract.charges || []).filter((c) => c.approvalStatus === 'APPROVED');
  const billed = periods.reduce((s, p) => s + parseMoney(p.amount), 0);
  const chargeTotal = charges.reduce((s, c) => s + parseMoney(c.amount), 0);
  const depositHeld = parseMoney(contract.depositReceived);
  return {
    contractId,
    status: contract.status,
    billingStatus: contract.billingStatus,
    periodCount: periods.length,
    billed,
    approvedCharges: chargeTotal,
    depositReceived: depositHeld,
    estimate: parseMoney(contract.totalEstimate),
  };
}
