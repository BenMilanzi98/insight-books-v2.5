import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import { requirePermission } from '@/lib/auth';

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const perm = await requirePermission(request, 'system.view');
  if (perm) return perm;

  try {
    console.log('🔍 Test Logo Update API - Starting...');
    
    const tenantId = 'cmdsvm8cz0000h24egag6vd0z';
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
    
    // Check current state
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('📋 Test Logo Update - Current state:', currentTenant);
    
    // Simulate the exact process from account API
    const timestamp = Date.now();
    const testFileName = `test-logo-${timestamp}.png`;
    const testLogoUrl = `/uploads/tenants/${tenantId}/${testFileName}`;
    
    console.log(`📋 Test Logo Update - Setting logo URL to: ${testLogoUrl}`);
    
    // Create update data (simulating the account API logic)
    const updateData = {
      name: currentTenant.name,
      logoUrl: testLogoUrl
    };
    
    console.log('📋 Test Logo Update - Update data:', updateData);
    
    // Update the tenant record
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('✅ Test Logo Update - Database updated successfully!');
    console.log('📋 Test Logo Update - Updated tenant:', updatedTenant);
    
    // Verify the update
    const verifyTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true }
    });
    
    console.log('🔍 Test Logo Update - Verification - logo URL in database:', verifyTenant?.logoUrl);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test logo update completed',
      previousLogoUrl: currentTenant?.logoUrl || 'EMPTY',
      newLogoUrl: testLogoUrl,
      updatedTenant,
      verifiedLogoUrl: verifyTenant?.logoUrl
    });
    
  } catch (error) {
    console.error('❌ Test Logo Update API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to test logo update',
      details: error.message 
    }, { status: 500 });
  }
} 