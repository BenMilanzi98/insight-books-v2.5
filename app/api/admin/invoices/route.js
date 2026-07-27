import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * GET /api/admin/invoices
 * DEPRECATED for tenant AR — returns PlatformInvoice (SaaS) records only.
 * Tenant customer invoices must be accessed from the tenant workspace.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);

    const invoices = await prisma.platformInvoice.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status && status !== 'all' ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const tenantIds = [...new Set(invoices.map((i) => i.tenantId))];
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t.name]));

    return NextResponse.json({
      success: true,
      deprecated: true,
      source: 'platform_billing',
      message:
        'This endpoint returns InsightBooks platform SaaS invoices only. Prefer /api/admin/platform-billing/invoices. Tenant AR invoices are not exposed here.',
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.invoiceNumber,
        tenantName: tenantMap[invoice.tenantId] || 'Unknown',
        tenantId: invoice.tenantId,
        amount: Number(invoice.total),
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.tax),
        discount: Number(invoice.discount),
        outstanding: Number(invoice.outstanding),
        status: invoice.status,
        currency: invoice.currency,
        issueDate: invoice.createdAt?.toISOString?.()?.split('T')[0],
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        createdAt: invoice.createdAt,
      })),
    });
  } catch (error) {
    console.error('admin invoices (platform) error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform invoices' },
      { status: 500 }
    );
  }
}
