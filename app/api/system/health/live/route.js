import { NextResponse } from 'next/server';
import { liveness } from '@/lib/performanceReliability/health.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Liveness — process alive; no DB. */
export async function GET() {
  return NextResponse.json(liveness(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
