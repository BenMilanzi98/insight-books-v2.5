import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { addMoney, parseMoney, roundMoney } from '@/lib/money';
import { calculatePayeForTenant } from '@/lib/payrollEngine';
import { effectiveNpsRatePercentForPayroll } from '@/lib/npsTenantRates';
import { PAYROLL_RUN_STATUS } from './constants.js';
import { assertRunCommandAllowed } from './runStateMachine.js';
import { buildPayrollInputSnapshot } from './snapshot.js';
import { calculateEmployeePayrollV2Async } from './calculateEmployee.js';
import { postPayrollRunRecognition, postPayrollRunPayment } from './posting.js';

function checksumResults(results) {
  const payload = results
    .map(
      (r) =>
        `${r.employeeId}:${r.grossPay}:${r.netPay}:${r.payeAmount}:${r.npsEmployee}`
    )
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function resolveNpsRates(tenantId, asOf) {
  const rule = await prisma.pensionRule.findFirst({
    where: {
      tenantId,
      isActive: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (rule) {
    return {
      employee: parseMoney(rule.employeeRatePercent),
      employer: parseMoney(rule.employerRatePercent),
    };
  }
  return {
    employee: effectiveNpsRatePercentForPayroll(null, true),
    employer: effectiveNpsRatePercentForPayroll(null, true) === 5 ? 10 : 10,
  };
}

export async function createPayrollRun({
  tenantId,
  userId,
  periodStart,
  periodEnd,
  notes,
}) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const existing = await prisma.payrollRun.findFirst({
    where: { tenantId, periodStart: start, periodEnd: end },
    orderBy: { version: 'desc' },
  });
  const version = existing ? existing.version + 1 : 1;
  return prisma.payrollRun.create({
    data: {
      tenantId,
      periodStart: start,
      periodEnd: end,
      status: PAYROLL_RUN_STATUS.DRAFT,
      version,
      createdById: userId || null,
      notes: notes || null,
      runNumber: `PR-${start.toISOString().slice(0, 7)}-v${version}`,
    },
  });
}

export async function loadPayrollRun({ tenantId, runId }) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
  });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'load');

  const snapshot = await buildPayrollInputSnapshot({
    db: prisma,
    tenantId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    requireApprovedAttendance: true,
  });

  const exceptions = [];
  for (const e of snapshot.employees) {
    if (!e.compensation?.basicSalary && e.compensation?.payBasis !== 'HOURLY_RATE') {
      exceptions.push({
        employeeId: e.employeeId,
        code: 'NO_BASIC',
        message: 'No basic salary on contract/employee',
      });
    }
  }

  await prisma.payrollRunEmployee.deleteMany({ where: { payrollRunId: run.id } });
  if (snapshot.employees.length) {
    await prisma.payrollRunEmployee.createMany({
      data: snapshot.employees.map((e) => ({
        payrollRunId: run.id,
        employeeId: e.employeeId,
        contractId: e.compensation?.contractId || null,
        included: true,
      })),
    });
  }

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.LOADED,
      inputSnapshot: snapshot,
      exceptions,
    },
  });
}

export async function calculatePayrollRun({ tenantId, runId }) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
  });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'calculate');

  let snapshot = run.inputSnapshot;
  if (!snapshot?.employees) {
    await loadPayrollRun({ tenantId, runId });
    const reloaded = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    snapshot = reloaded.inputSnapshot;
  }

  const npsRates = await resolveNpsRates(tenantId, run.periodEnd);
  const results = [];

  for (const emp of snapshot.employees) {
    const calc = await calculateEmployeePayrollV2Async(emp, {
      npsEmployeeRatePercent: npsRates.employee,
      npsEmployerRatePercent: npsRates.employer,
      forcePaye: true,
      forceNps: emp.compensation?.pensionEligible !== false,
      calculatePaye: (taxable) => calculatePayeForTenant(tenantId, taxable, run.periodEnd),
      minNetPay: 0,
    });
    results.push(calc);
  }

  await prisma.employeePayrollResult.deleteMany({ where: { payrollRunId: run.id } });

  for (const r of results) {
    const created = await prisma.employeePayrollResult.create({
      data: {
        tenantId,
        payrollRunId: run.id,
        employeeId: r.employeeId,
        grossPay: r.grossPay,
        taxablePay: r.taxablePay,
        payeAmount: r.payeAmount,
        npsEmployee: r.npsEmployee,
        npsEmployer: r.npsEmployer,
        otherDeductions: r.otherDeductions,
        advanceRecovery: r.advanceRecovery,
        netPay: r.netPay,
        explanation: r.explanation,
      },
    });
    if (r.components?.length) {
      await prisma.payrollResultComponent.createMany({
        data: r.components.map((c) => ({
          resultId: created.id,
          code: c.code,
          name: c.name,
          category: c.category,
          amount: c.amount,
          isCredit: !!c.isCredit,
          sortOrder: c.sortOrder || 100,
          meta: c.meta || undefined,
        })),
      });
    }
  }

  const totals = {
    employees: results.length,
    grossPay: roundMoney(results.reduce((s, r) => addMoney(s, r.grossPay), 0)),
    netPay: roundMoney(results.reduce((s, r) => addMoney(s, r.netPay), 0)),
    payeAmount: roundMoney(results.reduce((s, r) => addMoney(s, r.payeAmount), 0)),
    npsEmployee: roundMoney(results.reduce((s, r) => addMoney(s, r.npsEmployee), 0)),
    npsEmployer: roundMoney(results.reduce((s, r) => addMoney(s, r.npsEmployer), 0)),
    advanceRecovery: roundMoney(
      results.reduce((s, r) => addMoney(s, r.advanceRecovery), 0)
    ),
  };

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.CALCULATED,
      totals,
      checksum: checksumResults(results),
      calculatedAt: new Date(),
    },
    include: {
      results: { include: { components: true } },
      employees: true,
    },
  });
}

