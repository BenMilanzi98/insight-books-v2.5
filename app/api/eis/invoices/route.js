import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (startDate && endDate) {
      where.invoiceDate = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { mraInvoiceId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.eISInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.eISInvoice.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('GET /api/eis/invoices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
