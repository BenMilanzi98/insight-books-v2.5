import { NextResponse } from 'next/server';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type'); // 'contract' or 'nationalId'
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate that file has required properties (File-like object)
    if (typeof file !== 'object' || file === null) {
      console.error('Invalid file object:', typeof file, file);
      return NextResponse.json(
        { error: 'Invalid file object provided' },
        { status: 400 }
      );
    }
    
    // Check if file has arrayBuffer method (File-like object)
    if (typeof file.arrayBuffer !== 'function') {
      console.error('File object missing arrayBuffer method:', file);
      return NextResponse.json(
        { error: 'Invalid file object - missing arrayBuffer method' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size === undefined || file.size === null) {
      console.error('File size is missing:', file);
      return NextResponse.json(
        { error: 'File size is required' },
        { status: 400 }
      );
    }
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 10MB allowed.' },
        { status: 400 }
      );
    }

    // Validate file name exists
    if (!file.name || typeof file.name !== 'string') {
      console.error('File name is missing or invalid:', file.name, 'File object:', Object.keys(file));
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg',
      'application/pdf'
    ];

    // Also check file extension as fallback
    const fileNameLower = file.name.toLowerCase();
    const hasValidExtension = fileNameLower.endsWith('.pdf') || 
                              fileNameLower.endsWith('.jpg') || 
                              fileNameLower.endsWith('.jpeg') || 
                              fileNameLower.endsWith('.png');

    // File type might be empty string or undefined, so we rely more on extension
    const fileType = file.type || '';
    if (fileType && !allowedTypes.includes(fileType) && !hasValidExtension) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: PDF, JPG, PNG' },
        { status: 400 }
      );
    }
    
    // If no file type and no valid extension, reject
    if (!fileType && !hasValidExtension) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: PDF, JPG, PNG' },
        { status: 400 }
      );
    }

    // Create uploads directory structure: /uploads/tenantId/employees/documents/
    const uploadDir = join(process.cwd(), 'public', 'uploads', user.tenantId, 'employees', 'documents');
    
    try {
      // Check if directory exists and is writable, if not create it
      try {
        await access(uploadDir, constants.W_OK);
        // Directory exists and is writable
      } catch (accessError) {
        // Directory doesn't exist or not writable, create it
        // Use recursive: true to create all parent directories
        await mkdir(uploadDir, { recursive: true, mode: 0o755 });
      }
    } catch (mkdirError) {
      console.error('Error creating upload directory:', mkdirError);
      console.error('Directory path:', uploadDir);
      console.error('Error details:', {
        code: mkdirError.code,
        errno: mkdirError.errno,
        path: mkdirError.path,
        syscall: mkdirError.syscall,
        message: mkdirError.message
      });
      
      // If it's a permission error, provide a more helpful message
      if (mkdirError.code === 'EACCES' || mkdirError.code === 'EPERM') {
        return NextResponse.json(
          { 
            error: 'Permission denied. Please check uploads directory permissions.', 
            details: mkdirError.message,
            code: mkdirError.code
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create upload directory', 
          details: mkdirError.message,
          code: mkdirError.code,
          path: uploadDir
        },
        { status: 500 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    
    // Get file extension safely
    let fileExtension = 'pdf'; // default
    if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      fileExtension = parts[parts.length - 1].toLowerCase();
    } else if (file.type) {
      // Fallback to MIME type
      if (file.type.includes('pdf')) fileExtension = 'pdf';
      else if (file.type.includes('jpeg') || file.type.includes('jpg')) fileExtension = 'jpg';
      else if (file.type.includes('png')) fileExtension = 'png';
    }
    
    // Sanitize type to prevent path injection
    const safeType = (type && typeof type === 'string') ? type.replace(/[^a-zA-Z0-9]/g, '') : 'document';
    const fileName = `${safeType}-${timestamp}-${randomString}.${fileExtension}`;
    const filePath = join(uploadDir, fileName);

    // Save file
    let bytes;
    try {
      bytes = await file.arrayBuffer();
    } catch (arrayBufferError) {
      console.error('Error reading file arrayBuffer:', arrayBufferError);
      return NextResponse.json(
        { error: 'Failed to read file data', details: arrayBufferError.message },
        { status: 500 }
      );
    }
    
    const buffer = Buffer.from(bytes);
    
    try {
      await writeFile(filePath, buffer);
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return NextResponse.json(
        { error: 'Failed to save file', details: writeError.message },
        { status: 500 }
      );
    }

    // Public URL for the file
    const fileUrl = `/uploads/${user.tenantId}/employees/documents/${fileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: fileName,
      size: file.size,
      type: file.type || 'application/octet-stream'
    });
  } catch (error) {
    console.error('Error uploading employee document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', details: error.message },
      { status: 500 }
    );
  }
}

