import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parseCsv,
  buildImportPreview,
  commitHistoricalImportRows,
  parseImportDate,
} from '@/lib/historicalSalesImport/index.js';

/**
 * POST /api/historical-transactions/batch-upload
 * Confirm import after preview. Creates historical sales + accounting; no stock changes.
 */
export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['sales.create', 'invoices.create']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const migrationBatch =
      String(formData.get('migrationBatch') || '').trim() ||
      `HIST-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = String(file.name || '').toLowerCase();
    if (!fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Please upload a .csv file from the template.' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    let rows;
    try {
      rows = parseCsv(fileContent);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid CSV format', details: parseError.message },
        { status: 400 }
      );
    }

    const preview = buildImportPreview(rows);
    if (preview.validCount === 0) {
      return NextResponse.json(
        {
          error: 'No valid rows to import',
          preview: {
            totalRows: preview.totalRows,
            validCount: 0,
            invalidCount: preview.invalidCount,
            invalidRows: preview.invalidRows,
            dateFrom: null,
            dateTo: null,
          },
        },
        { status: 400 }
      );
    }

    // Rehydrate Date objects for commit
    const commitRows = preview.validRows.map((r) => ({
      ...r,
      date: parseImportDate(r.dateOnly) || r.date,
    }));

    const timeout = Math.max(120000, commitRows.length * 400);
    const result = await prisma.$transaction(
      async (tx) =>
        commitHistoricalImportRows(tx, {
          tenantId: user.tenantId,
          userId: user.id,
          migrationBatch,
          rows: commitRows,
        }),
      { maxWait: 60000, timeout }
    );

    return NextResponse.json({
      message: `Imported ${result.successful.length} historical sale(s). Stock was not changed.`,
      results: {
        totalRows: preview.totalRows,
        successful: result.successful.length,
        failed: result.failed.length + preview.invalidCount,
        skipped: preview.invalidCount,
        migrationBatch,
        dateFrom: preview.dateFrom,
        dateTo: preview.dateTo,
        stockImpact: 'NONE',
        successfulTransactions: result.successful,
        failedTransactions: [
          ...preview.invalidRows.map((r) => ({
            rowNumber: r.rowNumber,
            error: (r.errors || []).join('; '),
            type: 'validation',
          })),
          ...result.failed.map((f) => ({ ...f, type: 'processing' })),
        ],
      },
    });
  } catch (error) {
    console.error('historical import commit:', error);
    return NextResponse.json(
      {
        error: 'Failed to import historical sales',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
