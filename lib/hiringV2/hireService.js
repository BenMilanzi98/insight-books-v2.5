import prisma from '@/lib/prisma';
import { addMoney, parseMoney } from '@/lib/money';
import {
  postHireAccrualClearedAccounting,
  postHireCostAccrualAccounting,
  postHireSupplierDepositAccounting,
} from '@/lib/accountingV2/adapters';
import { makeDocNumber } from '@/lib/rentalV2/numbering.js';
import {
  assertHireAgreementCommand,
  assertHireRequestCommand,
  HIRE_AGREEMENT_STATUS,
  HIRE_REQUEST_STATUS,
} from './hireState.js';

export async function listHireRequests({ tenantId, status, take = 50 }) {
  return prisma.hireRequest.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { agreements: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function createHireRequest({
  tenantId,
  userId,
  description,
  equipmentSpec,
  quantity = 1,
  startAt,
  endAt,
  estimatedCost = 0,
  branchId,
  projectId,
  notes,
}) {
  if (!description) throw new Error('description is required');
  if (!startAt || !endAt) throw new Error('startAt and endAt are required');
  return prisma.hireRequest.create({
    data: {
      tenantId,
      requestNumber: makeDocNumber('HR'),
      requestedById: userId || null,
      description,
      equipmentSpec: equipmentSpec || null,
      quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      estimatedCost: parseMoney(estimatedCost),
      branchId: branchId || null,
      projectId: projectId || null,
      notes: notes || null,
      status: HIRE_REQUEST_STATUS.DRAFT,
    },
  });
}

export async function transitionHireRequest({ tenantId, requestId, command }) {
  const req = await prisma.hireRequest.findFirst({ where: { id: requestId, tenantId } });
  if (!req) throw new Error('Hire request not found');
  const { nextStatus } = assertHireRequestCommand(req.status, command);
  return prisma.hireRequest.update({
    where: { id: requestId },
    data: { status: nextStatus },
  });
}

export async function listHireAgreements({ tenantId, status, take = 50 }) {
  return prisma.hireAgreement.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: {
      hireRequest: true,
      usageRecords: true,
      deliveries: true,
      deposits: true,
      accruals: true,
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getHireAgreement({ tenantId, agreementId }) {
  const a = await prisma.hireAgreement.findFirst({
    where: { id: agreementId, tenantId },
    include: {
      hireRequest: true,
      usageRecords: true,
      deliveries: true,
      deposits: true,
      accruals: true,
    },
  });
  if (!a) throw new Error('Hire agreement not found');
  return a;
}

/**
 * Create agreement — no expense / AP until usage accrual or supplier bill.
 */
export async function createHireAgreement({
  tenantId,
  supplierId,
  hireRequestId,
  startAt,
  endAt,
  estimatedValue = 0,
  accountingPolicy = 'DIRECT_BILL',
  branchId,
  projectId,
  notes,
}) {
  if (!supplierId) throw new Error('supplierId is required');
  if (!startAt || !endAt) throw new Error('startAt and endAt are required');

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new Error('Supplier not found');

  return prisma.$transaction(async (tx) => {
    if (hireRequestId) {
      const req = await tx.hireRequest.findFirst({ where: { id: hireRequestId, tenantId } });
      if (!req) throw new Error('Hire request not found');
      await tx.hireRequest.update({
        where: { id: hireRequestId },
        data: { status: HIRE_REQUEST_STATUS.CONVERTED },
      });
    }

    return tx.hireAgreement.create({
      data: {
        tenantId,
        agreementNumber: makeDocNumber('HA'),
        supplierId,
        hireRequestId: hireRequestId || null,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        estimatedValue: parseMoney(estimatedValue),
        accountingPolicy,
        branchId: branchId || null,
        projectId: projectId || null,
        notes: notes || null,
        status: HIRE_AGREEMENT_STATUS.DRAFT,
      },
    });
  });
}

export async function transitionHireAgreement({ tenantId, agreementId, command }) {
  const a = await getHireAgreement({ tenantId, agreementId });
  const { nextStatus } = assertHireAgreementCommand(a.status, command);
  return prisma.hireAgreement.update({
    where: { id: agreementId },
    data: { status: nextStatus, version: { increment: 1 } },
  });
}

export async function recordHireDelivery({
  tenantId,
  agreementId,
  description,
  serialNumber,
  quantity = 1,
  conditionNotes,
}) {
  const a = await getHireAgreement({ tenantId, agreementId });
  if (![HIRE_AGREEMENT_STATUS.APPROVED, HIRE_AGREEMENT_STATUS.ACTIVE].includes(a.status)) {
    throw new Error(`Cannot receive delivery in status ${a.status}`);
  }
  return prisma.$transaction(async (tx) => {
    const delivery = await tx.hireDelivery.create({
      data: {
        tenantId,
        agreementId,
        description: description || null,
        serialNumber: serialNumber || null,
        quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
        conditionNotes: conditionNotes || null,
        status: 'RECEIVED',
      },
    });
    if (a.status === HIRE_AGREEMENT_STATUS.APPROVED) {
      await tx.hireAgreement.update({
        where: { id: agreementId },
        data: { status: HIRE_AGREEMENT_STATUS.ACTIVE },
      });
    }
    return delivery;
  });
}

export async function recordHireUsage({
  tenantId,
  agreementId,
  usageDate,
  hours = 0,
  quantity = 1,
  notes,
  approved = false,
}) {
  await getHireAgreement({ tenantId, agreementId });
  return prisma.hireUsageRecord.create({
    data: {
      tenantId,
      agreementId,
      usageDate: new Date(usageDate || Date.now()),
      hours: parseMoney(hours),
      quantity: parseMoney(quantity),
      notes: notes || null,
      approved: Boolean(approved),
      billingStatus: 'UNBILLED',
    },
  });
}

export async function approveHireUsage({ tenantId, usageId }) {
  const u = await prisma.hireUsageRecord.findFirst({
    where: { id: usageId, tenantId },
  });
  if (!u) throw new Error('Usage record not found');
  return prisma.hireUsageRecord.update({
    where: { id: usageId },
    data: { approved: true },
  });
}

/**
 * Accrue hire cost for a period (expense once) — unique per agreement+period.
 */
export async function accrueHireCost({
  tenantId,
  userId,
  agreementId,
  periodStart,
  periodEnd,
  amount,
  expenseAccountId,
  accruedLiabilityAccountId,
  date,
  hasPermission,
}) {
  const a = await getHireAgreement({ tenantId, agreementId });
  if (a.accountingPolicy !== 'ACCRUE') {
    throw new Error('Agreement accountingPolicy must be ACCRUE to post accruals');
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const amt = parseMoney(amount);
  if (amt <= 0) throw new Error('Accrual amount must be positive');
  if (!expenseAccountId || !accruedLiabilityAccountId) {
    throw new Error('expenseAccountId and accruedLiabilityAccountId required');
  }

  const idempotencyKey = `hacr:${tenantId}:${agreementId}:${start.toISOString()}:${end.toISOString()}`;
  const existing = await prisma.hireAccrual.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
  });
  if (existing) return { accrual: existing, duplicate: true };

  const unapproved = await prisma.hireUsageRecord.count({
    where: {
      agreementId,
      tenantId,
      approved: false,
      usageDate: { gte: start, lte: end },
    },
  });
  if (unapproved > 0) {
    throw new Error('Approve all usage records in the period before accruing');
  }

  const lines = [
    {
      accountId: expenseAccountId,
      debit: amt,
      credit: 0,
      description: `Hire accrual ${a.agreementNumber}`,
    },
    {
      accountId: accruedLiabilityAccountId,
      debit: 0,
      credit: amt,
      description: 'Accrued hire liability',
    },
  ];

  let accrual;
  try {
    accrual = await prisma.hireAccrual.create({
      data: {
        tenantId,
        agreementId,
        periodStart: start,
        periodEnd: end,
        amount: amt,
        status: 'ACCRUED',
        expenseAccountId,
        accruedLiabilityAccountId,
        idempotencyKey,
      },
    });
  } catch (e) {
    if (e?.code === 'P2002') {
      const again = await prisma.hireAccrual.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      return { accrual: again, duplicate: true };
    }
    throw e;
  }

  const posting = await postHireCostAccrualAccounting({
    db: prisma,
    tenantId,
    userId,
    accrualId: accrual.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Hire cost accrual ${a.agreementNumber}`,
    lines,
    currency: a.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const journalId =
    posting?.journalId || posting?.journal?.id || posting?.result?.journalId || null;
  if (journalId) {
    accrual = await prisma.hireAccrual.update({
      where: { id: accrual.id },
      data: { journalId },
    });
  }

  return { accrual, posting, duplicate: false };
}

/**
 * Clear ACCRUED hire accrual against a supplier bill (Dr Accrued / Cr Expense),
 * so the bill can recognise expense once without double-counting.
 */
export async function clearHireAccrualAgainstBill({
  tenantId,
  userId,
  accrualId,
  supplierBillId,
  expenseAccountId,
  accruedLiabilityAccountId,
  date,
  hasPermission,
}) {
  const accrual = await prisma.hireAccrual.findFirst({
    where: { id: accrualId, tenantId },
    include: { agreement: true },
  });
  if (!accrual) throw new Error('Hire accrual not found');
  if (accrual.status === 'CLEARED') {
    return { accrual, duplicate: true };
  }
  if (accrual.status !== 'ACCRUED') {
    throw new Error(`Cannot clear accrual in status ${accrual.status}`);
  }
  if (!supplierBillId) throw new Error('supplierBillId is required');
  const expenseId = expenseAccountId || accrual.expenseAccountId;
  const liabilityId = accruedLiabilityAccountId || accrual.accruedLiabilityAccountId;
  if (!expenseId || !liabilityId) {
    throw new Error('expenseAccountId and accruedLiabilityAccountId required');
  }

  const bill = await prisma.supplierBill.findFirst({
    where: { id: supplierBillId, tenantId },
  });
  if (!bill) throw new Error('Supplier bill not found');
  if (bill.supplierId !== accrual.agreement.supplierId) {
    throw new Error('Supplier bill supplier does not match hire agreement');
  }

  const amt = parseMoney(accrual.amount);
  const lines = [
    {
      accountId: liabilityId,
      debit: amt,
      credit: 0,
      description: `Clear hire accrual ${accrual.id}`,
    },
    {
      accountId: expenseId,
      debit: 0,
      credit: amt,
      description: 'Reverse accrued hire expense (bill will recognise)',
    },
  ];

  const posting = await postHireAccrualClearedAccounting({
    db: prisma,
    tenantId,
    userId,
    accrualId: accrual.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Clear hire accrual vs bill ${bill.billNumber || bill.id}`,
    lines,
    currency: accrual.agreement.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const clearedJournalId =
    posting?.journalId || posting?.journal?.id || posting?.result?.journalId || null;

  const updated = await prisma.hireAccrual.update({
    where: { id: accrual.id },
    data: {
      status: 'CLEARED',
      supplierBillId,
      clearedJournalId,
      clearedAt: new Date(),
    },
  });

  await prisma.hireAgreement.update({
    where: { id: accrual.agreementId },
    data: {
      billedValue: addMoney(accrual.agreement.billedValue, amt),
      version: { increment: 1 },
    },
  });

  return { accrual: updated, posting, duplicate: false };
}

export async function paySupplierDeposit({
  tenantId,
  userId,
  agreementId,
  amount,
  cashAccountId,
  depositAssetAccountId,
  date,
  idempotencyKey,
  hasPermission,
}) {
  const a = await getHireAgreement({ tenantId, agreementId });
  const amt = parseMoney(amount);
  if (amt <= 0) throw new Error('Deposit amount must be positive');
  if (!cashAccountId || !depositAssetAccountId) {
    throw new Error('cashAccountId and depositAssetAccountId required');
  }

  const key = idempotencyKey || `hdep-${makeDocNumber('HD')}`;
  const existing = await prisma.hireSupplierDeposit.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
  });
  if (existing) return { deposit: existing, duplicate: true };

  const deposit = await prisma.hireSupplierDeposit.create({
    data: {
      tenantId,
      agreementId,
      supplierId: a.supplierId,
      amount: amt,
      paidAmount: 0,
      status: 'PENDING',
      idempotencyKey: key,
    },
  });

  const lines = [
    {
      accountId: depositAssetAccountId,
      debit: amt,
      credit: 0,
      description: 'Supplier hire deposit asset',
    },
    {
      accountId: cashAccountId,
      debit: 0,
      credit: amt,
      description: 'Supplier hire deposit paid',
    },
  ];

  const posting = await postHireSupplierDepositAccounting({
    db: prisma,
    tenantId,
    userId,
    depositId: deposit.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Supplier hire deposit ${a.agreementNumber}`,
    lines,
    currency: a.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const journalId =
    posting?.journalId || posting?.journal?.id || posting?.result?.journalId || null;

  const updated = await prisma.hireSupplierDeposit.update({
    where: { id: deposit.id },
    data: {
      paidAmount: amt,
      status: 'HELD',
      journalId,
    },
  });

  return { deposit: updated, posting, duplicate: false };
}

export async function reconcileHireAgreement({ tenantId, agreementId }) {
  const a = await getHireAgreement({ tenantId, agreementId });
  const usageApproved = (a.usageRecords || []).filter((u) => u.approved);
  const accrued = (a.accruals || []).reduce((s, x) => addMoney(s, x.amount), 0);
  const depositsPaid = (a.deposits || []).reduce((s, d) => addMoney(s, d.paidAmount), 0);
  return {
    agreementId,
    status: a.status,
    accountingPolicy: a.accountingPolicy,
    estimatedValue: parseMoney(a.estimatedValue),
    billedValue: parseMoney(a.billedValue),
    approvedUsageCount: usageApproved.length,
    accrued,
    depositsPaid,
  };
}
