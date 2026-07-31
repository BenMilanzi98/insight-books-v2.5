import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { parseCsv, buildImportPreview } from '@/lib/historicalSalesImport/index.js';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['sales.create', 'sales.view', 'invoices.create']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = String(file.name || '').toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Excel is not supported. Please use the CSV template.' },
        { status: 400 }
      );
    }
    if (!fileName.endsWith('.csv')) {
      return NextResponse.json({ error: 'Please upload a .csv file.' }, { status: 400 });
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

    if (!rows.length) {
      return NextResponse.json({ error: 'No data rows found in the file' }, { status: 400 });
    }

    const preview = buildImportPreview(rows);
    // Do not send full valid row Date objects over the wire — send serializable preview
    return NextResponse.json({
      preview: {
        ...preview,
        validRows: preview.validRows.map((r) => ({
          rowNumber: r.rowNumber,
          date: r.dateOnly,
          reference: r.reference,
          customer: r.customer,
          description: r.description,
          qty: r.qty,
          unitPrice: r.unitPrice,
          taxPercent: r.taxPercent,
          total: r.total,
          paymentMethod: r.paymentMethod,
          notes: r.notes,
        })),
      },
    });
  } catch (error) {
    console.error('historical import preview:', error);
    return NextResponse.json(
      { error: 'Failed to preview import', details: error.message },
      { status: 500 }
    );
  }
}
