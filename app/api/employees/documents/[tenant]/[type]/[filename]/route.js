import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Handle GET requests for employee documents
export async function GET(request, { params }) {
  try {
    const { tenant, type, filename } = params;

    if (!tenant || !type || !filename) {
      return NextResponse.json(
        { error: 'Missing required parameters: tenant, type, filename' },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent path traversal
    const sanitizedTenantId = tenant.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedType = type.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '');

    // Construct the file path
    const filePath = join(
      process.cwd(),
      'public',
      'uploads',
      sanitizedTenantId,
      'employees',
      'documents',
      sanitizedFilename
    );

    // Read and serve the file
    try {
      const fileBuffer = await readFile(filePath);
      
      // Determine content type based on extension
      let contentType = 'application/octet-stream';
      const ext = sanitizedFilename.toLowerCase().split('.').pop();
      if (ext === 'pdf') contentType = 'application/pdf';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${sanitizedFilename}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      throw readError;
    }
  } catch (error) {
    console.error('Error serving employee document:', error);
    return NextResponse.json(
      { error: 'Failed to serve document' },
      { status: 500 }
    );
  }
}
