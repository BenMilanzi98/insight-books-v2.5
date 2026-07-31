import prisma from '../prisma.js';
import { TAX_PERIOD_STATUS, modelsAvailable } from './periodStatuses.js';

function requirePeriods(db) {
  if (!modelsAvailable(db, 'taxPeriod')) {
    const err = new Error(
      'TaxPeriod unavailable. Run prisma migrate + generate, then restart the app.'
    );
    err.code = 'PERIOD_UNAVAILABLE';
    throw err;
  }
}

function toYmd(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildMonthlyPeriodBounds(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const code = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
  const label = start.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { start, end, code, label };
}

export async function listTaxPeriods({ tenantId, status = null, db = prisma }) {
  requirePeriods(db);
  return db.taxPeriod.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: { startDate: 'desc' },
    include: {
      _count: { select: { returns: true, payments: true } },
    },
  });
}

export async function createTaxPeriod({
  tenantId,
  code,
  label,
  periodType = 'MONTHLY',
  startDate,
  endDate,
  notes = null,
  db = prisma,
}) {
  requirePeriods(db);
  return db.taxPeriod.create({
    data: {
      tenantId,
      code,
      label,
      periodType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: TAX_PERIOD_STATUS.OPEN,
      notes,
    },
  });
}

/** Create next open monthly period after the latest one (or current month). */
export async function rollForwardTaxPeriod({ tenantId, db = prisma }) {
  requirePeriods(db);
  const latest = await db.taxPeriod.findFirst({
    where: { tenantId },
    orderBy: { endDate: 'desc' },
  });

  let year;
  let month;
  if (latest) {
    const next = new Date(latest.endDate);
    next.setDate(next.getDate() + 1);
    year = next.getFullYear();
    month = next.getMonth();
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const { start, end, code, label } = buildMonthlyPeriodBounds(year, month);
  const existing = await db.taxPeriod.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
  if (existing) return existing;

  return createTaxPeriod({
    tenantId,
    code,
    label,
    periodType: 'MONTHLY',
    startDate: toYmd(start),
    endDate: toYmd(end),
    db,
  });
}

export async function closeTaxPeriod({ tenantId, periodId, userId, db = prisma }) {
  requirePeriods(db);
  const period = await db.taxPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) {
    const err = new Error('Tax period not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (period.status !== TAX_PERIOD_STATUS.OPEN) {
    const err = new Error(`Cannot close period in status ${period.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxPeriod.update({
    where: { id: period.id },
    data: {
      status: TAX_PERIOD_STATUS.CLOSED,
      closedAt: new Date(),
      closedById: userId || null,
    },
  });
}

export async function reopenTaxPeriod({ tenantId, periodId, userId, db = prisma }) {
  requirePeriods(db);
  const period = await db.taxPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) {
    const err = new Error('Tax period not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (period.status === TAX_PERIOD_STATUS.FILED) {
    const err = new Error('Filed periods cannot be reopened; create an amendment return instead.');
    err.code = 'FILED_LOCKED';
    throw err;
  }
  if (period.status !== TAX_PERIOD_STATUS.CLOSED) {
    const err = new Error(`Cannot reopen period in status ${period.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  return db.taxPeriod.update({
    where: { id: period.id },
    data: {
      status: TAX_PERIOD_STATUS.OPEN,
      reopenedAt: new Date(),
      reopenedById: userId || null,
    },
  });
}

export async function markPeriodFiled({ tenantId, periodId, db = prisma }) {
  requirePeriods(db);
  const period = await db.taxPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) {
    const err = new Error('Tax period not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return db.taxPeriod.update({
    where: { id: period.id },
    data: { status: TAX_PERIOD_STATUS.FILED },
  });
}

export async function findOpenPeriodForDate({ tenantId, date, db = prisma }) {
  if (!modelsAvailable(db, 'taxPeriod')) return null;
  const d = new Date(date);
  return db.taxPeriod.findFirst({
    where: {
      tenantId,
      status: TAX_PERIOD_STATUS.OPEN,
      startDate: { lte: d },
      endDate: { gte: d },
    },
  });
}
