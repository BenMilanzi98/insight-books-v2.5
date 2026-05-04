// app/api/pension/clear/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAccountBalance } from '@/lib/core';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';
import { parseDateInputForMonthNormalization } from '@/lib/dateUtils';
import { getPayrollStatutoryBreakdown } from '@/lib/payrollStatutoryBreakdown';

function safeNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function parseNotesJSON(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return {};
  }
}

async function getTenantNpsRatesFallback(tenantId) {
  let employee = 5;
  let employer = 5;
  try {
    const rows = await prisma.$queryRaw`
      SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
      FROM "TenantSettings"
      WHERE "tenantId" = ${tenantId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row) {
      const r = npsRatesFromTenantSettingsRow(row);
      employee = r.npsEmployeeRatePercent != null ? r.npsEmployeeRatePercent : 5;
      employer = r.npsEmployerRatePercent != null ? r.npsEmployerRatePercent : 5;
    }
  } catch (e) {
    console.warn('Pension clear raw rate read failed, using defaults:', e?.message || e);
  }
  return { employeeRatePercent: employee, employerRatePercent: employer };
}

/**
 * POST /api/pension/clear
 * Body:
 * - employeeIds: string[] (required)
 * - startDate: string (required, yyyy-mm-dd or ISO)
 * - endDate: string (required, yyyy-mm-dd or ISO)
 * - paymentMethod: string (optional, default: 'cash')
 * - clearDate: string (optional, ISO) - payment/expense date
 *
 * Behavior:
 * - Clears the employer NPS amount that was posted on each payroll
 * - Creates ONE Expense + Payment PER employee (category: "Pension")
 * - Marks payroll.notes as cleared for employer portion to prevent double-clearing
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.filter(Boolean) : [];
    const paymentMethod = (body.paymentMethod || 'cash').toString();

    const startDate = body.startDate ? parseDateInputForMonthNormalization(body.startDate) : null;
    const endDate = body.endDate ? parseDateInputForMonthNormalization(body.endDate) : null;
    const clearDate = body.clearDate ? parseDateInputForMonthNormalization(body.clearDate) : new Date();

    if (!employeeIds.length) {
      return NextResponse.json({ error: 'employeeIds is required' }, { status: 400 });
    }
    if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'startDate and endDate are required and must be valid dates' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate cannot be before startDate' }, { status: 400 });
    }

    // Normalize to full-day range
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const fallbackRates = await getTenantNpsRatesFallback(user.tenantId);

    // Fetch payrolls for selected employees in date range (with NPS activity)
    const payrolls = await prisma.payroll.findMany({
      where: {
        tenantId: user.tenantId,
        employeeId: { in: employeeIds },
        AND: [
          { periodEnd: { gte: startDate } },
          { periodStart: { lte: endDate } },
        ],
        OR: [
          { totalNpsAmount: { gt: 0 } },
          { notes: { contains: 'npsEmployerAmount' } },
          { notes: { contains: 'npsEmployerRatePercent' } },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        totalNpsAmount: true,
        notes: true,
      },
      orderBy: [{ periodEnd: 'asc' }],
    });

    if (!payrolls.length) {
      return NextResponse.json({ error: 'No payroll records with pension found for selected employees in this period.' }, { status: 400 });
    }

    // Group payrolls by employee and compute uncleared employer totals
    const byEmployee = new Map();
    for (const p of payrolls) {
      const info = parseNotesJSON(p.notes);
      const clearedEmployer = !!info?.pensionClearedEmployer;
      if (clearedEmployer) continue; // idempotency: already cleared

      const statutory = getPayrollStatutoryBreakdown(p, {
        npsEmployeeRatePercent: fallbackRates.employeeRatePercent,
        npsEmployerRatePercent: fallbackRates.employerRatePercent,
      });
      const employerAmount = round2(statutory.npsEmployerAmount);
      if (employerAmount <= 0) continue;

      const cur = byEmployee.get(p.employeeId) || { payrollIds: [], amount: 0 };
      cur.payrollIds.push(p.id);
      cur.amount = round2(cur.amount + employerAmount);
      byEmployee.set(p.employeeId, cur);
    }

    const employeeIdsToClear = Array.from(byEmployee.keys());
    if (!employeeIdsToClear.length) {
      return NextResponse.json({ error: 'Selected employees have no uncleared employer pension contributions for this period.' }, { status: 400 });
    }

    // Fetch employee names for nicer expense descriptions
    const employees = await prisma.employee.findMany({
      where: { tenantId: user.tenantId, id: { in: employeeIdsToClear } },
      select: { id: true, name: true, employeeId: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const result = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const empId of employeeIdsToClear) {
        const { payrollIds, amount } = byEmployee.get(empId);
        if (!amount || amount <= 0) continue;

        const emp = employeeMap.get(empId);
        const employeeName = emp?.name || 'Employee';
        const employeeNumber = emp?.employeeId || 'N/A';

        const description = `Pension (Employer) - ${employeeName} (${employeeNumber})`;
        const notes = {
          type: 'PensionClearance',
          scope: 'Employer',
          employeeId: empId,
          payrollIds,
          periodStart: startDate.toISOString(),
          periodEnd: endDate.toISOString(),
          paymentMethod,
        };

        const expense = await tx.expense.create({
          data: {
            description,
            amount,
            date: clearDate,
            category: 'Pension',
            paymentMethod,
            sourceAccountId: null,
            merchant: 'Pension',
            status: 'Approved',
            notes: JSON.stringify(notes),
            submittedById: user.id,
            tenantId: user.tenantId,
            paymentStatus: 'Fully paid',
            paidAmount: amount,
            paymentReference: `PENSION-${empId}-${Date.now()}`,
          },
        });

        await tx.payment.create({
          data: {
            expenseId: expense.id,
            amount,
            paymentDate: clearDate,
            paymentMethod,
            reference: expense.paymentReference || description,
            status: 'Completed',
            tenantId: user.tenantId,
            type: 'expense',
            sourceAccount: paymentMethod || null,
          },
        });

        // Update payment method balance (this drives dashboard cashflow + account balances)
        await updateAccountBalance(user.tenantId, paymentMethod, amount, 'subtract', tx);

        // Mark payrolls as cleared (employer side) to prevent double-clearing
        for (const payrollId of payrollIds) {
          const payroll = payrolls.find((x) => x.id === payrollId);
          const existingInfo = parseNotesJSON(payroll?.notes);
          const updatedInfo = {
            ...existingInfo,
            pensionClearedEmployer: true,
            pensionClearedEmployerAt: clearDate.toISOString(),
            pensionClearedEmployerExpenseId: expense.id,
          };
          await tx.payroll.update({
            where: { id: payrollId },
            data: { notes: JSON.stringify(updatedInfo) },
          });
        }

        // Audit log
        await tx.auditLog.create({
          data: {
            action: 'PENSION_CLEARED',
            entityType: 'EXPENSE',
            entityId: expense.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              employeeId: empId,
              amount,
              payrollIds,
              paymentMethod,
              periodStart: startDate.toISOString(),
              periodEnd: endDate.toISOString(),
              scope: 'Employer',
            }),
          },
        });

        created.push({ employeeId: empId, expenseId: expense.id, amount, payrollCount: payrollIds.length });
      }

      return created;
    });

    const totalAmount = round2(result.reduce((sum, r) => sum + safeNumber(r.amount), 0));

    return NextResponse.json(
      {
        message: 'Pension cleared successfully',
        scope: 'Employer',
        employeeCount: result.length,
        totalAmount,
        results: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error clearing pension:', error);
    return NextResponse.json(
      { error: 'Failed to clear pension', details: error.message },
      { status: 500 }
    );
  }
}


