import { NextResponse } from 'next/server';
import { sweepAllTenantsPosCashDays } from '@/lib/posCashDayService';

/**
 * Auto-close OPEN POS cash days before UTC calendar date "today".
 * Schedule: daily shortly after midnight UTC (or adjust TZ in host cron).
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: 'Cron job not configured' }, { status: 500 });
    }
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    if (token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await sweepAllTenantsPosCashDays();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('cron/pos-cash-day', e);
    return NextResponse.json({ error: e?.message || 'Cron failed' }, { status: 500 });
  }
}
