// app/api/reports/accounts-payable-aging/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateAPAgingFromTransactions } from '@/lib/apAgingService';

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
    
    // Generate AP Aging using Phase 2 enhanced service
    const apAging = await generateAPAgingFromTransactions(user.tenantId, asOfDate);
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      ...apAging
    });
  } catch (error) {
    console.error('Error generating accounts payable aging report:', error);
    return NextResponse.json(
      { error: 'Failed to generate accounts payable aging report', details: error.message },
      { status: 500 }
    );
  }
}