import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // CSV headers
    const headers = [
      'Client Name',
      'Email',
      'Phone',
      'Address',
      'Contact Person'
    ];

    // Sample data with various examples
    const sampleData = [
      [
        'Acme Corporation',
        'contact@acme.com',
        '+1-555-0123',
        '123 Business St, Suite 100, New York, NY 10001',
        'John Smith'
      ],
      [
        'Tech Solutions Ltd',
        'info@techsolutions.com',
        '+1-555-0456',
        '456 Innovation Ave, San Francisco, CA 94105',
        'Sarah Johnson'
      ],
      [
        'Global Enterprises',
        'admin@globalent.com',
        '+1-555-0789',
        '789 Corporate Blvd, Chicago, IL 60601',
        'Michael Brown'
      ],
      [
        'Local Services Inc',
        'hello@localservices.com',
        '+1-555-0321',
        '321 Main Street, Austin, TX 73301',
        'Emily Davis'
      ],
      [
        'Startup Innovations',
        'team@startupinnovations.com',
        '+1-555-0654',
        '654 Venture Way, Boston, MA 02101',
        'David Wilson'
      ]
    ];

    // Build CSV content
    const csvRows = [headers, ...sampleData];
    const csvContent = csvRows
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="client_bulk_upload_template.csv"'
      }
    });

  } catch (error) {
    console.error('Error generating client template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
