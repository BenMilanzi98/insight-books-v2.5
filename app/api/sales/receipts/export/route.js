import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateBulkSaleReceiptsPdfBuffer } from '@/lib/server-pdf-jspdf';
import {
  MAX_RECEIPTS_PER_EXPORT,
  resolveReceiptDateRange,
  countSalesForReceiptExport,
  iterateSalesForReceiptExport,
  normalizeSaleForReceiptPdf,
  buildSaleTaxData,
  formatDateForFilename,
} from '@/lib/saleReceiptExport';

export const maxDuration = 300;

/**
 * GET /api/sales/receipts/export
 * Bulk POS receipts PDF (or countOnly preview).
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const perm = await requireAnyPermission(request, [
      'sales.export',
      'sales.view',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset') || 'custom';
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    const branchId = searchParams.get('branchId');
    const countOnly =
      searchParams.get('countOnly') === '1' ||
      searchParams.get('countOnly') === 'true';

    let range;
    try {
      range = resolveReceiptDateRange({
        preset,
        dateFrom: dateFromParam,
        dateTo: dateToParam,
      });
    } catch (rangeErr) {
      return NextResponse.json(
        { error: rangeErr.message || 'Invalid date range' },
        { status: 400 }
      );
    }

    const filters = {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      branchId: branchId || null,
    };

    const count = await countSalesForReceiptExport(prisma, user.tenantId, filters);

    if (countOnly) {
      return NextResponse.json({
        count,
        dateFrom: range.dateFrom.toISOString(),
        dateTo: range.dateTo.toISOString(),
        preset: range.preset,
        max: MAX_RECEIPTS_PER_EXPORT,
      });
    }

    if (count === 0) {
      return NextResponse.json(
        { error: 'No receipts found for the selected date range.' },
        { status: 400 }
      );
    }

    if (count > MAX_RECEIPTS_PER_EXPORT) {
      return NextResponse.json(
        {
          error: `Too many receipts (${count}). Maximum is ${MAX_RECEIPTS_PER_EXPORT} per export. Narrow the date range and try again.`,
          count,
          max: MAX_RECEIPTS_PER_EXPORT,
        },
        { status: 400 }
      );
    }

    let tenantSettings = null;
    try {
      tenantSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
      });
    } catch (e) {
      console.warn('[receipts export] tenant settings:', e?.message);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const receipts = [];
    let processed = 0;
    for await (const raw of iterateSalesForReceiptExport(
      prisma,
      user.tenantId,
      filters
    )) {
      const sale = normalizeSaleForReceiptPdf(raw);
      const taxData = buildSaleTaxData(sale.items, sale.totalTaxAmount);
      receipts.push({ sale, taxData });
      processed += 1;
      if (processed % 100 === 0) {
        console.log(
          `[receipts export] tenant=${user.tenantId} processed ${processed}/${count}`
        );
      }
    }

    const pdfBuffer = generateBulkSaleReceiptsPdfBuffer(receipts, tenantSettings, {
      tenantName: tenant?.name || 'POS Receipts',
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      count: receipts.length,
    });

    const fromSlug = formatDateForFilename(range.dateFrom);
    const toSlug = formatDateForFilename(range.dateTo);
    const filename = `pos-receipts-${fromSlug}-to-${toSlug}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[receipts export]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to export receipts PDF' },
      { status: 500 }
    );
  }
}
