// app/api/employees/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// GET - Fetch a single employee by ID
export async function GET(request, { params }) {
  try {
    // Get the user first
    const user = await getUserFromSession(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Check permission with proper error handling
    const hasPermission = await requirePermission(request, 'employees.view');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to view employee details' },
        { status: 403 }
      );
    }
    
    const { id: employeeId } = await params;
    
    // Fetch the employee
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId
      },
      include: {
        payrolls: {
          orderBy: {
            periodEnd: 'desc'
          },
          take: 5
        }
      }
    });
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(employee);
    
  } catch (error) {
    console.error(`Error fetching employee:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch employee. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update an employee
export async function PUT(request, { params }) {
  try {
    // Get the user first
    const user = await getUserFromSession(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Check permission with proper error handling
    const hasPermission = await requirePermission(request, 'employees.update');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to update employee details' },
        { status: 403 }
      );
    }
    
    const { id: employeeId } = await params;
    const body = await request.json();
    
    // Check if employee exists
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Check if changing email to one that already exists (case-insensitive)
    // Only check if email is provided and not empty
    let normalizedEmail;
    if (body.email !== undefined) {
      const emailInput = body.email ? body.email.trim() : '';
      normalizedEmail = emailInput ? emailInput.toLowerCase() : '';
    } else {
      normalizedEmail = undefined;
    }
    
    const existingEmailNormalized = existingEmployee.email ? existingEmployee.email.trim().toLowerCase() : '';
    
    if (normalizedEmail && normalizedEmail.length > 0 && normalizedEmail !== existingEmailNormalized) {
      // Get all employees for case-insensitive comparison
      const allEmployees = await prisma.employee.findMany({
        where: {
          tenantId: user.tenantId,
          id: {
            not: employeeId
          }
        },
        select: {
          id: true,
          email: true
        }
      });
      
      // Check if any existing email matches (case-insensitive)
      // Only compare non-empty emails
      const emailExists = allEmployees.find(emp => {
        if (!emp.email || emp.email.trim().length === 0) {
          return false; // Skip empty emails
        }
        return emp.email.trim().toLowerCase() === normalizedEmail;
      });
      
      if (emailExists) {
        return NextResponse.json(
          { error: 'An employee with this email already exists' },
          { status: 400 }
        );
      }
    }
    
    // Handle documents - store in bankDetails JSON field
    if (body.documents && Object.keys(body.documents).length > 0) {
      // Merge with existing bankDetails if it exists
      const existingBankDetails = existingEmployee.bankDetails && typeof existingEmployee.bankDetails === 'object' 
        ? existingEmployee.bankDetails 
        : {};
      body.bankDetails = {
        ...existingBankDetails,
        documents: body.documents
      };
    }

    // Prepare update data
    const updateData = {
      name: body.name !== undefined ? body.name : undefined,
      email: normalizedEmail,
      phone: body.phone !== undefined ? body.phone : undefined,
      position: body.position !== undefined ? body.position : undefined,
      jobTitle: body.jobTitle !== undefined ? body.jobTitle : undefined,
      department: body.department !== undefined ? body.department : undefined,
      departmentId: body.departmentId !== undefined ? body.departmentId : undefined,
      status: body.status !== undefined ? body.status : undefined,
      startDate: body.startDate !== undefined && body.startDate !== '' ? (() => {
        const date = new Date(body.startDate);
        return isNaN(date.getTime()) ? undefined : date;
      })() : undefined,
      address: body.address !== undefined ? body.address : undefined,
      
      // Additional HR fields
      idNumber: body.idNumber !== undefined ? body.idNumber : undefined,
      employmentType: body.employmentType !== undefined ? body.employmentType : undefined,
      hourlyRate: body.hourlyRate !== undefined ? parseFloat(body.hourlyRate) : undefined,
      dateOfBirth: body.dateOfBirth !== undefined && body.dateOfBirth !== '' ? (() => {
        const date = new Date(body.dateOfBirth);
        return isNaN(date.getTime()) ? undefined : date;
      })() : undefined,
      gender: body.gender !== undefined ? body.gender : undefined,
      maritalStatus: body.maritalStatus !== undefined ? body.maritalStatus : undefined,
      nationality: body.nationality !== undefined ? body.nationality : undefined,
      workLocation: body.workLocation !== undefined ? body.workLocation : undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
      
      // JSON fields for complex data
      contactDetails: body.contactDetails !== undefined ? body.contactDetails : undefined,
      bankDetails: body.bankDetails !== undefined ? body.bankDetails : undefined,
      emergencyContact: body.emergencyContact !== undefined ? body.emergencyContact : undefined,
      reportingManager: body.reportingManager !== undefined ? body.reportingManager : undefined,
      selectedDeductions: body.selectedDeductions !== undefined 
        ? (Array.isArray(body.selectedDeductions) && body.selectedDeductions.length > 0 ? body.selectedDeductions : null)
        : undefined
    };
    
    // Handle gratuityAccountId separately using Prisma connect/disconnect
    // Note: The relation is one-to-one where GratuityAccount has the foreign key
    // So we need to use connect/disconnect syntax
    if (body.gratuityAccountId !== undefined) {
      if (body.gratuityAccountId && String(body.gratuityAccountId).trim() !== '') {
        // Validate the gratuity account exists
        const gratuityAccount = await prisma.gratuityAccount.findFirst({
          where: {
            id: String(body.gratuityAccountId).trim(),
            tenantId: user.tenantId
          }
        });
        
        if (!gratuityAccount) {
          return NextResponse.json(
            { error: 'Invalid gratuity account selected' },
            { status: 400 }
          );
        }
        
        // Connect the gratuity account (this will work if the relation allows it)
        // Since GratuityAccount has employeeId, we can't directly set gratuityAccountId on Employee
        // Instead, we'll skip this for now as the relation structure doesn't support it
        // The gratuity account is already linked via employeeId in GratuityAccount
      }
      // If gratuityAccountId is null or empty, we don't need to do anything
      // as the relation is optional and managed on the GratuityAccount side
    }

    // Handle salary calculation
    if (body.grossSalary !== undefined) {
      if (body.selectedDeductions && body.selectedDeductions.length > 0) {
        const { calculatePayroll } = await import('@/lib/payrollCalculations');
        
        // Fetch selected deductions from database
        const deductions = await prisma.deduction.findMany({
          where: {
            id: { in: body.selectedDeductions },
            tenantId: user.tenantId,
            isActive: true
          }
        });

        const tenantSettings = await prisma.tenantSettings.findUnique({
          where: { tenantId: user.tenantId },
          select: { npsEmployeeRatePercent: true, npsEmployerRatePercent: true }
        });
        const npsOptions = {
          npsEmployeeRatePercent: Number(tenantSettings?.npsEmployeeRatePercent ?? 5) || 5,
          npsEmployerRatePercent: Number(tenantSettings?.npsEmployerRatePercent ?? 5) || 5
        };

        // Calculate payroll
        const salaryCalculation = calculatePayroll(parseFloat(body.grossSalary), deductions, npsOptions);
        
        // Update salary data
        updateData.salary = salaryCalculation.netPay;
        updateData.grossSalary = salaryCalculation.grossSalary;
      } else {
        // No deductions selected, use gross salary as net salary
        updateData.salary = parseFloat(body.grossSalary);
        updateData.grossSalary = parseFloat(body.grossSalary);
      }
    } else if (body.salary !== undefined) {
      // Direct salary update
      updateData.salary = parseFloat(body.salary);
    }

    // Remove undefined values from updateData to avoid Prisma errors
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );
    
    // Validate gratuityAccountId if provided
    if (cleanUpdateData.gratuityAccountId !== null && cleanUpdateData.gratuityAccountId !== undefined) {
      const gratuityAccount = await prisma.gratuityAccount.findFirst({
        where: {
          id: cleanUpdateData.gratuityAccountId,
          tenantId: user.tenantId
        }
      });
      
      if (!gratuityAccount) {
        return NextResponse.json(
          { error: 'Invalid gratuity account selected' },
          { status: 400 }
        );
      }
    }
    
    // Update the employee with all form fields
    const updatedEmployee = await prisma.employee.update({
      where: {
        id: employeeId
      },
      data: cleanUpdateData
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EMPLOYEE_UPDATED',
        entityType: 'EMPLOYEE',
        entityId: updatedEmployee.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: updatedEmployee.name,
          position: updatedEmployee.position,
          department: updatedEmployee.department,
          status: updatedEmployee.status
        })
      }
    });
    
    return NextResponse.json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
    });
    
  } catch (error) {
    console.error(`Error updating employee:`, error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Try to log the update data if it exists
    try {
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData || {}).filter(([_, value]) => value !== undefined)
      );
      console.error('Update data that caused error:', JSON.stringify(cleanUpdateData, null, 2));
    } catch (e) {
      console.error('Could not log update data:', e);
    }
    
    // Return more specific error messages
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A record with this information already exists', details: error.meta },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid reference to related record', details: error.meta },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update employee. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Delete the employee
    await prisma.employee.delete({
      where: { id }
    });

    return NextResponse.json({ 
      message: 'Employee deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { message: 'Failed to delete employee', error: error.message },
      { status: 500 }
    );
  }
}
// // DELETE - Delete an employee
// export async function DELETE(request, { params }) {
//   try {
//     // Get the user first
//     const user = await getUserFromSession(request);
    
//     if (!user) {
//       return NextResponse.json(
//         { error: 'Not authenticated' },
//         { status: 401 }
//       );
//     }
    
//     // Check permission with proper error handling
//     const hasPermission = await requirePermission(request, 'employees.delete');
//     if (!hasPermission) {
//       return NextResponse.json(
//         { error: 'You do not have permission to delete employees' },
//         { status: 403 }
//       );
//     }
    
//     const employeeId = params.id;
    
//     // Check if employee exists
//     const existingEmployee = await prisma.employee.findFirst({
//       where: {
//         id: employeeId,
//         tenantId: user.tenantId
//       }
//     });
    
//     if (!existingEmployee) {
//       return NextResponse.json(
//         { error: 'Employee not found' },
//         { status: 404 }
//       );
//     }
    
//     // Instead of deleting, set status to 'Inactive'
//     const updatedEmployee = await prisma.employee.update({
//       where: {
//         id: employeeId
//       },
//       data: {
//         status: 'Inactive'
//       }
//     });
    
//     // Create audit log entry
//     await prisma.auditLog.create({
//       data: {
//         action: 'EMPLOYEE_DEACTIVATED',
//         entityType: 'EMPLOYEE',
//         entityId: employeeId,
//         userId: user.id,
//         tenantId: user.tenantId,
//         details: JSON.stringify({
//           name: existingEmployee.name,
//           position: existingEmployee.position,
//           department: existingEmployee.department
//         })
//       }
//     });
    
//     return NextResponse.json({
//       message: 'Employee deactivated successfully'
//     });
    
//   } catch (error) {
//     console.error(`Error deleting employee ${params.id}:`, error);
//     return NextResponse.json(
//       { error: 'Failed to delete employee. Please try again.' },
//       { status: 500 }
//     );
//   }
// }