import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { format, filters, selectedUsers } = body;

    // Validate required fields
    if (!format) {
      return NextResponse.json(
        { success: false, error: 'Export format is required' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['csv', 'excel', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid export format' },
        { status: 400 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const role = searchParams.get('role') || 'all';
    const tenant = searchParams.get('tenant') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';

    // Fetch users based on filters (mock data for now)
    const users = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'Admin',
        tenant: 'Company A',
        status: 'active',
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        createdAt: new Date('2024-01-15'),
        phone: '+1234567890',
        department: 'IT'
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'Manager',
        tenant: 'Company B',
        status: 'active',
        lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        createdAt: new Date('2024-02-01'),
        phone: '+1234567891',
        department: 'Sales'
      },
      {
        id: '3',
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        role: 'User',
        tenant: 'Company A',
        status: 'inactive',
        lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        createdAt: new Date('2024-03-10'),
        phone: '+1234567892',
        department: 'Marketing'
      }
    ];

    // Apply filters
    let filteredUsers = users;
    
    if (status !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.status === status);
    }
    
    if (role !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }
    
    if (tenant !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.tenant === tenant);
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      
      filteredUsers = filteredUsers.filter(user => user.createdAt >= startDate);
    }

    // If specific users are selected, filter to only those
    if (selectedUsers && Array.isArray(selectedUsers) && selectedUsers.length > 0) {
      filteredUsers = filteredUsers.filter(user => selectedUsers.includes(user.id));
    }

    // Prepare export data based on format
    let exportData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        exportData = generateCSV(filteredUsers);
        contentType = 'text/csv';
        filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'excel':
        exportData = generateExcel(filteredUsers);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `users-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        break;

      case 'json':
        exportData = JSON.stringify(filteredUsers, null, 2);
        contentType = 'application/json';
        filename = `users-export-${new Date().toISOString().split('T')[0]}.json`;
        break;

      case 'pdf':
        exportData = generatePDF(filteredUsers);
        contentType = 'application/pdf';
        filename = `users-export-${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported export format' },
          { status: 400 }
        );
    }

    // Create admin audit log for export
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'USER_EXPORT',
        entityType: 'USER',
        entityId: 'BULK_EXPORT',
        details: `Exported ${filteredUsers.length} users in ${format.toUpperCase()} format`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Return the export data
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(exportData, 'utf8').toString()
      }
    });

  } catch (error) {
    console.error('Admin user export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export users' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to generate CSV
function generateCSV(users) {
  const headers = ['ID', 'Name', 'Email', 'Role', 'Tenant', 'Status', 'Last Login', 'Created At', 'Phone', 'Department'];
  const rows = users.map(user => [
    user.id,
    user.name,
    user.email,
    user.role,
    user.tenant,
    user.status,
    user.lastLogin.toISOString(),
    user.createdAt.toISOString(),
    user.phone || '',
    user.department || ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
}

// Helper function to generate Excel (simplified - returns CSV for now)
function generateExcel(users) {
  // In a real implementation, you would use a library like 'xlsx' to generate actual Excel files
  // For now, we'll return CSV format
  return generateCSV(users);
}

// Helper function to generate PDF (simplified - returns text for now)
function generatePDF(users) {
  // In a real implementation, you would use a library like 'puppeteer' or 'jsPDF' to generate actual PDFs
  // For now, we'll return a formatted text representation
  let pdfContent = 'USER EXPORT REPORT\n';
  pdfContent += `Generated: ${new Date().toISOString()}\n`;
  pdfContent += `Total Users: ${users.length}\n\n`;

  users.forEach((user, index) => {
    pdfContent += `${index + 1}. ${user.name} (${user.email})\n`;
    pdfContent += `   Role: ${user.role}\n`;
    pdfContent += `   Tenant: ${user.tenant}\n`;
    pdfContent += `   Status: ${user.status}\n`;
    pdfContent += `   Last Login: ${user.lastLogin.toISOString()}\n`;
    pdfContent += `   Created: ${user.createdAt.toISOString()}\n\n`;
  });

  return pdfContent;
} 