// app/api/historical-transactions/template/route.js
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

    // Create CSV template content
    const csvContent = [
      // Header row with descriptions
      'Transaction Date,Customer Name,Customer Email,Product/Service Description,Quantity,Unit Price,Tax Rate (%),Discount Amount,Payment Method,Original Reference,Notes',
      // Example rows
      '2023-01-15,John Doe,john@example.com,Consulting Services,1,500.00,15,0,cash,INV-2023-001,Historical transaction from old system',
      '2023-01-16,Jane Smith,jane@example.com,Product A,2,25.50,15,5.00,card,REC-2023-002,Migrated from legacy POS',
      '2023-01-17,,,"Custom Product - Widget",3,15.00,0,0,mobile_money,CASH-001,Walk-in customer purchase'
    ].join('\n');

    // Set headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', 'attachment; filename="historical_transactions_template.csv"');

    return new Response(csvContent, { headers });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
