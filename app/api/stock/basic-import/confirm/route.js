import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { confirmBasicStockImport } from '@/lib/stock/basicStockImportService.js';

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const perm = await requirePermission(request, 'inventory.create');
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Excel file is required.', code: 'MISSING_FILE' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const purpose = String(form.get('purpose') || 'STOCK_RECEIPT_IMPORT');
    const updateSellingPrice = !/^(0|false|no)$/i.test(String(form.get('updateSellingPrice') ?? 'true'));
    const forceAsNewReceipt = /^(1|true|yes)$/i.test(String(form.get('forceAsNewReceipt') || ''));

    const result = await confirmBasicStockImport({
      tenantId: user.tenantId,
      userId: user.id,
      buffer,
      fileName: file.name || null,
      purpose,
      updateSellingPrice,
      forceAsNewReceipt,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const status =
      error.code === 'DUPLICATE_STOCK_IMPORT' ||
      error.code === 'IMPORT_BLOCKED' ||
      error.code === 'NO_VALID_ROWS' ||
      error.code === 'MISSING_STOCK_IMPORT_COLUMN'
        ? 400
        : 500;
    return NextResponse.json(
      {
        error: error.message || 'Confirm failed',
        code: error.code || 'CONFIRM_FAILED',
        previousImport: error.previousImport,
        rows: error.rows,
      },
      { status }
    );
  }
}
