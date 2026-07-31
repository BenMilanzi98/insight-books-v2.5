import prisma from '@/lib/prisma';
import { addMoney, parseMoney } from '@/lib/money';
import { remainingDeposit } from './depositAccounting.js';
import { reconcileContractBilling } from './billingService.js';
import { reconcileHireAgreement } from '@/lib/hiringV2/hireService.js';

/**
 * Tenant-wide rental + hire reconciliation snapshot.
 */
export async function reconcileRentalHiringTenant({ tenantId }) {
  const [
    contracts,
    openDeposits,
    unbilledCharges,
    hireAgreements,
    openAccruals,
    billingPeriods,
  ] = await Promise.all([
    prisma.rentalContract.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED'] } },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        billingStatus: true,
        totalEstimate: true,
        depositReceived: true,
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.rentalDeposit.findMany({
      where: { tenantId, status: { in: ['PENDING', 'HELD'] } },
      take: 100,
    }),
    prisma.rentalCharge.findMany({
      where: { tenantId, approvalStatus: 'APPROVED', billingStatus: 'UNBILLED' },
      take: 100,
    }),
    prisma.hireAgreement.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED'] } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.hireAccrual.findMany({
      where: { tenantId, status: 'ACCRUED' },
      take: 100,
    }),
    prisma.rentalBillingPeriod.findMany({
      where: { tenantId },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const issues = [];
  const depositLiabilityOpen = openDeposits.reduce(
    (s, d) => addMoney(s, remainingDeposit(d)),
    0
  );
  const unbilledChargeTotal = unbilledCharges.reduce((s, c) => addMoney(s, c.amount), 0);
  const accruedHireOpen = openAccruals.reduce((s, a) => addMoney(s, a.amount), 0);
  const invoicedPeriods = billingPeriods.filter((p) => p.invoiceId);
  const billedWithoutInvoice = billingPeriods.filter(
    (p) => !p.invoiceId && p.status !== 'INVOICED'
  );

  for (const c of contracts) {
    if (c.status === 'FINAL_BILLING_PENDING' && c.billingStatus === 'UNBILLED') {
      issues.push({
        severity: 'high',
        type: 'CONTRACT_AWAITING_BILL',
        id: c.id,
        message: `${c.contractNumber} awaiting final bill`,
      });
    }
    if (c.status === 'DEPOSIT_PENDING' && parseMoney(c.depositReceived) <= 0) {
      issues.push({
        severity: 'medium',
        type: 'DEPOSIT_PENDING',
        id: c.id,
        message: `${c.contractNumber} deposit still pending`,
      });
    }
  }

  for (const p of billedWithoutInvoice) {
    issues.push({
      severity: 'high',
      type: 'BILLING_WITHOUT_INVOICE',
      id: p.id,
      message: `Billing period ${p.id} recorded without customer invoice`,
    });
  }

  for (const a of openAccruals) {
    issues.push({
      severity: 'medium',
      type: 'HIRE_ACCRUAL_OPEN',
      id: a.id,
      message: `Hire accrual ${a.id} not cleared to supplier bill`,
    });
  }

  for (const c of unbilledCharges) {
    issues.push({
      severity: 'medium',
      type: 'UNBILLED_CHARGE',
      id: c.id,
      message: `Approved ${c.chargeType} charge ${c.id} not yet invoiced`,
    });
  }

  return {
    summary: {
      contractCount: contracts.length,
      hireAgreementCount: hireAgreements.length,
      depositLiabilityOpen: parseMoney(depositLiabilityOpen),
      unbilledChargeTotal: parseMoney(unbilledChargeTotal),
      accruedHireOpen: parseMoney(accruedHireOpen),
      invoicedPeriodCount: invoicedPeriods.length,
      issueCount: issues.length,
    },
    contracts: contracts.slice(0, 50),
    hireAgreements: hireAgreements.slice(0, 50),
    issues,
  };
}

export async function reconcileContractDetail({ tenantId, contractId }) {
  return reconcileContractBilling({ tenantId, contractId });
}

export async function reconcileHireDetail({ tenantId, agreementId }) {
  return reconcileHireAgreement({ tenantId, agreementId });
}
