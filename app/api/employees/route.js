import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const data = await request.json();
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
    if (!data.name || !data.email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }
    
    // Check if email already exists
    const existingEmployee = await prisma.employee.findFirst({
      where: { 
        email: data.email,
        tenantId: user.tenantId
      },
    });
    
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'An employee with this email already exists' },
        { status: 400 }
      );
    }
    
    // Generate employee ID
    const employeeCount = await prisma.employee.count({
      where: { tenantId: user.tenantId }
    });
    const employeeId = `EMP${String(employeeCount + 1).padStart(4, '0')}`;
    
    // Create new employee with all form fields
    const employeeData = {
      employeeId,
      name: data.name,
      email: data.email,
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
    console.error('Error creating employee:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Database constraint violation. Please check your data and try again.' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An employee with this email already exists.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create employee', details: error.message },
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