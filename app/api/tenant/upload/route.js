// app/api/tenant/upload/route.js
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type'); // 'logo' or 'favicon'
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    if (!type || (type !== 'logo' && type !== 'favicon')) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be logo or favicon.' },
        { status: 400 }
      );
    }
    
    // Validate file
    const validTypes = type === 'logo' 
      ? ['image/jpeg', 'image/png', 'image/svg+xml'] 
      : ['image/x-icon', 'image/png'];
      
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file format for ${type}` },
        { status: 400 }
      );
    }
    
    // Create a unique filename
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileName = `${type}-${user.tenantId}-${Date.now()}.${fileExtension}`;
    
    // Set up directory for tenant uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads', user.tenantId, 'branding');
    
    // Create directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true });
    
    // Save the file
    const filePath = join(uploadDir, fileName);
    const fileArrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(fileArrayBuffer));
    
    // File URL for the frontend
    const fileUrl = `/uploads/${user.tenantId}/branding/${fileName}`;
    
    // Update the tenant with the new file URL
    const updateData = type === 'logo' 
      ? { logoUrl: fileUrl }
      : { faviconUrl: fileUrl };
      
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: updateData
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: type === 'logo' ? 'LOGO_UPLOADED' : 'FAVICON_UPLOADED',
        entityType: 'TENANT',
        entityId: user.tenantId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl
        })
      }
    });
    
    return NextResponse.json({
      message: `${type} uploaded successfully`,
      url: fileUrl
    });
  } catch (error) {
    console.error(`Error uploading ${type}:`, error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}