// app/api/invoices/upload/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Check for multiple possible filename patterns
    const possibleFilenames = [
      `invoice-${id}.pdf`,           // Direct ID format
      `invoice-INV-${id}.pdf`,      // Invoice number format
      `invoice-${id}.pdf`           // Fallback
    ];

    let foundFile = null;
    let foundFilename = null;

    for (const filename of possibleFilenames) {
      const filePath = path.join(process.cwd(), 'tmp', filename);
      if (fs.existsSync(filePath)) {
        foundFile = filePath;
        foundFilename = filename;
        break;
      }
    }

    if (foundFile) {
      return NextResponse.json({ 
        exists: true, 
        filename: foundFilename,
        size: fs.statSync(foundFile).size 
      });
    } else {
      return NextResponse.json({ 
        exists: false, 
        searchedFilenames: possibleFilenames
      });
    }
  } catch (error) {
    console.error('Error checking invoice file:', error);
    return NextResponse.json({ error: 'Failed to check file' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const id = formData.get('id');
    const filename = formData.get('filename');

    if (!file || !id) {
      return NextResponse.json({ error: 'File and ID are required' }, { status: 400 });
    }

    // Ensure tmp directory exists
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Use the provided filename if available, otherwise generate one
    const finalFilename = filename || `invoice-${id}.pdf`;
    const filePath = path.join(tmpDir, finalFilename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save the file
    fs.writeFileSync(filePath, buffer);

    console.log(`Invoice PDF saved: ${finalFilename} (${buffer.length} bytes)`);

    return NextResponse.json({ 
      success: true, 
      filename: finalFilename,
      size: buffer.length 
    });
  } catch (error) {
    console.error('Error uploading invoice file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
} 