export async function submitPayrollRun({ tenantId, runId }) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'submit');
  return prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: PAYROLL_RUN_STATUS.SUBMITTED, submittedAt: new Date() },
  });
}

export async function approvePayrollRun({ tenantId, runId, userId }) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'approve');
  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.APPROVED,
      approvedAt: new Date(),
      approvedById: userId || null,
    },
  });
}

export async function postPayrollRun({ tenantId, runId, userId, linesBuilder }) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: { results: { include: { components: true } } },
  });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'post');

  const journal = await postPayrollRunRecognition({
    tenantId,
    userId,
    run,
    linesBuilder,
  });

  // Persist advance recoveries uniquely
  for (const result of run.results) {
    const advComponents = (result.components || []).filter((c) =>
      String(c.code).startsWith('ADV_')
    );
    for (const c of advComponents) {
      const advanceId = c.meta?.advanceId || String(c.code).replace(/^ADV_/, '');
      const amount = parseMoney(c.amount);
      if (!advanceId || amount <= 0) continue;
      await prisma.advanceDeduction.create({
        data: {
          tenantId,
          salaryAdvanceId: advanceId,
          payrollRunId: run.id,
          installmentNo: 1,
          amount,
          deductionDate: run.periodEnd,
          notes: `Payroll run ${run.runNumber || run.id}`,
        },
      });
      const adv = await prisma.salaryAdvance.findFirst({
        where: { id: advanceId, tenantId },
      });
      if (adv) {
        const totalDeducted = addMoney(parseMoney(adv.totalDeducted), amount);
        const outstanding = Math.max(
          0,
          subtractSafe(parseMoney(adv.outstandingAmount), amount)
        );
        await prisma.salaryAdvance.update({
          where: { id: adv.id },
          data: {
            totalDeducted,
            outstandingAmount: outstanding,
            status: outstanding <= 0 ? 'Cleared' : 'Active',
          },
        });
      }
    }

    if (parseMoney(result.npsEmployee) > 0 || parseMoney(result.npsEmployer) > 0) {
      await prisma.pensionContribution.upsert({
        where: {
          tenantId_employeeId_payrollRunId: {
            tenantId,
            employeeId: result.employeeId,
            payrollRunId: run.id,
          },
        },
        create: {
          tenantId,
          employeeId: result.employeeId,
          payrollRunId: run.id,
          periodEnd: run.periodEnd,
          employeeAmount: result.npsEmployee,
          employerAmount: result.npsEmployer,
          status: 'ACCRUED',
        },
        update: {
          employeeAmount: result.npsEmployee,
          employerAmount: result.npsEmployer,
        },
      });
    }
  }

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.POSTED,
      postedAt: new Date(),
      recognitionJournalId: journal?.journalId || journal?.id || null,
    },
  });
}

function subtractSafe(a, b) {
  return roundMoney(parseMoney(a) - parseMoney(b));
}

export async function payPayrollRun({
  tenantId,
  runId,
  userId,
  paymentAccountId,
  paymentDate,
  linesBuilder,
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: { results: true },
  });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'pay');

  const totalNet = parseMoney(run.totals?.netPay);
  const batch = await prisma.payrollPaymentBatch.create({
    data: {
      tenantId,
      payrollRunId: run.id,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      totalAmount: totalNet,
      paymentAccountId: paymentAccountId || null,
      status: 'POSTING',
    },
  });

  const journal = await postPayrollRunPayment({
    tenantId,
    userId,
    run,
    batch,
    linesBuilder,
  });

  await prisma.payrollPaymentBatch.update({
    where: { id: batch.id },
    data: {
      status: 'POSTED',
      journalId: journal?.journalId || journal?.id || null,
    },
  });

  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.PAID,
      paidAt: new Date(),
      paymentBatchId: batch.id,
    },
  });
}

export async function reversePayrollRun({ tenantId, runId, userId }) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new Error('Payroll run not found');
  assertRunCommandAllowed(run.status, 'reverse');
  // Accounting reverse is handled by existing reverse adapters when journalId present.
  return prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: PAYROLL_RUN_STATUS.REVERSED,
      reversedAt: new Date(),
      reversedRunId: run.id,
    },
  });
}

export async function getPayrollRun({ tenantId, runId }) {
  return prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    include: {
      results: { include: { components: true }, orderBy: { employeeId: 'asc' } },
      employees: true,
      paymentBatches: true,
    },
  });
}

export async function listPayrollRuns({ tenantId, take = 50 }) {
  return prisma.payrollRun.findMany({
    where: { tenantId },
    orderBy: [{ periodEnd: 'desc' }, { version: 'desc' }],
    take,
  });
}
