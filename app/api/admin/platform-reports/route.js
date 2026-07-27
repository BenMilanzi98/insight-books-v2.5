import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { preventFormulaInjection } from '@/lib/admin/exportSafety';

const CSV_EXPORT_CAP = 5000;

function csvEscape(cell) {
  const safe = preventFormulaInjection(cell);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvResponse(filename, headers, rows) {
  const body = toCsv(headers, rows);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Row-Count': String(rows.length),
      'X-Export-Cap': String(CSV_EXPORT_CAP),
    },
  });
}

/**
 * GET /api/admin/platform-reports?type=tenants|subscriptions|affiliates[&format=csv]
 * Summary counts from real DB — permission-gated.
 * CSV exports use preventFormulaInjection and are capped.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || '').trim().toLowerCase();
    const format = (searchParams.get('format') || 'json').trim().toLowerCase();

    if (!['tenants', 'subscriptions', 'affiliates'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid type. Use tenants|subscriptions|affiliates',
        },
        { status: 400 }
      );
    }

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use json|csv' },
        { status: 400 }
      );
    }

    if (type === 'tenants') {
      const canView = adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view);
      const canExport = adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.export)
        || adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reportsExport);
      if (format === 'csv') {
        if (!canExport && !canView) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        if (!canExport) {
          return NextResponse.json(
            { success: false, error: 'Forbidden — export permission required' },
            { status: 403 }
          );
        }
        const tenants = await prisma.tenant.findMany({
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
            subscriptionPlan: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: CSV_EXPORT_CAP,
        });
        const headers = [
          'id',
          'name',
          'subdomain',
          'status',
          'subscriptionPlan',
          'createdAt',
          'updatedAt',
        ];
        const rows = tenants.map((t) => ({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          subscriptionPlan: t.subscriptionPlan,
          createdAt: t.createdAt?.toISOString?.() || t.createdAt,
          updatedAt: t.updatedAt?.toISOString?.() || t.updatedAt,
        }));
        return csvResponse(
          `platform-tenants-${new Date().toISOString().slice(0, 10)}.csv`,
          headers,
          rows
        );
      }

      if (!canView) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      const [total, byStatus] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.groupBy({ by: ['status'], _count: { id: true } }),
      ]);
      return NextResponse.json({
        success: true,
        type,
        generatedAt: new Date().toISOString(),
        summary: {
          total,
          byStatus: byStatus.reduce((acc, row) => {
            acc[row.status] = row._count.id;
            return acc;
          }, {}),
        },
      });
    }

    if (type === 'subscriptions') {
      const canView = adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view);
      const canExport = adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reportsExport);
      if (format === 'csv') {
        if (!canExport) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        const accountSubs = await prisma.accountSubscription.findMany({
          select: {
            id: true,
            tenantId: true,
            plan: true,
            status: true,
            isActive: true,
            amount: true,
            currency: true,
            startedAt: true,
            expiresAt: true,
            createdAt: true,
            tenant: { select: { name: true, subdomain: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: CSV_EXPORT_CAP,
        });
        const headers = [
          'id',
          'tenantId',
          'tenantName',
          'subdomain',
          'plan',
          'status',
          'isActive',
          'amount',
          'currency',
          'startedAt',
          'expiresAt',
          'createdAt',
        ];
        const rows = accountSubs.map((s) => ({
          id: s.id,
          tenantId: s.tenantId,
          tenantName: s.tenant?.name || '',
          subdomain: s.tenant?.subdomain || '',
          plan: s.plan,
          status: s.status,
          isActive: s.isActive,
          amount: s.amount,
          currency: s.currency,
          startedAt: s.startedAt?.toISOString?.() || '',
          expiresAt: s.expiresAt?.toISOString?.() || '',
          createdAt: s.createdAt?.toISOString?.() || s.createdAt,
        }));
        return csvResponse(
          `platform-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
          headers,
          rows
        );
      }

      if (!canView) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      const [accountTotal, accountActive, branchTotal, branchActive] = await Promise.all([
        prisma.accountSubscription.count(),
        prisma.accountSubscription.count({ where: { isActive: true } }),
        prisma.branchSubscription.count(),
        prisma.branchSubscription.count({ where: { isActive: true } }),
      ]);
      return NextResponse.json({
        success: true,
        type,
        generatedAt: new Date().toISOString(),
        summary: {
          accountSubscriptions: { total: accountTotal, active: accountActive },
          branchSubscriptions: { total: branchTotal, active: branchActive },
        },
      });
    }

    // affiliates
    const canViewAff = adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.view);
    const canExportAff =
      adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.export) ||
      adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reportsExport);

    if (format === 'csv') {
      if (!canExportAff) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      const affiliates = await prisma.affiliate.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          businessName: true,
          status: true,
          referralCode: true,
          commissionRate: true,
          totalCommissions: true,
          totalReferrals: true,
          totalSales: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: CSV_EXPORT_CAP,
      });
      const headers = [
        'id',
        'name',
        'email',
        'businessName',
        'status',
        'referralCode',
        'commissionRate',
        'totalCommissions',
        'totalReferrals',
        'totalSales',
        'createdAt',
      ];
      const rows = affiliates.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        businessName: a.businessName || '',
        status: a.status,
        referralCode: a.referralCode,
        commissionRate: a.commissionRate,
        totalCommissions: a.totalCommissions,
        totalReferrals: a.totalReferrals,
        totalSales: a.totalSales,
        createdAt: a.createdAt?.toISOString?.() || a.createdAt,
      }));
      return csvResponse(
        `platform-affiliates-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      );
    }

    if (!canViewAff) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const [total, byStatus, referralCount, payoutCount] = await Promise.all([
      prisma.affiliate.count(),
      prisma.affiliate.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.affiliateReferral.count(),
      prisma.affiliatePayout.count(),
    ]);
    return NextResponse.json({
      success: true,
      type,
      generatedAt: new Date().toISOString(),
      summary: {
        total,
        byStatus: byStatus.reduce((acc, row) => {
          acc[row.status] = row._count.id;
          return acc;
        }, {}),
        referrals: referralCount,
        payouts: payoutCount,
      },
    });
  } catch (error) {
    console.error('platform-reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report summary' },
      { status: 500 }
    );
  }
}
