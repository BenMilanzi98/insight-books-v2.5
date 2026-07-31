import { NextResponse } from 'next/server';
import { readiness } from '@/lib/performanceReliability/health.js';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Readiness — DB ping + pool budget check. */
export async function GET() {
  const body = await readiness({ prisma });
  const status = body.status === 'ok' ? 200 : 503;
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
