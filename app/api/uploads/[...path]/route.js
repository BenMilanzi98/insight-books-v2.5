import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(request, { params }) {
  try {
    // Get the file path from the URL params
    // params.path will be an array like ['tenants', 'tenantId', 'filename.png']
    const filePathArray = params.path || [];
    const relativePath = filePathArray.join('/');
    
    // Construct the full file path
    const fullPath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    
    // Security: prevent directory traversal attacks
    const normalizedPath = path.normalize(fullPath);
    const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    if (!normalizedPath.startsWith(publicUploadsDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    // When file is missing, return 200 with a 1x1 transparent PNG so img doesn't 404 and client can show fallback
    if (!existsSync(normalizedPath)) {
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      return new NextResponse(transparentPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
          'Content-Length': transparentPng.length.toString(),
        },
      });
    }
    
    // Read the file
    const fileBuffer = await readFile(normalizedPath);
    
    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving upload file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

