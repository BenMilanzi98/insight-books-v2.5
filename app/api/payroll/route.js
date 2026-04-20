// app/api/payroll/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { normalizePayrollMonthPeriod } from '@/lib/dateUtils';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

function normalizeDeductionIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// GET - Return raw payroll entries for the tenant (UI aggregates client-side)
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const where = {
      tenantId: user.tenantId
    };

    if (status) {
      where.status = status;
    }

    if (start && end) {
      // Frontend passes YYYY-MM-DD. Normalize to inclusive day range so
      // stored periodEnd timestamps like 23:59:59.999 aren't excluded.
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      where.AND = [
        { periodStart: { gte: startDate } },
        { periodEnd: { lte: endDate } }
      ];
    } else if (year) {
      const startYear = parseInt(year);
      where.periodStart = {
        gte: new Date(startYear, 0, 1),
        lt: new Date(startYear + 1, 0, 1)
      };
    }

    if (month && year) {
      const startYear = parseInt(year);
      const startMonth = parseInt(month) - 1; // 0-indexed
      where.periodStart = {
        gte: new Date(startYear, startMonth, 1),
        lt: new Date(startYear, startMonth + 1, 1)
      };
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        employeeId: true,
        tenantId: true,
        periodStart: true,
        periodEnd: true,
        paymentDate: true,
        basicSalary: true,
        grossPay: true,
        netPay: true,
        payeAmount: true,
        totalNpsAmount: true,
        status: true,
        employee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ payrolls });

  } catch (error) {
    console.error('Error fetching payroll:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new payroll run
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    const body = await request.json();
    
    // Validate request body
    if (!body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Period start and end dates are required' },
        { status: 400 }
      );
    }
    
    // Normalize to 1st and last day of month (calendar-safe parsing for YYYY-MM-DD)
    const { periodStart, periodEnd } = normalizePayrollMonthPeriod(body.periodStart, body.periodEnd);
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    
    // Validate date range
    if (periodEnd < periodStart) {
      return NextResponse.json(
        { error: 'Period end date cannot be before start date' },
        { status: 400 }
      );
    }
    
    // Check if a payroll run already exists for this period
    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        periodStart,
        periodEnd,
        tenantId: user.tenantId,
        status: { not: 'Reversed' },
      }
    });
    
    if (existingPayroll) {
      return NextResponse.json(
        { error: 'A payroll run already exists for this period' },
        { status: 400 }
      );
    }
    
    // Get all active employees (enforce isActive to avoid processing inactive employees)
    const employees = await prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'Active',
        isActive: true
      }
    });
    
    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    let npsEmployeeRatePercent = null;
    let npsEmployerRatePercent = null;
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        const nps = npsRatesFromTenantSettingsRow(row);
        npsEmployeeRatePercent = nps.npsEmployeeRatePercent;
        npsEmployerRatePercent = nps.npsEmployerRatePercent;
      }
    } catch {
      // leave nulls; calculatePayroll treats as 0% NPS unless deduction selected
    }

    // Create a payroll entry for each employee
    const payrollEntries = await Promise.all(employees.map(async (employee) => {
      const grossFromField =
        employee.grossSalary != null && Number(employee.grossSalary) > 0
          ? Number(employee.grossSalary)
          : Number(employee.salary) || 0;
      const ids = normalizeDeductionIds(employee.selectedDeductions);
      const selected =
        ids.length > 0
          ? await prisma.deduction.findMany({
              where: { id: { in: ids }, tenantId: user.tenantId, isActive: true },
            })
          : [];
      const calc = calculatePayroll(grossFromField, selected, {
        npsEmployeeRatePercent,
        npsEmployerRatePercent,
      });

      return prisma.payroll.create({
        data: {
          employeeId: employee.id,
          tenantId: user.tenantId,
          periodStart,
          periodEnd,
          basicSalary: employee.salary,
          grossPay: grossFromField,
          deductions: calc.totalDeductions,
          additions: 0,
          netPay: calc.netPay,
          payeAmount: calc.paye.payeAmount,
          totalNpsAmount: calc.nps.totalAmount,
          status: 'Pending',
          paymentDate,
        },
      });
    }));
    
    // Format the period string (e.g., "March 2025")
    const periodMonth = periodStart.toLocaleString('default', { month: 'long' });
    const periodYear = periodStart.getFullYear();
    const periodString = `${periodMonth} ${periodYear}`;
    
    // Create a unique ID for this payroll period
    const payrollId = `PAY-${periodYear}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate totals
    const totalAmount = payrollEntries.reduce((sum, p) => sum + p.basicSalary + p.additions, 0);
    const totalDeductions = payrollEntries.reduce((sum, p) => sum + p.deductions, 0);
    const netAmount = payrollEntries.reduce((sum, p) => sum + p.netPay, 0);
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYROLL_RUN_CREATED',
        entityType: 'PAYROLL',
        entityId: payrollId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          period: periodString,
          employeeCount: employees.length,
          totalAmount,
          netAmount
        })
      }
    });
    
    return NextResponse.json({
      message: 'Payroll run created successfully',
      payroll: {
        id: payrollId,
        period: periodString,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        date: paymentDate.toISOString(),
        totalAmount,
        employeeCount: employees.length,
        status: 'Pending',
        taxes: totalAmount - totalDeductions - netAmount,
        netAmount,
        employees: employees.map(e => e.id)
      },
      entries: payrollEntries.length
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating payroll run:', error);
    return NextResponse.json(
      { error: 'Failed to create payroll run. Please try again.' },
      { status: 500 }
    );
  }
}