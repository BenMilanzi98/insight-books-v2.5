import { NextResponse } from 'next/server';
import { evaluateGoLiveGates } from '@/lib/productionCutover/gates.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST body: evidence flags (boolean). Does not grant go-live — evaluation only.
 * Requires CUTOVER_OPS_TOKEN header when CUTOVER_OPS_TOKEN env is set.
 */
export async function POST(request) {
  const expected = process.env.CUTOVER_OPS_TOKEN || '';
  const token = request.headers.get('x-cutover-ops-token') || '';
  if (expected && token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = evaluateGoLiveGates(body.evidence || body);
  return NextResponse.json(
    {
      ...result,
      disclaimer: 'Automated gate check only — human Go-Live Decision record required.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
