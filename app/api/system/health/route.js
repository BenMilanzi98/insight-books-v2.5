import { NextResponse } from 'next/server';
import { deepDiagnostics, readiness } from '@/lib/performanceReliability/health.js';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/system/health
 * ?deep=1 requires PERF_HEALTH_TOKEN header match (ops only).
 */
export async function GET(request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === '1';
  const token = request.headers.get('x-perf-health-token') || '';
  const expected = process.env.PERF_HEALTH_TOKEN || '';

  if (deep) {
    if (!expected || token !== expected) {
      return NextResponse.json({ error: 'Unauthorized deep health' }, { status: 401 });
    }
    const body = await deepDiagnostics({ prisma });
    return NextResponse.json(body, {
      status: body.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const body = await readiness({ prisma });
  return NextResponse.json(
    {
      status: body.status,
      checks: {
        live: 'ok',
        ready: body.status,
        database: body.database,
      },
      timestamp: body.timestamp,
    },
    {
      status: body.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
