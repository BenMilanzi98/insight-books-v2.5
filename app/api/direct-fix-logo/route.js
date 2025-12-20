import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    console.log('🔧 Direct Fix Logo API - Starting...');
    
    const tenantId = 'cmdsvm8cz0000h24egag6vd0z';
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
    
    // Find the latest uploaded file
    const files = await fs.readdir(uploadDir);
    const imageFiles = files.filter(file => 
      file.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    
    if (imageFiles.length === 0) {
      return NextResponse.json({ 
        error: 'No image files found in upload directory',
        uploadDir,
        files 
      }, { status: 404 });
    }
    
    // Sort by modification time to get the latest
    const fileStats = await Promise.all(
      imageFiles.map(async (file) => {
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      })
    );
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    const latestFile = fileStats[0].file;
    const logoUrl = `/uploads/tenants/${tenantId}/${latestFile}`;
    
    console.log(`📋 Direct Fix - Found latest file: ${latestFile}`);
    console.log(`📋 Direct Fix - Setting logo URL to: ${logoUrl}`);
    
    // Check current state
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('📋 Direct Fix - Current state:', currentTenant);
    
    // Update the tenant record
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
      select: { id: true, name: true, logoUrl: true }
    });
    
    console.log('✅ Direct Fix - Database updated successfully!');
    console.log('📋 Direct Fix - Updated tenant:', updatedTenant);
    
    // Verify the update
    const verifyTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true }
    });
    
    console.log('🔍 Direct Fix - Verification - logo URL in database:', verifyTenant?.logoUrl);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Logo URL directly fixed in database',
      previousLogoUrl: currentTenant?.logoUrl || 'EMPTY',
      newLogoUrl: logoUrl,
      latestFile,
      updatedTenant,
      verifiedLogoUrl: verifyTenant?.logoUrl,
      allFiles: imageFiles
    });
    
  } catch (error) {
    console.error('❌ Direct Fix Logo API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to directly fix logo URL',
      details: error.message 
    }, { status: 500 });
  }
} 