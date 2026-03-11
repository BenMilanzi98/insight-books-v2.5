import { NextResponse } from 'next/server';
import eisService from '@/lib/eisService';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await eisService.syncInvoiceStatuses();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('EIS cron sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
