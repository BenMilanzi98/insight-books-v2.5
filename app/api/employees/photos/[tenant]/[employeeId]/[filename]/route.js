import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Handle GET requests for employee photos
export async function GET(request, { params }) {
  try {
    const { tenant, employeeId, filename } = params;

    if (!tenant || !employeeId || !filename) {
      return NextResponse.json(
        { error: 'Missing required parameters: tenant, employeeId, filename' },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent path traversal
    const sanitizedTenantId = tenant.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedEmployeeId = employeeId.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '');

    // Construct the file path
    const filePath = join(
      process.cwd(),
      'public',
      'uploads',
      sanitizedTenantId,
      'employees',
      'photos',
      sanitizedFilename
    );

    // Read and serve the file
    try {
      const fileBuffer = await readFile(filePath);
      
      // Determine content type based on extension
      let contentType = 'image/jpeg';
      const ext = sanitizedFilename.toLowerCase().split('.').pop();
      if (ext === 'png') contentType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'gif') contentType = 'image/gif';
      else if (ext === 'webp') contentType = 'image/webp';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Photo not found' },
          { status: 404 }
        );
      }
      throw readError;
    }
  } catch (error) {
    console.error('Error serving employee photo:', error);
    return NextResponse.json(
      { error: 'Failed to serve photo' },
      { status: 500 }
    );
  }
}
