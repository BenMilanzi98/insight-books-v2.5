import prisma from '../prisma.js';
import { TAX_PERIOD_STATUS, TAX_RETURN_STATUS, modelsAvailable } from './periodStatuses.js';
import { markPeriodFiled } from './taxPeriodService.js';
import { sumAccumulatedTax } from './taxTransactionSubledger.js';

function requireReturns(db) {
  if (!modelsAvailable(db, 'taxReturn')) {
    const err = new Error('TaxReturn unavailable. Run prisma migrate + generate.');
    err.code = 'RETURN_UNAVAILABLE';
    throw err;
  }
}

export async function listTaxReturns({ tenantId, taxPeriodId = null, db = prisma }) {
  requireReturns(db);
  return db.taxReturn.findMany({
    where: {
      tenantId,
      ...(taxPeriodId ? { taxPeriodId } : {}),
    },
    include: {
      taxPeriod: { select: { id: true, code: true, label: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTaxReturnDraft({
  tenantId,
  userId,
  taxPeriodId,
  returnType = 'VAT',
  notes = null,
  db = prisma,
}) {
  requireReturns(db);
  const period = await db.taxPeriod.findFirst({ where: { id: taxPeriodId, tenantId } });
  if (!period) {
    const err = new Error('Tax period not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const output = await sumAccumulatedTax({
    tenantId,
    purpose: 'VAT_OUTPUT',
    startDate: period.startDate,
    endDate: period.endDate,
    db,
  });
  const input = await sumAccumulatedTax({
    tenantId,
    purpose: 'VAT_INPUT',
    startDate: period.startDate,
    endDate: period.endDate,
    db,
  });

  // Fallback: use payable-style signed total when purpose projection is empty
  let outputTax = output.available ? Math.max(0, -Number(output.total || 0)) : 0;
  let inputTax = input.available ? Math.max(0, Number(input.total || 0)) : 0;

  if (!output.available || (outputTax === 0 && inputTax === 0)) {
    const payable = await sumAccumulatedTax({
      tenantId,
      purpose: 'TAX_PAYABLE',
      startDate: period.startDate,
      endDate: period.endDate,
      db,
    });
    if (payable.available) {
      outputTax = Math.abs(Number(payable.total || 0));
    }
  }

  const netTax = Number((outputTax - inputTax).toFixed(2));

  return db.taxReturn.create({
    data: {
      tenantId,
      taxPeriodId,
      returnType,
      status: TAX_RETURN_STATUS.DRAFT,
      outputTax,
      inputTax,
      netTax,
      notes,
      createdById: userId || null,
      snapshot: {
        generatedAt: new Date().toISOString(),
        periodCode: period.code,
        subledgerAvailable: Boolean(output.available || input.available),
      },
    },
    include: { taxPeriod: true },
  });
}

export async function markTaxReturnReady({ tenantId, returnId, db = prisma }) {
  requireReturns(db);
  const row = await db.taxReturn.findFirst({ where: { id: returnId, tenantId } });
  if (!row) {
    const err = new Error('Tax return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.status !== TAX_RETURN_STATUS.DRAFT) {
    const err = new Error(`Cannot mark ready from status ${row.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxReturn.update({
    where: { id: row.id },
    data: { status: TAX_RETURN_STATUS.READY },
  });
}

/**
 * Filing records status only — does not create journals.
 */
export async function fileTaxReturn({ tenantId, userId, returnId, reference = null, db = prisma }) {
  requireReturns(db);
  const row = await db.taxReturn.findFirst({
    where: { id: returnId, tenantId },
    include: { taxPeriod: true },
  });
  if (!row) {
    const err = new Error('Tax return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (![TAX_RETURN_STATUS.DRAFT, TAX_RETURN_STATUS.READY].includes(row.status)) {
    const err = new Error(`Cannot file return in status ${row.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const filed = await db.taxReturn.update({
    where: { id: row.id },
    data: {
      status: TAX_RETURN_STATUS.FILED,
      filedAt: new Date(),
      filedById: userId || null,
      reference: reference || row.reference || `RET-${row.taxPeriod?.code || row.id.slice(0, 8)}`,
    },
    include: { taxPeriod: true },
  });

  if (row.taxPeriod && row.taxPeriod.status !== TAX_PERIOD_STATUS.FILED) {
    await markPeriodFiled({ tenantId, periodId: row.taxPeriodId, db });
  }

  return filed;
}

export async function createTaxReturnAmendment({
  tenantId,
  userId,
  returnId,
  amendmentReason,
  db = prisma,
}) {
  requireReturns(db);
  if (!amendmentReason || String(amendmentReason).trim().length < 5) {
    const err = new Error('amendmentReason is required (min 5 chars)');
    err.code = 'INVALID_REASON';
    throw err;
  }
  const original = await db.taxReturn.findFirst({
    where: { id: returnId, tenantId },
  });
  if (!original) {
    const err = new Error('Tax return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (original.status !== TAX_RETURN_STATUS.FILED) {
    const err = new Error('Only filed returns can be amended');
    err.code = 'INVALID_STATUS';
    throw err;
  }

  await db.taxReturn.update({
    where: { id: original.id },
    data: { status: TAX_RETURN_STATUS.AMENDED },
  });

  return db.taxReturn.create({
    data: {
      tenantId,
      taxPeriodId: original.taxPeriodId,
      returnType: original.returnType,
      status: TAX_RETURN_STATUS.DRAFT,
      outputTax: original.outputTax,
      inputTax: original.inputTax,
      netTax: original.netTax,
      amendedFromId: original.id,
      amendmentReason: String(amendmentReason).trim(),
      createdById: userId || null,
      snapshot: {
        amendedFromId: original.id,
        generatedAt: new Date().toISOString(),
      },
    },
    include: { taxPeriod: true, amendedFrom: true },
  });
}
