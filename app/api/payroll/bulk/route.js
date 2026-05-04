// app/api/payroll/bulk/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { normalizePayrollMonthPeriod } from '@/lib/dateUtils';
import { calculatePayroll, toPayrollNumber } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

function roundPayrollMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeDeductionIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'object' ? item?.id || item?.deductionId : item))
      .filter(Boolean)
      .map(String);
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }
  return [];
}

/**
 * POST - Create payroll records for multiple employees for a specified period
 */
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.periodStart || !body.periodEnd || !body.employeeIds || !Array.isArray(body.employeeIds)) {
      return NextResponse.json(
        { error: 'Missing required payroll information' },
        { status: 400 }
      );
    }
    
    // Normalize to 1st and last day of month (calendar-safe YYYY-MM-DD)
    const { periodStart, periodEnd } = normalizePayrollMonthPeriod(body.periodStart, body.periodEnd);
    
    // Validate period
    if (periodStart >= periodEnd) {
      return NextResponse.json(
        { error: 'Period start date must be before end date' },
        { status: 400 }
      );
    }
    
    // Fetch the selected employees
    const employees = await prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        id: {
          in: body.employeeIds
        }
      },
      include: {
        employeeBenefits: {
          include: {
            benefit: true
          }
        }
      }
    });
    
    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No valid employees found' },
        { status: 400 }
      );
    }
    
    // Create payroll records for each employee
    const payrollRecords = [];
    const errors = [];
    const requestedStatus = body.status || 'Draft';
    const payrollStatus = requestedStatus === 'Completed' ? 'Pending' : requestedStatus;
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
        const rates = npsRatesFromTenantSettingsRow(row);
        npsEmployeeRatePercent = rates.npsEmployeeRatePercent;
        npsEmployerRatePercent = rates.npsEmployerRatePercent;
      }
    } catch (error) {
      console.warn('Bulk payroll could not read tenant NPS rates:', error?.message || error);
    }
    
    for (const employee of employees) {
      try {
        let basicSalary =
          employee.grossSalary != null && Number(employee.grossSalary) > 0
            ? Number(employee.grossSalary)
            : Number(employee.salary) || 0;
        
        // Handle any customizations per employee if provided
        const employeeOverride = body.employeeOverrides?.find(override => override.employeeId === employee.id);
        if (employeeOverride) {
          if (employeeOverride.basicSalary !== undefined) {
            basicSalary = employeeOverride.basicSalary;
          }
        }
        
        const benefitAllowances = {};
        const benefitsTotal = (employee.employeeBenefits || []).reduce((sum, eb) => {
          const amount = toPayrollNumber(eb.amount) ?? 0;
          if (amount > 0 && eb.benefit?.name) {
            benefitAllowances[eb.benefit.name] = amount;
          }
          return sum + amount;
        }, 0);
        const manualAdditions = Number(employeeOverride?.additions || body.defaultAdditions || 0) || 0;
        const manualDeductions = Number(employeeOverride?.deductions || body.defaultDeductions || 0) || 0;
        const ids = normalizeDeductionIds(employee.selectedDeductions);
        const selectedDeductions =
          ids.length > 0
            ? await prisma.deduction.findMany({
                where: { id: { in: ids }, tenantId: user.tenantId, isActive: true },
              })
            : [];
        const calc = calculatePayroll(basicSalary, selectedDeductions, {
          npsEmployeeRatePercent,
          npsEmployerRatePercent,
        });
        const additions = roundPayrollMoney(benefitsTotal + manualAdditions);
        const deductions = roundPayrollMoney(calc.totalDeductions + manualDeductions);
        const netPay = roundPayrollMoney(calc.netPay + additions - manualDeductions);
        const notes = JSON.stringify({
          allowances: benefitAllowances,
          manualAdditions,
          manualDeductions,
          bulkNote: body.notes || null,
          payeTaxableIncome: calc.payeTaxableIncome ?? null,
          npsEmployeeAmount: calc.nps.employeeAmount || 0,
          npsEmployerAmount: calc.nps.employerAmount || 0,
          npsEmployeeRatePercent: calc.npsRatesApplied?.employeeRatePercent ?? null,
          npsEmployerRatePercent: calc.npsRatesApplied?.employerRatePercent ?? null,
        });
        
        // Create the payroll record
        const payroll = await prisma.payroll.create({
          data: {
            employeeId: employee.id,
            tenantId: user.tenantId,
            periodStart,
            periodEnd,
            basicSalary: roundPayrollMoney(basicSalary),
            grossPay: roundPayrollMoney(basicSalary),
            deductions,
            additions,
            netPay,
            payeAmount: calc.paye.payeAmount || 0,
            totalNpsAmount: calc.nps.totalAmount || 0,
            status: payrollStatus,
            notes
          },
          include: {
            employee: {
              select: {
                name: true,
                position: true,
                department: true
              }
            }
          }
        });
        
        payrollRecords.push(payroll);
      } catch (error) {
        console.error(`Error creating payroll for employee ${employee.id}:`, error);
        errors.push({
          employeeId: employee.id,
          employeeName: employee.name,
          error: error.message
        });
      }
    }
    
    // Log the bulk action
    console.log('Bulk payroll creation:', {
      action: 'BULK_PAYROLL_CREATED',
      userId: user.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      employeeCount: payrollRecords.length,
      totalProcessed: employees.length,
      errorCount: errors.length
    });

    // Return the created payroll records and any errors
    return NextResponse.json({
      message: `Successfully processed ${payrollRecords.length} out of ${employees.length} payrolls`,
      payrolls: payrollRecords,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        totalEmployees: employees.length,
        processedSuccessfully: payrollRecords.length,
        failed: errors.length,
        totalNetPay: payrollRecords.reduce((sum, payroll) => sum + payroll.netPay, 0),
        totalPAYE: payrollRecords.reduce((sum, payroll) => sum + (payroll.payeAmount || 0), 0),
        totalNPS: payrollRecords.reduce((sum, payroll) => sum + (payroll.totalNpsAmount || 0), 0),
        accountingPosting: 'not_posted_use_enhanced_payroll_for_gl',
        requestedStatus,
        storedStatus: payrollStatus,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString()
      }
    }, {
      status: errors.length > 0 ? 207 : 201 // 207 Multi-Status if there were partial failures
    });
  } catch (error) {
    console.error('Error processing bulk payroll:', error);
    return NextResponse.json(
      { error: `Failed to process bulk payroll: ${error.message}` },
      { status: 500 }
    );
  }
}
