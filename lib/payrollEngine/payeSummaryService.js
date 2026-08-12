/**
 * PAYE Summary — single source of truth from stored Payroll rows (never frontend totals).
 */
import prisma from '@/lib/prisma';
import { parsePayrollNotes, getPayrollStatutoryBreakdown } from '@/lib/payrollStatutoryBreakdown';
import { sumPaidPayeExpenses, isPayeTaxType } from '@/lib/payeExpenseSettlement';
import { tenantWhereIn } from '@/lib/dashboardTenantScope';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v) {
  return Math.round(num(v) * 100) / 100;
}

/**
 * @param {import('@prisma/client').Payroll & { employee?: object }} payroll
 * @param {{ npsEmployeeRatePercent?: number, npsEmployerRatePercent?: number, journalPosted?: boolean, journalReversed?: boolean }} ctx
 */
export function payrollToPayeSummaryRow(payroll, ctx = {}) {
  const info = parsePayrollNotes(payroll.notes);
  const statutory = getPayrollStatutoryBreakdown(payroll, {
    npsEmployeeRatePercent: ctx.npsEmployeeRatePercent,
    npsEmployerRatePercent: ctx.npsEmployerRatePercent,
    signed: payroll.status === 'Reversed',
  });

  const basicSalary = num(payroll.basicSalary);
  const grossPay = num(payroll.grossPay ?? basicSalary + num(payroll.additions));
  const additions = num(payroll.additions);
  const taxableIncome =
    info.payeTaxableIncome != null ? num(info.payeTaxableIncome) : grossPay;

  const allowanceEntries = info.allowances && typeof info.allowances === 'object' ? info.allowances : {};
  let taxableAllowances = 0;
  let nonTaxableAllowances = 0;
  for (const [name, val] of Object.entries(allowanceEntries)) {
    const amt = num(val);
    if (/non.?tax|exempt/i.test(String(name))) {
      nonTaxableAllowances += amt;
    } else {
      taxableAllowances += amt;
    }
  }
  if (!Object.keys(allowanceEntries).length && additions > 0) {
    taxableAllowances = additions;
  }

  const advanceRecovery = num(info.totalAdvanceDeductions);
  const leaveDeductions = num(info.totalLeaveDeductions);
  const otherDeductionsRaw = num(payroll.deductions);
  const paye = Math.abs(statutory.payeAmount);
  const npsEmployee = Math.abs(statutory.npsEmployeeAmount);
  const npsEmployer = Math.abs(statutory.npsEmployerAmount);
  const otherDeductions = Math.max(
    0,
    roundMoney(
      otherDeductionsRaw - paye - npsEmployee - advanceRecovery - leaveDeductions,
    ),
  );

  const netPay = payroll.status === 'Reversed' ? 0 : num(payroll.netPay);
  const isDraft = ['Pending', 'Draft', 'draft'].includes(String(payroll.status || ''));
  const isPosted =
    ctx.journalPosted === true ||
    ['Processed', 'Posted', 'Paid', 'Closed', 'Approved'].includes(String(payroll.status || ''));

  const emp = payroll.employee || {};

  return {
    payrollId: payroll.id,
    employeeId: payroll.employeeId,
    employeeNumber: emp.employeeId || '—',
    employeeName: emp.name || 'Unknown',
    department: emp.departmentRef?.name || emp.department || '—',
    branch: emp.workLocation || '—',
    basicSalary: roundMoney(basicSalary),
    taxableAllowances: roundMoney(taxableAllowances),
    nonTaxableAllowances: roundMoney(nonTaxableAllowances),
    grossPay: roundMoney(grossPay),
    taxableIncome: roundMoney(taxableIncome),
    payeDeducted: roundMoney(paye),
    pensionEmployee: roundMoney(npsEmployee),
    pensionEmployer: roundMoney(npsEmployer),
    advanceRecovery: roundMoney(advanceRecovery),
    leaveDeductions: roundMoney(leaveDeductions),
    otherDeductions: roundMoney(otherDeductions),
    netPay: roundMoney(netPay),
    payrollPeriod: {
      start: payroll.periodStart,
      end: payroll.periodEnd,
      label: formatPeriodLabel(payroll.periodStart, payroll.periodEnd),
    },
    payrollStatus: payroll.status,
    isProvisional: isDraft,
    journalStatus: payroll.status === 'Reversed'
      ? 'Reversed'
      : ctx.journalReversed
        ? 'Reversed'
        : isPosted
          ? 'Posted'
          : isDraft
            ? 'Not posted'
            : 'Pending post',
    paymentDate: payroll.paymentDate,
    tenantId: payroll.tenantId,
  };
}

