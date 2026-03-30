import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendEmail } from '@/lib/emailService';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

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
    
    // Generate a random unique employee ID
    const generateRandomEmployeeId = async () => {
      const maxAttempts = 100;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        // Generate a random ID using timestamp + random alphanumeric characters
        const timestamp = Date.now().toString(36); // Base36 encoding of timestamp
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 random chars
        const candidate = `${timestamp}${randomPart}`.toUpperCase();
        
        // Check if this ID already exists
        const existing = await prisma.employee.findUnique({
          where: { employeeId: candidate },
          select: { id: true }
        });
        
        if (!existing) {
          return candidate; // Found a unique ID
        }
        
        attempts += 1;
      }
      
      // Fallback: if we can't generate a unique ID after max attempts, use UUID-like format
      return `EMP${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    };
    
    const employeeId = await generateRandomEmployeeId();
    
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
      startDate: data.startDate && data.startDate !== '' ? (() => {
        const date = new Date(data.startDate);
        return isNaN(date.getTime()) ? new Date() : date;
      })() : new Date(),
      status: data.status || 'Active',
      
      // Additional HR fields
      idNumber: data.idNumber || null,
      employmentType: data.employmentType || 'Permanent',
      grossSalary: data.grossSalary ? parseFloat(data.grossSalary) : null,
      hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
      dateOfBirth: data.dateOfBirth && data.dateOfBirth !== '' ? (() => {
        const date = new Date(data.dateOfBirth);
        return isNaN(date.getTime()) ? null : date;
      })() : null,
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

        // Fetch tenant pension rates (percentage points)
        // Use raw SQL so this works even if Prisma Client is stale.
        let npsOptions = { npsEmployeeRatePercent: null, npsEmployerRatePercent: null };
        try {
          const rows = await prisma.$queryRaw`
            SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
            FROM "TenantSettings"
            WHERE "tenantId" = ${user.tenantId}
            LIMIT 1
          `;
          const row = Array.isArray(rows) ? rows[0] : null;
          if (row) {
            npsOptions = npsRatesFromTenantSettingsRow(row);
          }
        } catch (e) {
          console.warn('[Employee Create] Raw NPS rate read failed:', e?.message || e);
        }

        // Calculate payroll
        salaryCalculation = calculatePayroll(parseFloat(data.grossSalary), deductions, npsOptions);
        
        // Update employee data with calculated salary
        employeeData.salary = salaryCalculation.netPay;
        employeeData.grossSalary = salaryCalculation.grossSalary;
      } else {
        // No deductions selected, use gross salary as net salary
        employeeData.salary = parseFloat(data.grossSalary);
        employeeData.grossSalary = parseFloat(data.grossSalary);
      }
    }

    // Handle documents - store in bankDetails JSON field
    if (data.documents && Object.keys(data.documents).length > 0) {
      employeeData.bankDetails = {
        ...(employeeData.bankDetails && typeof employeeData.bankDetails === 'object' ? employeeData.bankDetails : {}),
        documents: data.documents
      };
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

    // Send welcome email if requested and employee has a valid email
    if (data.sendEmail && normalizedEmail && normalizedEmail.length > 0 && !normalizedEmail.includes('@placeholder.local')) {
      try {
        // Get tenant info for email template
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true
          }
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const formattedStartDate = employee.startDate 
          ? new Date(employee.startDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })
          : 'TBD';

        const emailContent = `
          <p>Dear ${employee.name},</p>
          <p>Welcome to ${tenant?.name || 'our company'}! We are excited to have you join our team.</p>
          <p>Your employment details:</p>
          <ul style="margin: 16px 0; padding-left: 20px;">
            <li style="margin: 4px 0; color: #374151; line-height: 1.6;"><strong>Employee ID:</strong> ${employee.employeeId || 'N/A'}</li>
            <li style="margin: 4px 0; color: #374151; line-height: 1.6;"><strong>Position:</strong> ${employee.jobTitle || employee.position || 'N/A'}</li>
            <li style="margin: 4px 0; color: #374151; line-height: 1.6;"><strong>Department:</strong> ${employee.department || 'N/A'}</li>
            <li style="margin: 4px 0; color: #374151; line-height: 1.6;"><strong>Start Date:</strong> ${formattedStartDate}</li>
            ${employee.employmentType ? `<li style="margin: 4px 0; color: #374151; line-height: 1.6;"><strong>Employment Type:</strong> ${employee.employmentType}</li>` : ''}
          </ul>
          <p>We look forward to working with you and wish you success in your new role.</p>
          <p>If you have any questions or need assistance, please don't hesitate to contact the HR department.</p>
          <p>Once again, welcome aboard!</p>
          <p>Best regards,<br>Human Resources Department<br>${tenant?.name || 'InsightBooks'}</p>
        `;

        await sendEmail({
          to: normalizedEmail,
          subject: `Welcome to ${tenant?.name || 'InsightBooks'}!`,
          template: 'rich-email',
          data: {
            companyName: tenant?.name || 'InsightBooks',
            tenantName: tenant?.name || 'InsightBooks',
            tenantLogoUrl: tenant?.logoUrl || null,
            htmlContent: emailContent,
            baseUrl: baseUrl,
            priority: 'normal',
            showPriority: false
          }
        });

        // Log email sent
        await prisma.auditLog.create({
          data: {
            action: 'EMPLOYEE_WELCOME_EMAIL_SENT',
            entityType: 'EMPLOYEE',
            entityId: employee.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              employeeName: employee.name,
              email: normalizedEmail
            })
          }
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the employee creation if email fails
      }
    }
    
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
    
    // Get total count (with current filters including status)
    const totalCount = await prisma.employee.count({ where });

    // Build base where for stats (same filters but without status) so active/inactive counts are correct
    const whereForStats = { tenantId: user.tenantId };
    if (search) whereForStats.OR = where.OR;
    if (department && department !== 'All') whereForStats.department = department;
    if (employmentType && employmentType !== 'All') whereForStats.employmentType = employmentType;

    const [activeCount, inactiveCount] = await Promise.all([
      prisma.employee.count({ where: { ...whereForStats, isActive: true } }),
      prisma.employee.count({ where: { ...whereForStats, isActive: false } }),
    ]);
    
    return NextResponse.json({
      employees: formattedEmployees,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      statistics: {
        activeCount,
        inactiveCount,
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