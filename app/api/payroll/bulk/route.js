// app/api/payroll/bulk/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Format dates
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    
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
    
    for (const employee of employees) {
      try {
        // Calculate base salary (prorated if needed)
        let basicSalary = employee.salary || 0;
        
        // Handle any customizations per employee if provided
        const employeeOverride = body.employeeOverrides?.find(override => override.employeeId === employee.id);
        if (employeeOverride) {
          if (employeeOverride.basicSalary !== undefined) {
            basicSalary = employeeOverride.basicSalary;
          }
        }
        
        // Calculate deductions (tax, benefits, etc.)
        const deductions = employeeOverride?.deductions || body.defaultDeductions || 0;
        
        // Calculate additions (bonuses, allowances, etc.)
        const additions = employeeOverride?.additions || body.defaultAdditions || 0;
        
        // Calculate net pay
        const netPay = basicSalary + additions - deductions;
        
        // Create the payroll record
        const payroll = await prisma.payroll.create({
          data: {
            employeeId: employee.id,
            tenantId: user.tenantId,
            periodStart,
            periodEnd,
            basicSalary,
            deductions,
            additions,
            netPay,
            status: body.status || 'Draft',
            notes: body.notes || `Bulk payroll for ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`
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

    // Create accounting journal entries for payroll
    if (payrollRecords.length > 0 && body.status === 'Completed') {
      try {
        const totalGrossPay = payrollRecords.reduce((sum, payroll) => sum + payroll.basicSalary + payroll.additions, 0);
        const totalDeductions = payrollRecords.reduce((sum, payroll) => sum + payroll.deductions, 0);
        const totalNetPay = payrollRecords.reduce((sum, payroll) => sum + payroll.netPay, 0);
        
        // Create journal entry for payroll expenses
        const journalEntryData = {
          date: new Date(),
          description: `Payroll for ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`,
          reference: `PAYROLL-${periodStart.getFullYear()}-${(periodStart.getMonth() + 1).toString().padStart(2, '0')}`,
          status: 'Posted',
          lines: [
            // Debit: Payroll Expenses
            {
              accountId: '6011', // Salaries & Wages
              description: 'Salaries & Wages',
              debit: totalGrossPay,
              credit: 0
            },
            // Debit: Employee Benefits (if any)
            ...(totalDeductions > 0 ? [{
              accountId: '6012', // Employee Benefits
              description: 'Employee Benefits & Deductions',
              debit: totalDeductions,
              credit: 0
            }] : []),
            // Credit: Payroll Liabilities
            {
              accountId: '2030', // Payroll Liabilities
              description: 'Payroll Liabilities',
              debit: 0,
              credit: totalNetPay
            }
          ]
        };

        // Create the journal entry
        const journalEntryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/journal-entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify(journalEntryData)
        });

        if (journalEntryResponse.ok) {
          console.log('Payroll journal entry created successfully');
        } else {
          console.error('Failed to create payroll journal entry:', await journalEntryResponse.text());
        }
      } catch (accountingError) {
        console.error('Error creating payroll journal entry:', accountingError);
        // Don't fail the entire payroll process if accounting fails
      }
    }
    
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