function formatPeriodLabel(start, end) {
  const s = start ? new Date(start).toLocaleDateString('en-GB') : '—';
  const e = end ? new Date(end).toLocaleDateString('en-GB') : '—';
  return `${s} – ${e}`;
}

function buildDateFilter(fromDate, toDate) {
  const dateFilter = {};
  if (fromDate) {
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    dateFilter.gte = d;
  }
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    dateFilter.lte = d;
  }
  return Object.keys(dateFilter).length ? dateFilter : null;
}

/**
 * @param {object} params
 * @param {string[]} params.tenantIds
 * @param {object} [params.filters]
 * @param {import('@prisma/client').PrismaClient} [params.db]
 */
export async function buildPayeSummaryReport(params) {
  const { tenantIds, filters = {}, db = prisma } = params;
  if (!tenantIds?.length) {
    return emptyPayeSummary();
  }

  const dateFilter = buildDateFilter(filters.fromDate, filters.toDate);

  /** @type {import('@prisma/client').Prisma.PayrollWhereInput} */
  // tenantWhereIn() returns a where fragment ({ tenantId: ... }) — must spread, not nest.
  const where = {
    ...tenantWhereIn(tenantIds),
  };

  if (dateFilter) {
    where.OR = [
      { paymentDate: dateFilter },
      { paymentDate: null, periodEnd: dateFilter },
    ];
  }

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  const postedStatuses = ['Processed', 'Posted', 'Paid', 'Closed', 'Approved'];
  const unpostedStatuses = ['Pending', 'Draft', 'draft', 'Reviewed'];
  let statusFilter = null;

  if (filters.payrollStatus && filters.payrollStatus !== 'all') {
    statusFilter = [filters.payrollStatus];
  } else if (filters.excludeReversed !== false) {
    where.status = { not: 'Reversed' };
  }

  if (filters.journalPosted === 'posted') {
    statusFilter = statusFilter
      ? statusFilter.filter((s) => postedStatuses.includes(s))
      : postedStatuses;
  } else if (filters.journalPosted === 'unposted') {
    statusFilter = statusFilter
      ? statusFilter.filter((s) => unpostedStatuses.includes(s))
      : unpostedStatuses;
  }

  if (statusFilter) {
    where.status = statusFilter.length === 1 ? statusFilter[0] : { in: statusFilter };
    if (Array.isArray(statusFilter) && statusFilter.length === 0) {
      return emptyPayeSummary();
    }
  }

  if (filters.departmentId || filters.department) {
    const dept = String(filters.department || '').trim();
    where.employee = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(dept
        ? {
            OR: [
              { department: { contains: dept, mode: 'insensitive' } },
              { departmentRef: { name: { contains: dept, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  if (filters.branch) {
    where.employee = {
      ...(where.employee || {}),
      workLocation: { contains: filters.branch, mode: 'insensitive' },
    };
  }

  const payrolls = await db.payroll.findMany({
    where,
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeId: true,
          department: true,
          departmentId: true,
          workLocation: true,
          departmentRef: { select: { name: true } },
        },
      },
    },
  });

  const payrollIds = payrolls.map((p) => p.id);
  const journalByPayrollId = new Map();

  if (payrollIds.length) {
    try {
      const journals = await db.journalEntry.findMany({
        where: {
          ...tenantWhereIn(tenantIds),
          sourceId: { in: payrollIds },
          architectureVersion: 'ACCOUNTING_V2',
        },
        select: { sourceId: true, status: true, reversalStatus: true, reversedByJournalId: true },
      });
      for (const je of journals) {
        if (!je.sourceId) continue;
        const posted = String(je.status || '').toLowerCase() === 'posted';
        const reversed = Boolean(je.reversedByJournalId) || String(je.reversalStatus || '').toUpperCase() === 'REVERSED';
        journalByPayrollId.set(je.sourceId, { posted, reversed });
      }
    } catch {
      try {
        const txs = await db.transaction.findMany({
          where: {
            ...tenantWhereIn(tenantIds),
            sourceId: { in: payrollIds },
            isReversal: false,
          },
          select: { sourceId: true },
        });
        for (const tx of txs) {
          if (tx.sourceId && !journalByPayrollId.has(tx.sourceId)) {
            journalByPayrollId.set(tx.sourceId, { posted: true, reversed: false });
          }
        }
      } catch {
        /* journal lookup is optional context */
      }
    }
  }

  const settingsRows = await db.tenantSettings.findMany({
    where: { tenantId: { in: tenantIds } },
    select: {
      tenantId: true,
      npsEmployeeRatePercent: true,
      npsEmployerRatePercent: true,
    },
  });
  const npsByTenant = new Map(settingsRows.map((s) => [s.tenantId, s]));

  const rows = payrolls.map((p) => {
    const nps = npsByTenant.get(p.tenantId) || {};
    const j = journalByPayrollId.get(p.id) || { posted: false, reversed: false };
    return payrollToPayeSummaryRow(p, {
      npsEmployeeRatePercent: nps.npsEmployeeRatePercent,
      npsEmployerRatePercent: nps.npsEmployerRatePercent,
      journalPosted: j.posted,
      journalReversed: j.reversed,
    });
  });

  const activeRows = rows.filter((r) => r.payrollStatus !== 'Reversed');

  const summary = {
    employeeCount: new Set(activeRows.map((r) => r.employeeId)).size,
    payrollLineCount: activeRows.length,
    totalGrossPay: roundMoney(activeRows.reduce((s, r) => s + r.grossPay, 0)),
    totalTaxableIncome: roundMoney(activeRows.reduce((s, r) => s + r.taxableIncome, 0)),
    totalPayeDeducted: roundMoney(activeRows.reduce((s, r) => s + r.payeDeducted, 0)),
    totalNetPay: roundMoney(activeRows.reduce((s, r) => s + r.netPay, 0)),
    totalPensionEmployee: roundMoney(activeRows.reduce((s, r) => s + r.pensionEmployee, 0)),
    totalPensionEmployer: roundMoney(activeRows.reduce((s, r) => s + r.pensionEmployer, 0)),
    totalAdvanceRecovery: roundMoney(activeRows.reduce((s, r) => s + r.advanceRecovery, 0)),
    totalOtherDeductions: roundMoney(activeRows.reduce((s, r) => s + r.otherDeductions, 0)),
    provisionalCount: activeRows.filter((r) => r.isProvisional).length,
  };

  let remittedPaye = { total: 0, rows: [] };
  try {
    const payeTypes = await db.taxType.findMany({
      where: { tenantId: { in: tenantIds }, status: 'Active' },
    });
    const payeType = payeTypes.find(isPayeTaxType);
    if (payeType && tenantIds.length === 1) {
      remittedPaye = await sumPaidPayeExpenses(db, {
        tenantId: tenantIds[0],
        taxTypeId: payeType.id,
        dateFilter: dateFilter || undefined,
      });
    }
  } catch {
    /* non-fatal */
  }

  summary.totalPayeRemitted = roundMoney(remittedPaye.total);
  summary.totalPayeOutstanding = roundMoney(
    Math.max(0, summary.totalPayeDeducted - summary.totalPayeRemitted),
  );

  const byEmployeeMap = new Map();
  for (const row of activeRows) {
    const key = row.employeeId;
    if (!byEmployeeMap.has(key)) {
      byEmployeeMap.set(key, {
        employeeId: key,
        employeeNumber: row.employeeNumber,
        employeeName: row.employeeName,
        department: row.department,
        totalPaye: 0,
        totalGross: 0,
        totalNet: 0,
        periods: [],
      });
    }
    const agg = byEmployeeMap.get(key);
    agg.totalPaye += row.payeDeducted;
    agg.totalGross += row.grossPay;
    agg.totalNet += row.netPay;
    agg.periods.push({
      payrollId: row.payrollId,
      period: row.payrollPeriod.label,
      paye: row.payeDeducted,
      status: row.payrollStatus,
      journalStatus: row.journalStatus,
    });
  }

  const byEmployee = [...byEmployeeMap.values()]
    .map((e) => ({
      ...e,
      totalPaye: roundMoney(e.totalPaye),
      totalGross: roundMoney(e.totalGross),
      totalNet: roundMoney(e.totalNet),
    }))
    .sort((a, b) => b.totalPaye - a.totalPaye);

  return {
    summary,
    rows: activeRows,
    byEmployee,
    remittance: remittedPaye,
    filters: filters,
  };
}

function emptyPayeSummary() {
  return {
    summary: {
      employeeCount: 0,
      payrollLineCount: 0,
      totalGrossPay: 0,
      totalTaxableIncome: 0,
      totalPayeDeducted: 0,
      totalNetPay: 0,
      totalPensionEmployee: 0,
      totalPensionEmployer: 0,
      totalAdvanceRecovery: 0,
      totalOtherDeductions: 0,
      totalPayeRemitted: 0,
      totalPayeOutstanding: 0,
      provisionalCount: 0,
    },
    rows: [],
    byEmployee: [],
    remittance: { total: 0, rows: [] },
    filters: {},
  };
}

export { emptyPayeSummary };
