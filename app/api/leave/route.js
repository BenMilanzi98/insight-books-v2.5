// app/api/leave/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// First, we need to add the Leave model to the Prisma schema
// This would normally be added to the schema.prisma file:
/*
model LeaveRequest {
  id           String    @id @default(cuid())
  employeeId   String
  type         String    // Annual, Sick, Maternity, etc.
  startDate    DateTime
  endDate      DateTime
  status       String    // Pending, Approved, Rejected
  notes        String?
  approvedById String?
  approvedAt   DateTime?
  requestDate  DateTime  @default(now())
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  tenantId     String
  employee     Employee  @relation(fields: [employeeId], references: [id])
  approvedBy   User?     @relation(fields: [approvedById], references: [id])
  tenant       Tenant    @relation(fields: [tenantId], references: [id])

  @@index([employeeId])
  @@index([tenantId])
  @@index([status])
}
*/

// For this example, we'll assume the model has been added

// GET - Fetch leave requests with filtering and pagination
export async function GET(request) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.view');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'requestDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add status filter if provided
    if (status && status !== 'All') {
      where.status = status;
    }
    
    // Add employee filter if provided
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    // Add leave type filter if provided
    if (type && type !== 'All') {
      where.type = type;
    }
    
    // Add date range filters if provided
    if (from) {
      where.startDate = {
        ...where.startDate,
        gte: new Date(from)
      };
    }
    
    if (to) {
      where.endDate = {
        ...where.endDate,
        lte: new Date(to)
      };
    }
    
    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch leave requests
    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            department: true,
            position: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    // Format the response data
    const formattedRequests = leaveRequests.map(request => ({
      id: request.id,
      employee: request.employee.name,
      employeeId: request.employee.id,
      department: request.employee.department,
      position: request.employee.position,
      type: request.type,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      duration: Math.ceil((request.endDate - request.startDate) / (1000 * 60 * 60 * 24) + 1),
      status: request.status,
      requestDate: request.requestDate.toISOString(),
      notes: request.notes,
      approvedBy: request.approvedBy?.name || null,
      approvedAt: request.approvedAt?.toISOString() || null
    }));
    
    // Return leave requests with pagination metadata
    return NextResponse.json({
      leaveRequests: formattedRequests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave requests. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new leave request
export async function POST(request) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.create');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const body = await request.json();
    
    // Validate required fields
    if (!body.employeeId || !body.type || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Employee ID, leave type, start date, and end date are required' },
        { status: 400 }
      );
    }
    
    // Validate date range
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    
    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 }
      );
    }
    
    // Check if employee exists
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
    
    // Check for overlapping leave requests
    const overlappingRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: body.employeeId,
        status: { in: ['Pending', 'Approved'] },
        OR: [
          {
            // Request starts during an existing leave
            startDate: {
              lte: endDate
            },
            endDate: {
              gte: startDate
            }
          }
        ]
      }
    });
    
    if (overlappingRequests.length > 0) {
      return NextResponse.json(
        { error: 'There is an overlapping leave request for this period' },
        { status: 400 }
      );
    }
    
    // Create the leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: body.employeeId,
        type: body.type,
        startDate,
        endDate,
        status: 'Pending',
        notes: body.notes || null,
        requestDate: new Date(),
        tenantId: user.tenantId
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_CREATED',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveRequest.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeId: body.employeeId,
          employeeName: employee.name,
          type: body.type,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      }
    });
    
    return NextResponse.json({
      message: 'Leave request created successfully',
      leaveRequest: {
        ...leaveRequest,
        employee: {
          id: employee.id,
          name: employee.name,
          department: employee.department,
          position: employee.position
        }
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json(
      { error: 'Failed to create leave request. Please try again.' },
      { status: 500 }
    );
  }
}