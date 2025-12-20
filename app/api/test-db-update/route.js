import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    console.log('🔍 Test DB Update API - Starting...');
    
    const tenantId = 'cmdsvm8cz0000h24egag6vd0z';
    const testLogoUrl = '/uploads/tenants/cmdsvm8cz0000h24egag6vd0z/test-logo.png';
    
    console.log(`📋 Test DB Update - Updating tenant ${tenantId} with test logo URL: ${testLogoUrl}`);
    
    // Check current state
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('📋 Test DB Update - Current state:', currentTenant);
    
    // Update the tenant record
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: testLogoUrl },
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('✅ Test DB Update - Database updated successfully!');
    console.log('📋 Test DB Update - Updated tenant:', updatedTenant);
    
    // Verify the update
    const verifyTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true }
    });
    
    console.log('🔍 Test DB Update - Verification - logo URL in database:', verifyTenant?.logoUrl);
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verifyTenant2 = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true }
    });
    
    console.log('🔍 Test DB Update - Verification after 1s - logo URL in database:', verifyTenant2?.logoUrl);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test database update completed',
      previousLogoUrl: currentTenant?.logoUrl || 'EMPTY',
      newLogoUrl: testLogoUrl,
      updatedTenant,
      verifiedLogoUrl: verifyTenant?.logoUrl,
      verifiedLogoUrlAfter1s: verifyTenant2?.logoUrl
    });
    
  } catch (error) {
    console.error('❌ Test DB Update API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to test database update',
      details: error.message 
    }, { status: 500 });
  }
} 