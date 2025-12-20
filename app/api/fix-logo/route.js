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
    
    console.log('Fix Logo API - Checking tenant:', tenantId);
    
    // Check current logo URL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true }
    });

    console.log('Fix Logo API - Current logo URL:', tenant?.logoUrl || 'EMPTY');

    // Check upload directory for logo files
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
    
    try {
      const files = await fs.readdir(uploadDir);
      const logoFiles = files.filter(file => 
        file.toLowerCase().includes('logo') || 
        file.toLowerCase().includes('app_icon') ||
        file.toLowerCase().includes('.png') ||
        file.toLowerCase().includes('.jpg') ||
        file.toLowerCase().includes('.jpeg')
      );
      
      console.log('Fix Logo API - Found logo files:', logoFiles);
      
      if (logoFiles.length > 0) {
        // Use the most recent logo file
        const latestLogo = logoFiles[logoFiles.length - 1];
        const logoUrl = `/uploads/tenants/${tenantId}/${latestLogo}`;
        
        console.log('Fix Logo API - Setting logo URL to:', logoUrl);
        
        // Update the database
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { logoUrl }
        });
        
        console.log('Fix Logo API - Logo URL updated successfully');
        
        return NextResponse.json({ 
          success: true, 
          message: 'Logo URL fixed successfully',
          logoUrl,
          previousLogoUrl: tenant?.logoUrl || 'EMPTY'
        });
        
      } else {
        return NextResponse.json({ 
          error: 'No logo files found in upload directory',
          uploadDir
        }, { status: 404 });
      }
      
    } catch (error) {
      console.error('Fix Logo API - Error reading upload directory:', error);
      return NextResponse.json({ 
        error: 'Error reading upload directory',
        details: error.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Fix Logo API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fix logo URL',
      details: error.message 
    }, { status: 500 });
  }
} 