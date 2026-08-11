import { NextResponse } from 'next/server';
import { sweepAllTenantsPosCashDays } from '@/lib/posCashDayService';

/**
 * Auto-close OPEN POS cash days before Africa/Blantyre "today".
 * Host cron example (00:05 Blantyre ≈ 22:05 UTC):
 *   curl -X POST "$APP_URL/api/cron/pos-cash-day" -H "Authorization: Bearer $CRON_SECRET"
 * vercel.json schedules GET at 22:05 UTC with ?secret= when configured.
 */
function authorize(request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return { ok: false, response: NextResponse.json({ error: 'Cron job not configured' }, { status: 500 }) };
  }
  const authHeader = request.headers.get('authorization');
  const bearerOk =
    authHeader &&
    authHeader.startsWith('Bearer ') &&
    authHeader.slice(7).trim() === expectedSecret;
  const url = new URL(request.url);
  const queryOk = url.searchParams.get('secret') === expectedSecret;
  if (!bearerOk && !queryOk) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true };
}

async function run(request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  const result = await sweepAllTenantsPosCashDays();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request) {
  try {
    return await run(request);
  } catch (e) {
    console.error('cron/pos-cash-day', e);
    return NextResponse.json({ error: e?.message || 'Cron failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    return await run(request);
  } catch (e) {
    console.error('cron/pos-cash-day', e);
    return NextResponse.json({ error: e?.message || 'Cron failed' }, { status: 500 });
  }
}
