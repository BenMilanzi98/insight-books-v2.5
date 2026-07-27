import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { reconcileInvoiceLine } from '@/lib/admin/platformBilling';

/**
 * GET /api/admin/platform-billing/reconciliation
 * Checks invoice line math via reconcileInvoiceLine for recent platform invoices.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.reconciliation) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);

    const invoices = await prisma.platformInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const results = invoices.map((inv) => {
      const check = reconcileInvoiceLine({
        subtotal: inv.subtotal,
        discount: inv.discount,
        tax: inv.tax,
        total: inv.total,
      });
      const outstandingExpected =
        Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100;
      const outstandingActual = Number(inv.outstanding);
      const outstandingOk = Math.abs(outstandingExpected - outstandingActual) < 0.01;

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        tenantId: inv.tenantId,
        status: inv.status,
        line: check,
        outstanding: {
          ok: outstandingOk,
          expected: outstandingExpected,
          actual: outstandingActual,
          variance: Math.round((outstandingActual - outstandingExpected) * 100) / 100,
        },
        ok: check.ok && outstandingOk,
      };
    });

    const mismatches = results.filter((r) => !r.ok);
    const checks = mismatches.map((r) => ({
      id: r.invoiceId,
      checkId: r.line?.ok === false ? 'INV_LINE_MATH' : 'INV_OUTSTANDING',
      invoiceId: r.invoiceId,
      tenantId: r.tenantId,
      expected: r.line?.ok === false ? r.line.expected : r.outstanding.expected,
      actual: r.line?.ok === false ? r.line.actual : r.outstanding.actual,
      variance: r.line?.ok === false ? r.line.variance : r.outstanding.variance,
      severity: 'high',
      remediation: 'Review platform invoice totals and payment allocations; do not edit silently.',
    }));

    return NextResponse.json({
      success: true,
      checked: results.length,
      mismatchCount: mismatches.length,
      mismatches,
      checks,
      summary: {
        passed: results.length - mismatches.length,
        failed: mismatches.length,
        checkedAt: new Date().toISOString(),
      },
      results,
    });
  } catch (error) {
    console.error('Platform billing reconciliation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reconcile platform invoices',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
