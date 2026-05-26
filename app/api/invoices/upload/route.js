// app/api/invoices/upload/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  findInvoicePdf,
  getInvoicePdfDir,
  invoicePdfFilenames,
  saveInvoicePdf,
} from '@/lib/invoicePdfStorage';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const found = findInvoicePdf(id, null);
    const possibleFilenames = invoicePdfFilenames(id, null);

    if (found) {
      return NextResponse.json({
        exists: true,
        filename: found.filename,
        size: fs.statSync(found.filePath).size,
      });
    }

    return NextResponse.json({
      exists: false,
      searchedFilenames: possibleFilenames,
      searchedDirs: [getInvoicePdfDir()],
    });
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

    const finalFilename = filename || `invoice-${id}.pdf`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { filePath } = saveInvoicePdf(buffer, finalFilename);

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