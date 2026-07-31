import { NextResponse } from 'next/server';
import { getCutoverMode, CUTOVER_MODES } from '@/lib/productionCutover/modes.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public cutover status — no secrets. */
export async function GET() {
  const mode = getCutoverMode();
  return NextResponse.json(
    {
      mode,
      active: mode !== CUTOVER_MODES.OFF,
      message:
        mode === CUTOVER_MODES.OFF
          ? null
          : process.env.CUTOVER_MESSAGE || 'Cutover controls are active.',
      writesBlocked:
        mode === CUTOVER_MODES.MAINTENANCE ||
        mode === CUTOVER_MODES.READONLY ||
        mode === CUTOVER_MODES.WRITE_FREEZE,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
