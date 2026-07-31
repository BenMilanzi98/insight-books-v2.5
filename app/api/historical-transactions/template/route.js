import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { buildTemplateCsv } from '@/lib/historicalSalesImport/index.js';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const csvContent = buildTemplateCsv();
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set(
      'Content-Disposition',
      'attachment; filename="historical_sales_import_template.csv"'
    );
    return new Response(csvContent, { headers });
  } catch (error) {
    console.error('Error generating historical import template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
