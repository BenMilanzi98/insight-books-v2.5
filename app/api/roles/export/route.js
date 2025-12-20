// app/api/roles/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Export roles data
export async function GET(request) {
  try {
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
    const search = searchParams.get('search');

    // Build filter object
    const where = {
      tenantId: user.tenantId
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch roles with user counts
    const roles = await prisma.role.findMany({
      where,
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format roles for export
    const exportData = roles.map(role => ({
      'Role Name': role.name || '',
      Description: role.description || '',
      'User Count': role._count.users || 0,
      'Created Date': role.createdAt ? new Date(role.createdAt).toLocaleDateString() : '',
      Permissions: role.permissions ? JSON.stringify(role.permissions) : '{}'
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
          'Content-Disposition': `attachment; filename="roles-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default to JSON
    return NextResponse.json({
      roles: exportData,
      exportDate: new Date().toISOString(),
      totalRoles: exportData.length
    });

  } catch (error) {
    console.error('Error exporting roles:', error);
    return NextResponse.json(
      { error: 'Failed to export roles. Please try again.' },
      { status: 500 }
    );
  }
} 