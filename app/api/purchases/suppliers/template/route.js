import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const headers = ['Supplier Name', 'Email', 'Phone', 'Address', 'Contact Person'];
    const sampleData = [
      ['Lakeside Wholesale', 'orders@lakeside.example', '+265-111-0001', 'Area 3, Lilongwe', 'Amina Banda'],
      ['Central Hardware', 'sales@centralhw.example', '+265-111-0002', 'Blantyre CBD', 'James Phiri'],
    ];

    const csvContent = [headers, ...sampleData]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="supplier_bulk_upload_template.csv"',
      },
    });
  } catch (error) {
    console.error('Error generating supplier template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
