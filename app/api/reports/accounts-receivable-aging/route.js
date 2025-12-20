// app/api/reports/accounts-receivable-aging/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateARAgingFromTransactions } from '@/lib/arAgingService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get('asOfDate');
    const asOfDate = asOfDateParam || new Date().toISOString().split('T')[0];
    
    // Get tenant name
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true }
    });
    
    // Generate AR Aging using Phase 2 enhanced service
    const arAging = await generateARAgingFromTransactions(user.tenantId, asOfDate);
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      ...arAging
    });
  } catch (error) {
    console.error('Error generating accounts receivable aging report:', error);
    return NextResponse.json(
      { error: 'Failed to generate accounts receivable aging report', details: error.message },
      { status: 500 }
    );
  }
}