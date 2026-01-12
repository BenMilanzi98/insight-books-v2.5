import { NextResponse } from 'next/server';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const employeeId = formData.get('employeeId');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!file.type || !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG and PNG images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 5MB allowed.' },
        { status: 400 }
      );
    }

    // Verify employee exists and belongs to tenant
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, tenantId: true }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    if (employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create uploads directory structure: /uploads/tenantId/employees/photos/
    const uploadDir = join(process.cwd(), 'public', 'uploads', user.tenantId, 'employees', 'photos');
    
    try {
      // Check if directory exists and is writable, if not create it
      try {
        await access(uploadDir, constants.W_OK);
      } catch (accessError) {
        // Directory doesn't exist or not writable, create it
        await mkdir(uploadDir, { recursive: true, mode: 0o755 });
      }
    } catch (mkdirError) {
      console.error('Error creating upload directory:', mkdirError);
      return NextResponse.json(
        { 
          error: 'Failed to create upload directory', 
          details: mkdirError.message
        },
        { status: 500 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    
    // Get file extension safely
    let fileExtension = 'jpg'; // default
    if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      fileExtension = parts[parts.length - 1].toLowerCase();
    } else if (file.type) {
      // Fallback to MIME type
      if (file.type.includes('png')) fileExtension = 'png';
      else if (file.type.includes('jpeg') || file.type.includes('jpg')) fileExtension = 'jpg';
    }
    
    const fileName = `photo-${employeeId}-${timestamp}-${randomString}.${fileExtension}`;
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
    const fileUrl = `/uploads/${user.tenantId}/employees/photos/${fileName}`;

    // Update employee record with photo URL
    // Store in a JSON field or add a photoUrl field if it exists in schema
    // For now, we'll store it in contactDetails JSON field
    const existingContactDetails = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { contactDetails: true }
    });

    const contactDetails = existingContactDetails?.contactDetails && typeof existingContactDetails.contactDetails === 'object'
      ? existingContactDetails.contactDetails
      : {};

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        contactDetails: {
          ...contactDetails,
          photoUrl: fileUrl,
          photo: fileUrl
        }
      }
    });

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: fileName,
      size: file.size,
      type: file.type || 'image/jpeg'
    });
  } catch (error) {
    console.error('Error uploading employee photo:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error.message },
      { status: 500 }
    );
  }
}

