// app/api/users/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// GET - Export users data
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'users.export');
    if (perm) return perm;

    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    // Build filter object
    const where = {
      tenantId: user.tenantId
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (role && role !== 'all') {
      where.roleId = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch users with role information
    const users = await prisma.user.findMany({
      where,
      include: {
        role: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format users for export
    const exportData = users.map(user => ({
      Name: user.name || '',
      Email: user.email || '',
      Role: user.role?.name || 'No Role',
      Department: user.department || '',
      Status: user.status || 'inactive',
      'Last Login': user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
      'Created Date': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
    }));

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON
    return NextResponse.json({
      users: exportData,
      exportDate: new Date().toISOString(),
      totalUsers: exportData.length
    });

  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json(
      { error: 'Failed to export users. Please try again.' },
      { status: 500 }
    );
  }
} 