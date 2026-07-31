import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { previewBasicStockImport } from '@/lib/stock/basicStockImportService.js';

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
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

    const preview = await previewBasicStockImport({
      tenantId: user.tenantId,
      userId: user.id,
      buffer,
      fileName: file.name || null,
      purpose,
      updateSellingPrice,
      forceAsNewReceipt,
    });

    return NextResponse.json({ success: true, preview });
  } catch (error) {
    const status = error.code === 'MISSING_STOCK_IMPORT_COLUMN' || error.code === 'EMPTY_WORKBOOK' ? 400 : 500;
    return NextResponse.json(
      { error: error.message || 'Preview failed', code: error.code || 'PREVIEW_FAILED', missing: error.missing },
      { status }
    );
  }
}
