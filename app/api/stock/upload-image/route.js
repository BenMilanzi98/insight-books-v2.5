// Add this route file at app/api/inventory/upload-image/route.js

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
    
    // Get multipart form data
    const formData = await request.formData();
    const productId = formData.get('productId');
    // Accept either a single key named 'file' or any key starting with 'file-'
    let file = formData.get('file');
    if (!file) {
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file') && value && typeof value.arrayBuffer === 'function') {
          file = value;
          break;
        }
      }
    }
    
    if (!file || !productId) {
      return NextResponse.json(
        { error: 'Missing required parameters: file or productId' },
        { status: 400 }
      );
    }
    
    // Verify product belongs to user's tenant
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });
    
    if (!product || product.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Product not found or access denied' },
        { status: 403 }
      );
    }
    
    // Create a buffer from the file
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    
    // Generate a unique filename
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    
    // Define public directory path for uploads
    // Note: In a real production environment, you'd use cloud storage
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    
    // Save the file
    await writeFile(filePath, buffer);
    
    // Generate the public URL for the file
    const imageUrl = `/uploads/${fileName}`;
    
    // Update the product with the new image URL
    await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        image: imageUrl,
      },
    });
    
    // Return success with the image URL
    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image. Please try again.' },
      { status: 500 }
    );
  }
}