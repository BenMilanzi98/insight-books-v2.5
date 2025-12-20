import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    console.log('🔍 Test Logo API - Checking database...');
    
    const tenantId = 'cmdsvm8cz0000h24egag6vd0z';
    
    // Check tenant table
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true, faviconUrl: true }
    });
    
    console.log('🔍 Test Logo API - Tenant data:', tenant);
    
    // Check tenant settings table
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { id: true, tenantId: true }
    });
    
    console.log('🔍 Test Logo API - Tenant Settings data:', tenantSettings);
    
    return NextResponse.json({
      success: true,
      tenant,
      tenantSettings,
      message: 'Database check completed'
    });
    
  } catch (error) {
    console.error('❌ Test Logo API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check database',
      details: error.message 
    }, { status: 500 });
  }
} 