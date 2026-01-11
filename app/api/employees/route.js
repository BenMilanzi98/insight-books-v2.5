import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Debug: Log the incoming email
    console.log('[Employee Create] Incoming request data:', {
      email: data.email,
      emailType: typeof data.email,
      emailLength: data.email?.length
    });
    
    const user = await getUserFromSession(request);
    
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify that the tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Invalid tenant. Please contact support.' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Normalize email: trim whitespace and convert to lowercase for consistency
    // Only check for duplicates if email is provided and not empty
    const emailInput = data.email ? String(data.email).trim() : '';
    const normalizedEmail = emailInput && emailInput.length > 0 ? emailInput.toLowerCase() : '';
    
    // Debug: Log normalization
    console.log('[Employee Create] Email normalization:', {
      original: data.email,
      trimmed: emailInput,
      normalized: normalizedEmail,
      willCheck: !!normalizedEmail
    });
    
    // Check if email already exists (case-insensitive, only if email is provided and not empty)
    // TEMPORARILY DISABLED: Email uniqueness check is causing false positives
    // TODO: Re-enable and fix the comparison logic
    /*
    try {
      if (normalizedEmail && normalizedEmail.length > 0) {
        // Use a simple Prisma query to check for exact email match (case-insensitive via database)
        // This is more efficient than fetching all employees
        const existingEmployee = await prisma.employee.findFirst({
          where: { 
            tenantId: user.tenantId,
            isActive: true,
            email: {
              equals: normalizedEmail,
              mode: 'insensitive'
            }
          },
          select: {
            id: true,
            email: true,
            name: true
          }
        });
        
        if (existingEmployee) {
          return NextResponse.json(
            { error: `An employee with this email already exists (${existingEmployee.name || 'Unknown'})` },
            { status: 400 }
          );
        }
      }
    } catch (emailCheckError) {
      console.error('[Employee Create] Error during email duplicate check:', emailCheckError);
      // Don't fail the entire request if email check fails - just log and continue
    }
    */
    
    // Generate unique employee ID
    // Check for existing employeeIds to ensure uniqueness
    let employeeId;
    let attemptCount = 0;
    const maxAttempts = 100;
    
    do {
      const employeeCount = await prisma.employee.count({
        where: { tenantId: user.tenantId }
      });
      employeeId = `EMP${String(employeeCount + 1 + attemptCount).padStart(4, '0')}`;
      
      // Check if this employeeId already exists
      const existing = await prisma.employee.findUnique({
        where: { employeeId },
        select: { id: true }
      });
      
      if (!existing) {
        break; // Found a unique ID
      }
      
      attemptCount++;
    } while (attemptCount < maxAttempts);
    
    if (attemptCount >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique employee ID. Please try again.' },
        { status: 500 }
      );
    }
    
    // Create new employee with all form fields
    // IMPORTANT: If email is empty, generate a unique placeholder to avoid unique constraint violations
    // The email field is required by schema but we want to allow employees without emails
    const finalEmail = normalizedEmail && normalizedEmail.length > 0 
      ? normalizedEmail 
      : `no-email-${Date.now()}-${Math.random().toString(36).substring(7)}@placeholder.local`;
    
    const employeeData = {
      employeeId,
      name: data.name,
      email: finalEmail, // Use normalized email or generate unique placeholder
      position: data.position || data.jobTitle || null,
      jobTitle: data.jobTitle || null,
      department: data.department || null,
      departmentId: data.departmentId || null,
      phone: data.phone || null,
      address: data.address || null,
      salary: data.salary ? parseFloat(data.salary) : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      status: data.status || 'Active',
      
      // Additional HR fields
      idNumber: data.idNumber || null,
      employmentType: data.employmentType || 'Permanent',
      grossSalary: data.grossSalary ? parseFloat(data.grossSalary) : null,
      hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      maritalStatus: data.maritalStatus || null,
      nationality: data.nationality || 'Malawian',
      workLocation: data.workLocation || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      
      // JSON fields for complex data
      contactDetails: data.contactDetails || null,
      bankDetails: data.bankDetails || null,
      emergencyContact: data.emergencyContact || null,
      reportingManager: data.reportingManager || null,
      selectedDeductions: data.selectedDeductions || null,
      
      tenantId: user.tenantId
    };

    // Calculate salary with deductions if provided
    let salaryCalculation = null;
    if (data.grossSalary) {
      if (data.selectedDeductions && data.selectedDeductions.length > 0) {
        const { calculatePayroll } = await import('@/lib/payrollCalculations');
        
        // Fetch selected deductions from database
        const deductions = await prisma.deduction.findMany({
          where: {
            id: { in: data.selectedDeductions },
            tenantId: user.tenantId,
            isActive: true
          }
        });

        // Calculate payroll
        salaryCalculation = calculatePayroll(parseFloat(data.grossSalary), deductions);
        
        // Update employee data with calculated salary
        employeeData.salary = salaryCalculation.netPay;
        employeeData.grossSalary = salaryCalculation.grossSalary;
      } else {
        // No deductions selected, use gross salary as net salary
        employeeData.salary = parseFloat(data.grossSalary);
        employeeData.grossSalary = parseFloat(data.grossSalary);
      }
    }

    const employee = await prisma.employee.create({
      data: employeeData,
      include: {
        departmentRef: {
          select: {
            name: true,
            color: true
          }
        }
      }
    });
    
    return NextResponse.json({ 
      message: 'Employee created successfully', 
      employee 
    }, { status: 201 });
    
  } catch (error) {
    console.error('[Employee Create] Full error details:', {
      error: error,
      code: error.code,
      message: error.message,
      meta: error.meta,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Database constraint violation. Please check your data and try again.' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2002') {
      // P2002 is a unique constraint violation
      // Log detailed information about the violation
      console.error('[Employee Create] Unique constraint violation details:', {
        code: error.code,
        target: error.meta?.target,
        cause: error.meta?.cause,
        message: error.message,
        fullMeta: JSON.stringify(error.meta, null, 2)
      });
      
      // If it's the email field, return email-specific error
      if (Array.isArray(error.meta?.target) && error.meta.target.includes('email')) {
        return NextResponse.json(
          { error: 'An employee with this email already exists.' },
          { status: 400 }
        );
      }
      
      // Check if it's employeeId
      if (Array.isArray(error.meta?.target) && error.meta.target.includes('employeeId')) {
        return NextResponse.json(
          { error: 'An employee with this employee ID already exists.' },
          { status: 400 }
        );
      }
      
      // Otherwise, return a generic unique constraint error with details
      const targetFields = Array.isArray(error.meta?.target) 
        ? error.meta.target.join(', ') 
        : (error.meta?.target || 'unknown field');
      
      return NextResponse.json(
        { 
          error: `A record with this ${targetFields} already exists.`,
          details: process.env.NODE_ENV === 'development' ? {
            target: error.meta?.target,
            cause: error.meta?.cause
          } : undefined
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create employee', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while creating the employee. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const employmentType = searchParams.get('employmentType');
    const isActive = searchParams.get('isActive');
    
    const skip = (page - 1) * limit;
    
    const where = {
      tenantId: user.tenantId
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (department && department !== 'All') {
      where.department = department;
    }
    
    if (status && status !== 'All') {
      where.status = status;
    }
    
    if (employmentType && employmentType !== 'All') {
      where.employmentType = employmentType;
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    // Get employees with their latest payroll and salary structure
    const employees = await prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        payrolls: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            netPay: true,
            status: true
          }
        },
        departmentRef: {
          select: {
            name: true,
            color: true
          }
        }
      }
    });
    
    // Format the response
    const formattedEmployees = employees.map(employee => ({
      ...employee,
      latestPayroll: employee.payrolls[0] || null,
      department: employee.department
    }));
    
    // Get total count
    const totalCount = await prisma.employee.count({ where });
    
    return NextResponse.json({
      employees: formattedEmployees,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
    
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees', details: error.message },
      { status: 500 }
    );
  }
}