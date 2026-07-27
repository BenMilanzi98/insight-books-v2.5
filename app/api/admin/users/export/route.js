import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';
import { preventFormulaInjection } from '@/lib/admin/exportSafety';
import { appendAdminAuditLog } from '@/lib/admin/appendOnlyAudit';

const EXPORT_CAP = 5000;

const USERS_EXPORT_PERMISSION = SYSTEM_ADMIN_PERMISSIONS.users.export;

function escapeCsvCell(value) {
  const safe = preventFormulaInjection(value);
  return `"${String(safe).replace(/"/g, '""')}"`;
}

function generateCSV(users) {
  const headers = [
    'ID',
    'Name',
    'Email',
    'Role',
    'Tenant',
    'Status',
    'Active',
    'Last Login',
    'Created At',
    'Phone',
    'Department',
  ];
  const rows = users.map((user) => [
    user.id,
    user.name ?? '',
    user.email ?? '',
    user.roleName ?? '',
    user.tenantName ?? '',
    user.status ?? '',
    user.isActive ? 'true' : 'false',
    user.lastLogin ? user.lastLogin.toISOString() : '',
    user.createdAt ? user.createdAt.toISOString() : '',
    user.phone ?? '',
    user.department ?? '',
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, USERS_EXPORT_PERMISSION)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { format = 'csv', filters = {}, selectedUsers } = body;

    const validFormats = ['csv', 'json'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Only csv and json export formats are supported' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status =
      filters.status || searchParams.get('status') || 'all';
    const role = filters.role || searchParams.get('role') || 'all';
    const tenant = filters.tenant || searchParams.get('tenant') || 'all';
    const dateRange =
      filters.dateRange || searchParams.get('dateRange') || 'all';

    const where = {};

    if (status !== 'all') {
      where.status = status;
    }
    if (tenant !== 'all') {
      where.tenantId = tenant;
    }
    if (role !== 'all') {
      where.role = { name: role };
    }
    if (dateRange !== 'all') {
      const now = Date.now();
      let startDate;
      switch (dateRange) {
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null;
      }
      if (startDate) {
        where.createdAt = { gte: startDate };
      }
    }
    if (selectedUsers && Array.isArray(selectedUsers) && selectedUsers.length > 0) {
      where.id = { in: selectedUsers.slice(0, EXPORT_CAP) };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        phone: true,
        department: true,
        role: { select: { name: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: EXPORT_CAP,
    });

    const mapped = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleName: u.role?.name || '',
      tenantName: u.tenant?.name || '',
      status: u.status,
      isActive: u.isActive,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
      phone: u.phone,
      department: u.department,
    }));

    await appendAdminAuditLog({
      adminId: admin.id,
      action: 'USER_EXPORT',
      entityType: 'USER',
      entityId: 'BULK_EXPORT',
      details: `Exported ${mapped.length} users in ${format.toUpperCase()} format (cap ${EXPORT_CAP})`,
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const safeJson = mapped.map((u) => ({
        id: preventFormulaInjection(u.id),
        name: preventFormulaInjection(u.name),
        email: preventFormulaInjection(u.email),
        role: preventFormulaInjection(u.roleName),
        tenant: preventFormulaInjection(u.tenantName),
        status: preventFormulaInjection(u.status),
        isActive: u.isActive,
        lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
        createdAt: u.createdAt ? u.createdAt.toISOString() : null,
        phone: preventFormulaInjection(u.phone),
        department: preventFormulaInjection(u.department),
      }));
      const bodyJson = JSON.stringify(safeJson, null, 2);
      return new NextResponse(bodyJson, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="users-export-${dateStamp}.json"`,
        },
      });
    }

    const csv = generateCSV(mapped);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users-export-${dateStamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Admin user export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export users' },
      { status: 500 }
    );
  }
}
