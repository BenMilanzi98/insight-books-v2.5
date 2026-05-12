// app/api/payroll/payslips/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { computeMalawiPayeMonthly } from '@/lib/malawiPAYE';
import { getPayrollStatutoryBreakdown } from '@/lib/payrollStatutoryBreakdown';

// POST - Generate payslips for a payroll period or specific employee
export async function POST(request) {
  try {
    // Get user from session without permission check
    const user = await getUserFromSession(request);
    
    // If no user is found, return a more specific error
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated or session expired' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    if (!body.payrollId && !body.employeeId) {
      return NextResponse.json(
        { error: 'Either payrollId or employeeId is required' },
        { status: 400 }
      );
    }
    
    // If payrollId is provided, generate payslips for all employees in that period
    if (body.payrollId) {
      // Parse the payroll ID to get the year and month
      const matches = body.payrollId.match(/PAY-(\d{4})-(\d{2})/);
      
      if (!matches) {
        return NextResponse.json(
          { error: 'Invalid payroll ID format' },
          { status: 400 }
        );
      }
      
      const year = parseInt(matches[1]);
      const month = parseInt(matches[2]) - 1; // JavaScript months are 0-indexed
      
      // Calculate period start date
      const periodStart = new Date(year, month, 1);
      
      // Fetch all payroll entries for this period
      const payrollEntries = await prisma.payroll.findMany({
        where: {
          // Remove the tenantId field since it's not in your schema
          periodStart: {
            gte: periodStart,
            lt: new Date(year, month + 1, 1) // First day of next month
          }
        },
        include: {
          employee: true
        }
      });
      
      if (payrollEntries.length === 0) {
        return NextResponse.json(
          { error: 'No payroll records found for this period' },
          { status: 404 }
        );
      }
      
      // Generate payslips
      const payslips = payrollEntries.map(entry => {
        // Create payslip reference number
        const refNumber = `PS-${periodStart.toLocaleString('default', { month: 'short' }).toUpperCase()}-${year}-${String(entry.employeeId).padStart(3, '0')}`;
        
        const statutory = getPayrollStatutoryBreakdown(entry);
        const grossPay = Number(entry.grossPay || entry.basicSalary || 0) || 0;
        const benefitsTotal = Number(entry.additions || 0) || 0;
        const benefits = benefitsTotal > 0 ? { additions: benefitsTotal } : {};
        const storedTax = entry.payeAmount == null ? NaN : Number(entry.payeAmount);
        const parsedTax = Number(statutory.payeAmount);
        const tax = Number.isFinite(storedTax)
          ? storedTax
          : Number.isFinite(parsedTax)
            ? parsedTax
            : computeMalawiPayeMonthly(grossPay).payeAmount;
        const pension = Number(statutory.npsEmployeeAmount || 0) || 0;
        const storedDeductions = entry.deductions == null ? NaN : Number(entry.deductions);
        const deductionsTotal = Number.isFinite(storedDeductions) ? storedDeductions : tax + pension;
        const otherDeductions = Math.max(0, deductionsTotal - tax - pension);
        const deductions = {
          paye: tax,
          pension,
          ...(otherDeductions > 0 ? { other: otherDeductions } : {})
        };
        const storedNetPay = entry.netPay == null ? NaN : Number(entry.netPay);
        const netPay = Number.isFinite(storedNetPay) ? storedNetPay : grossPay - deductionsTotal + benefitsTotal;
        
        // Generate YTD figures (simplified - just multiply by the month number)
        const currentMonth = periodStart.getMonth() + 1; // 1-indexed month
        const ytdEarnings = (grossPay + benefitsTotal) * currentMonth;
        const ytdTax = tax * currentMonth;
        const ytdNetPay = netPay * currentMonth;
        
        return {
          employee: {
            id: entry.employee.id,
            name: entry.employee.name,
            position: entry.employee.position,
            department: entry.employee.department,
            bankAccount: "Bank Account", // Replace with actual field from your schema
            taxID: "Tax ID" // Replace with actual field from your schema
          },
          payPeriod: `${periodStart.toLocaleString('default', { month: 'long' })} ${year}`,
          refNumber,
          issueDate: new Date().toISOString(),
          salary: entry.basicSalary,
          benefits,
          benefitsTotal,
          grossPay,
          deductions,
          deductionsTotal,
          tax,
          netPay,
          yearToDate: {
            earnings: ytdEarnings,
            tax: ytdTax,
            netPay: ytdNetPay
          },
          payrollEntryId: entry.id
        };
      });
      
      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          action: 'PAYSLIPS_GENERATED',
          entityType: 'PAYROLL',
          entityId: body.payrollId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            count: payslips.length,
            period: `${periodStart.toLocaleString('default', { month: 'long' })} ${year}`
          })
        }
      });
      
      return NextResponse.json({
        message: `${payslips.length} payslips generated successfully`,
        payslips
      });
    }
    
    // If employeeId is provided, generate a single payslip for that employee
    if (body.employeeId) {
      // Validate period
      if (!body.period) {
        return NextResponse.json(
          { error: 'Period is required for single employee payslip' },
          { status: 400 }
        );
      }
      
      // Parse period (expected format: "Month YYYY", e.g., "March 2025")
      const periodParts = body.period.split(' ');
      if (periodParts.length !== 2) {
        return NextResponse.json(
          { error: 'Invalid period format. Expected "Month YYYY"' },
          { status: 400 }
        );
      }
      
      const month = new Date(Date.parse(`${periodParts[0]} 1, ${periodParts[1]}`)).getMonth();
      const year = parseInt(periodParts[1]);
      
      if (isNaN(month) || isNaN(year)) {
        return NextResponse.json(
          { error: 'Invalid period. Could not parse month or year.' },
          { status: 400 }
        );
      }
      
      // Fetch the employee
      const employee = await prisma.employee.findFirst({
        where: {
          id: body.employeeId,
          tenantId: user.tenantId
        }
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }
      
      // Fetch payroll entry if it exists
      const periodStart = new Date(year, month, 1);
      const payrollEntry = await prisma.payroll.findFirst({
        where: {
          employeeId: employee.id,
          // Remove the tenantId field since it's not in your schema
          periodStart: {
            gte: periodStart,
            lt: new Date(year, month + 1, 1)
          }
        }
      });
      
      // Use actual payroll data if it exists, otherwise generate estimation
      const basicSalary = payrollEntry ? payrollEntry.basicSalary : employee.salary;
      
      // Create payslip reference number
      const refNumber = `PS-${periodStart.toLocaleString('default', { month: 'short' }).toUpperCase()}-${year}-${String(employee.id).padStart(3, '0')}`;
      
      const grossPay = payrollEntry
        ? Number(payrollEntry.grossPay || payrollEntry.basicSalary || 0) || 0
        : Number(basicSalary || 0) || 0;

      let benefits = {};
      let benefitsTotal = 0;
      let deductions = {};
      let deductionsTotal = 0;
      let tax = 0;
      let netPay = 0;

      if (payrollEntry) {
        const statutory = getPayrollStatutoryBreakdown(payrollEntry);
        benefitsTotal = Number(payrollEntry.additions || 0) || 0;
        benefits = benefitsTotal > 0 ? { additions: benefitsTotal } : {};
        const storedTax = payrollEntry.payeAmount == null ? NaN : Number(payrollEntry.payeAmount);
        const parsedTax = Number(statutory.payeAmount);
        tax = Number.isFinite(storedTax)
          ? storedTax
          : Number.isFinite(parsedTax)
            ? parsedTax
            : computeMalawiPayeMonthly(grossPay).payeAmount;
        const pension = Number(statutory.npsEmployeeAmount || 0) || 0;
        const storedDeductions = payrollEntry.deductions == null ? NaN : Number(payrollEntry.deductions);
        deductionsTotal = Number.isFinite(storedDeductions) ? storedDeductions : tax + pension;
        const otherDeductions = Math.max(0, deductionsTotal - tax - pension);
        deductions = {
          paye: tax,
          pension,
          ...(otherDeductions > 0 ? { other: otherDeductions } : {})
        };
        const storedNetPay = payrollEntry.netPay == null ? NaN : Number(payrollEntry.netPay);
        netPay = Number.isFinite(storedNetPay) ? storedNetPay : grossPay - deductionsTotal + benefitsTotal;
      } else {
        benefits = {
          housing: Math.round(grossPay * 0.1),
          transport: Math.round(grossPay * 0.05)
        };
        benefitsTotal = Object.values(benefits).reduce((sum, value) => sum + value, 0);
        const pension = Math.round(grossPay * 0.05);
        tax = Math.round(computeMalawiPayeMonthly(grossPay).payeAmount);
        deductions = { paye: tax, pension };
        deductionsTotal = Object.values(deductions).reduce((sum, value) => sum + value, 0);
        netPay = grossPay - deductionsTotal + benefitsTotal;
      }
      
      // Generate YTD figures (simplified - just multiply by the month number)
      const currentMonth = month + 1; // 1-indexed month
      const ytdEarnings = (grossPay + benefitsTotal) * currentMonth;
      const ytdTax = tax * currentMonth;
      const ytdNetPay = netPay * currentMonth;
      
      const payslip = {
        employee: {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          department: employee.department,
          bankAccount: "Bank Account", // Replace with actual field
          taxID: "Tax ID" // Replace with actual field
        },
        payPeriod: body.period,
        refNumber,
        issueDate: new Date().toISOString(),
        salary: basicSalary,
        benefits,
        benefitsTotal,
        grossPay,
        deductions,
        deductionsTotal,
        tax,
        netPay,
        yearToDate: {
          earnings: ytdEarnings,
          tax: ytdTax,
          netPay: ytdNetPay
        },
        payrollEntryId: payrollEntry ? payrollEntry.id : null,
        isEstimate: !payrollEntry
      };
      
      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          action: 'SINGLE_PAYSLIP_GENERATED',
          entityType: 'EMPLOYEE',
          entityId: employee.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            employeeName: employee.name,
            period: body.period,
            isEstimate: !payrollEntry
          })
        }
      });
      
      return NextResponse.json({
        message: 'Payslip generated successfully',
        payslip
      });
    }
    
  } catch (error) {
    console.error('Error generating payslips:', error);
    // More detailed error logging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { error: 'Failed to generate payslips: ' + error.message },
      { status: 500 }
    );
  }
}
