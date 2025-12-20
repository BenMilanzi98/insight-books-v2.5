import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Test upload - File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Create test upload directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", "test");
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const timestamp = Date.now();
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext);
    const uniqueName = `${baseName}-${timestamp}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/test/${uniqueName}`;

    console.log('Test upload - File saved:', fileUrl);

    return NextResponse.json({ 
      success: true, 
      fileUrl,
      message: 'Test upload successful' 
    });

  } catch (error) {
    console.error('Test upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error.message 
    }, { status: 500 });
  }
} 