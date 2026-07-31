/**
 * Refunds, credits, withholding remittance registers (Wave 4).
 * Refund/withholding posting uses existing tax settlement / V2 path when accounts provided;
 * register rows are the SoT for workflow status (filing does not invent balances).
 */

import prisma from '../prisma.js';
import {
  TAX_CREDIT_STATUS,
  TAX_REFUND_STATUS,
  TAX_WITHHOLDING_STATUS,
  modelsAvailable,
} from './periodStatuses.js';

function unavailable(model) {
  const err = new Error(`${model} unavailable. Run prisma migrate + generate.`);
  err.code = 'OPS_UNAVAILABLE';
  throw err;
}

// —— Refunds ——

export async function listTaxRefunds({ tenantId, db = prisma }) {
  if (!modelsAvailable(db, 'taxRefund')) return [];
  return db.taxRefund.findMany({
    where: { tenantId },
    include: { taxPeriod: { select: { id: true, code: true, label: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function createTaxRefundDraft({
  tenantId,
  userId,
  amount,
  taxPeriodId = null,
  taxTypeId = null,
  reason = null,
  notes = null,
  paymentAccountId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxRefund')) unavailable('TaxRefund');
  const amt = Number(amount);
  if (!(amt > 0)) {
    const err = new Error('amount must be greater than zero');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return db.taxRefund.create({
    data: {
      tenantId,
      taxPeriodId,
      taxTypeId,
      status: TAX_REFUND_STATUS.DRAFT,
      amount: amt,
      reason,
      notes,
      paymentAccountId,
      createdById: userId || null,
    },
  });
}

export async function markTaxRefundPosted({
  tenantId,
  userId,
  refundId,
  refundDate = new Date(),
  journalEntryId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxRefund')) unavailable('TaxRefund');
  const row = await db.taxRefund.findFirst({ where: { id: refundId, tenantId } });
  if (!row) {
    const err = new Error('Tax refund not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status !== TAX_REFUND_STATUS.DRAFT) {
    const err = new Error(`Cannot post refund in status ${row.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxRefund.update({
    where: { id: row.id },
    data: {
      status: TAX_REFUND_STATUS.POSTED,
      refundDate: new Date(refundDate),
      postedAt: new Date(),
      postedById: userId || null,
      journalEntryId,
    },
  });
}

// —— Credits ——

export async function listTaxCredits({ tenantId, db = prisma }) {
  if (!modelsAvailable(db, 'taxCredit')) return [];
  return db.taxCredit.findMany({
    where: { tenantId },
    include: { taxPeriod: { select: { id: true, code: true, label: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function createTaxCredit({
  tenantId,
  userId,
  amount,
  taxPeriodId = null,
  taxTypeId = null,
  source = null,
  reference = null,
  notes = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxCredit')) unavailable('TaxCredit');
  const amt = Number(amount);
  if (!(amt > 0)) {
    const err = new Error('amount must be greater than zero');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return db.taxCredit.create({
    data: {
      tenantId,
      taxPeriodId,
      taxTypeId,
      status: TAX_CREDIT_STATUS.OPEN,
      amount: amt,
      remaining: amt,
      source,
      reference,
      notes,
      createdById: userId || null,
    },
  });
}

export async function applyTaxCredit({
  tenantId,
  creditId,
  amount,
  appliedToPaymentId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxCredit')) unavailable('TaxCredit');
  const row = await db.taxCredit.findFirst({ where: { id: creditId, tenantId } });
  if (!row) {
    const err = new Error('Tax credit not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status !== TAX_CREDIT_STATUS.OPEN) {
    const err = new Error(`Cannot apply credit in status ${row.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const applyAmt = Number(amount);
  const remaining = Number(row.remaining);
  if (!(applyAmt > 0) || applyAmt > remaining + 1e-9) {
    const err = new Error('Invalid apply amount');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  const nextRemaining = Number((remaining - applyAmt).toFixed(2));
  return db.taxCredit.update({
    where: { id: row.id },
    data: {
      remaining: nextRemaining,
      status: nextRemaining <= 0 ? TAX_CREDIT_STATUS.APPLIED : TAX_CREDIT_STATUS.OPEN,
      appliedAt: new Date(),
      appliedToPaymentId,
    },
  });
}

export async function voidTaxCredit({ tenantId, creditId, db = prisma }) {
  if (!modelsAvailable(db, 'taxCredit')) unavailable('TaxCredit');
  const row = await db.taxCredit.findFirst({ where: { id: creditId, tenantId } });
  if (!row) {
    const err = new Error('Tax credit not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status === TAX_CREDIT_STATUS.APPLIED) {
    const err = new Error('Fully applied credits cannot be voided');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxCredit.update({
    where: { id: row.id },
    data: {
      status: TAX_CREDIT_STATUS.VOID,
      voidedAt: new Date(),
      remaining: 0,
    },
  });
}

// —— Withholding ——

export async function listWithholdingRemittances({ tenantId, db = prisma }) {
  if (!modelsAvailable(db, 'taxWithholdingRemittance')) return [];
  return db.taxWithholdingRemittance.findMany({
    where: { tenantId },
    include: { taxPeriod: { select: { id: true, code: true, label: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function createWithholdingDraft({
  tenantId,
  userId,
  amount,
  taxPeriodId = null,
  counterparty = null,
  reference = null,
  notes = null,
  paymentAccountId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxWithholdingRemittance')) unavailable('TaxWithholdingRemittance');
  const amt = Number(amount);
  if (!(amt > 0)) {
    const err = new Error('amount must be greater than zero');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return db.taxWithholdingRemittance.create({
    data: {
      tenantId,
      taxPeriodId,
      status: TAX_WITHHOLDING_STATUS.DRAFT,
      amount: amt,
      counterparty,
      reference,
      notes,
      paymentAccountId,
      createdById: userId || null,
    },
  });
}

export async function markWithholdingRemitted({
  tenantId,
  userId,
  remittanceId,
  remittanceDate = new Date(),
  journalEntryId = null,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxWithholdingRemittance')) unavailable('TaxWithholdingRemittance');
  const row = await db.taxWithholdingRemittance.findFirst({
    where: { id: remittanceId, tenantId },
  });
  if (!row) {
    const err = new Error('Withholding remittance not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status !== TAX_WITHHOLDING_STATUS.DRAFT) {
    const err = new Error(`Cannot remit in status ${row.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxWithholdingRemittance.update({
    where: { id: row.id },
    data: {
      status: TAX_WITHHOLDING_STATUS.REMITTED,
      remittanceDate: new Date(remittanceDate),
      postedAt: new Date(),
      postedById: userId || null,
      journalEntryId,
    },
  });
}
