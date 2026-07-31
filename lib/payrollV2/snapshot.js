import { ATTENDANCE_APPROVAL } from './constants.js';
import { parseMoney } from '@/lib/money';
import { resolveEmployeeCompensation } from '@/lib/resolveEmployeeCompensation';

function hoursFromRecord(r) {
  if (r.minutesWorked > 0) return r.minutesWorked / 60;
  return Number(r.hoursWorked || 0);
}

function otHoursFromRecord(r) {
  if (r.overtimeApprovalStatus !== ATTENDANCE_APPROVAL.APPROVED) return 0;
  if (r.overtimeMinutes > 0) return r.overtimeMinutes / 60;
  return Number(r.overtimeHours || 0);
}

/**
 * Build immutable payroll input snapshot for a period.
 * Only APPROVED attendance and APPROVED OT enter the snapshot.
 */
export async function buildPayrollInputSnapshot({
  db,
  tenantId,
  periodStart,
  periodEnd,
  employeeIds = null,
  requireApprovedAttendance = true,
}) {
  const employees = await db.employee.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      employeeId: true,
      selectedDeductions: true,
      salary: true,
      grossSalary: true,
      hourlyRate: true,
    },
  });

  const attendanceWhere = {
    tenantId,
    date: { gte: periodStart, lte: periodEnd },
    employeeId: { in: employees.map((e) => e.id) },
  };
  if (requireApprovedAttendance) {
    attendanceWhere.approvalStatus = ATTENDANCE_APPROVAL.APPROVED;
  }

  const empIds = employees.map((e) => e.id);
  const [attendance, advances, casesWithPenalties, benefits, deductionAssignments, leaveApproved] =
    await Promise.all([
      db.attendanceRecord.findMany({ where: attendanceWhere }),
      db.salaryAdvance.findMany({
        where: {
          tenantId,
          status: 'Active',
          outstandingAmount: { gt: 0 },
          employeeId: { in: empIds },
        },
      }),
      db.disciplinaryCase.findMany({
        where: {
          tenantId,
          employeeId: { in: empIds },
          penalties: {
            some: {
              status: 'APPROVED',
              effectivePeriodEnd: { gte: periodStart, lte: periodEnd },
              payrollRunId: null,
            },
          },
        },
        include: {
          penalties: {
            where: {
              status: 'APPROVED',
              effectivePeriodEnd: { gte: periodStart, lte: periodEnd },
              payrollRunId: null,
            },
          },
        },
      }),
      db.employeeBenefit.findMany({
        where: {
          employeeId: { in: empIds },
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: periodEnd } }],
        },
        include: { benefit: true },
      }),
      db.employeeDeductionAssignment.findMany({
        where: {
          tenantId,
          isActive: true,
          employeeId: { in: empIds },
          effectiveFrom: { lte: periodEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
        },
        include: { deduction: true },
      }),
      db.leaveRequest.findMany({
        where: {
          tenantId,
          status: 'approved',
          employeeId: { in: empIds },
          startDate: { lte: periodEnd },
          endDate: { gte: periodStart },
        },
        include: { leavePolicy: true },
      }),
    ]);

  const byEmployee = [];

  for (const emp of employees) {
    const compensation = await resolveEmployeeCompensation({
      db,
      tenantId,
      employeeId: emp.id,
      asOf: periodEnd,
    });

    const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
    const approvedHours = empAttendance.reduce((s, r) => s + hoursFromRecord(r), 0);
    const approvedOtHours = empAttendance.reduce((s, r) => s + otHoursFromRecord(r), 0);

    const empAdvances = advances
      .filter((a) => a.employeeId === emp.id)
      .map((a) => ({
        id: a.id,
        outstandingAmount: parseMoney(a.outstandingAmount),
        monthlyDeduction: parseMoney(a.monthlyDeduction),
      }));

    const penaltyRows = casesWithPenalties
      .filter((c) => c.employeeId === emp.id)
      .flatMap((c) =>
        (c.penalties || []).map((p) => ({
          id: p.id,
          amount: parseMoney(p.amount),
        }))
      );

    const empBenefits = benefits
      .filter((b) => b.employeeId === emp.id)
      .filter((b) => !b.effectiveTo || new Date(b.effectiveTo) >= periodStart)
      .map((b) => ({
        id: b.id,
        benefitId: b.benefitId,
        name: b.benefit?.name,
        amount: parseMoney(b.amount),
        isTaxable: b.benefit?.isTaxable !== false,
        isPensionable: !!b.benefit?.isPensionable,
      }));

    const assignments = deductionAssignments
      .filter((d) => d.employeeId === emp.id)
      .map((d) => ({
        deductionId: d.deductionId,
        name: d.deduction?.name,
        code: d.deduction?.code,
        amount: parseMoney(d.amountOverride ?? d.deduction?.amount),
        percentage: parseMoney(d.percentOverride ?? d.deduction?.percentage),
        priority: d.deduction?.priority ?? 100,
        isStatutory: !!d.deduction?.isStatutory,
        isPreTax: !!d.deduction?.isPreTax,
      }));

    const paidLeaveDays = leaveApproved
      .filter((l) => l.employeeId === emp.id && l.leavePolicy?.isPaid !== false)
      .reduce((s, l) => s + Number(l.totalDays || 0), 0);

    byEmployee.push({
      employeeId: emp.id,
      employeeNumber: emp.employeeId,
      name: emp.name,
      compensation,
      selectedDeductions: emp.selectedDeductions,
      deductionAssignments: assignments,
      benefits: empBenefits,
      attendance: {
        approvedHours,
        approvedOtHours,
        recordCount: empAttendance.length,
      },
      advances: empAdvances,
      penalties: penaltyRows,
      paidLeaveDays,
    });
  }

  return {
    version: 1,
    periodStart: periodStart.toISOString?.() || periodStart,
    periodEnd: periodEnd.toISOString?.() || periodEnd,
    requireApprovedAttendance,
    generatedAt: new Date().toISOString(),
    employees: byEmployee,
  };
}
