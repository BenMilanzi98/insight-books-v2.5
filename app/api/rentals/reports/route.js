import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { buildRentalHiringReport } from '@/lib/rentalReportsService';

const VALID_TYPES = new Set(['all', 'space', 'customer_hire', 'supplier_hire']);

function parseDate(value, fallback, endOfDay = false) {
  if (!value) return fallback;
  const date = new Date(`${value}${value.length === 10 ? 'T00:00:00' : ''}`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && value.length === 10) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 30);
    const from = parseDate(searchParams.get('from'), defaultFrom);
    const to = parseDate(searchParams.get('to'), today, true);

    if (!from || !to || from > to || !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid from, to, or type parameter' }, { status: 400 });
    }

    const report = await buildRentalHiringReport({
      prisma,
      tenantId: user.tenantId,
      from,
      to,
      type,
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error('[rental reports]', error);
    return NextResponse.json({ error: error.message || 'Failed to build report' }, { status: 500 });
  }
}
