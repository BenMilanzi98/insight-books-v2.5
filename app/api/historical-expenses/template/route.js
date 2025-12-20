// app/api/historical-expenses/template/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // CSV headers for historical expenses
    const headers = [
      'Expense Date',
      'Description',
      'Amount',
      'Category',
      'Merchant',
      'Payment Method',
      'Original Reference',
      'Notes'
    ];

    // Sample data to help users understand the format
    const sampleData = [
      [
        '2024-01-15',
        'Office supplies purchase',
        '150.00',
        'Office Supplies',
        'Staples',
        'Cash',
        'INV-2024-001',
        'Pens, paper, and folders for Q1'
      ],
      [
        '01/20/2024',
        'Business lunch meeting',
        '85.50',
        'Meals & Entertainment',
        'Restaurant ABC',
        'Credit Card',
        'RECEIPT-456',
        'Client meeting with John Smith'
      ],
      [
        '01.02.2024',
        'Software subscription',
        '299.99',
        'Software Subscription',
        'Adobe',
        'Bank Transfer',
        'SUB-789',
        'Annual Creative Suite license'
      ],
      [
        '15-03-2024',
        'Equipment maintenance',
        '75.25',
        'Maintenance & Repairs',
        'Tech Solutions',
        'Check',
        'CHK-001',
        'Monthly equipment servicing'
      ]
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      )
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="historical-expenses-template.csv"',
      },
    });

  } catch (error) {
    console.error('Error generating historical expenses template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
