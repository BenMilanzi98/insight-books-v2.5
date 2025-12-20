import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const userItem = await getUserFromSession(request);
    if (!userItem) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = userItem.tenantId;
    
    console.log('Force Fix Logo API - Tenant ID:', tenantId);
    
    // First, check current database state
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        name: true, 
        logoUrl: true 
      }
    });

    console.log('Force Fix Logo API - Current database state:', {
      name: currentTenant?.name,
      currentLogoUrl: currentTenant?.logoUrl || 'EMPTY'
    });

    // Check upload directory for the latest logo file
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
    
    try {
      const files = await fs.readdir(uploadDir);
      console.log('Force Fix Logo API - All files in directory:', files);
      
      // Find the most recent logo file
      const logoFiles = files.filter(file => 
        file.toLowerCase().includes('app_icon') ||
        file.toLowerCase().includes('logo') ||
        file.toLowerCase().includes('.png') ||
        file.toLowerCase().includes('.jpg') ||
        file.toLowerCase().includes('.jpeg')
      );
      
      console.log('Force Fix Logo API - Logo files found:', logoFiles);
      
      if (logoFiles.length > 0) {
        // Get the most recent file (last in the array)
        const latestLogo = logoFiles[logoFiles.length - 1];
        const logoUrl = `/uploads/tenants/${tenantId}/${latestLogo}`;
        
        console.log('Force Fix Logo API - Setting logo URL to:', logoUrl);
        
        // Force update the database directly
        const updatedTenant = await prisma.tenant.update({
          where: { id: tenantId },
          data: { logoUrl },
          select: { logoUrl: true }
        });
        
        console.log('Force Fix Logo API - Database updated successfully');
        console.log('Force Fix Logo API - New logo URL in database:', updatedTenant.logoUrl);
        
        // Verify the update by fetching again
        const verifyTenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { logoUrl: true }
        });
        
        console.log('Force Fix Logo API - Verification - logo URL in database:', verifyTenant?.logoUrl);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Logo URL force fixed in database',
          previousLogoUrl: currentTenant?.logoUrl || 'EMPTY',
          newLogoUrl: logoUrl,
          databaseLogoUrl: updatedTenant.logoUrl,
          verifiedLogoUrl: verifyTenant?.logoUrl,
          filesFound: logoFiles
        });
        
      } else {
        return NextResponse.json({ 
          error: 'No logo files found in upload directory',
          uploadDir,
          allFiles: files
        }, { status: 404 });
      }
      
    } catch (error) {
      console.error('Force Fix Logo API - Error reading upload directory:', error);
      return NextResponse.json({ 
        error: 'Error reading upload directory',
        details: error.message,
        uploadDir
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Force Fix Logo API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to force fix logo URL',
      details: error.message 
    }, { status: 500 });
  }
} 