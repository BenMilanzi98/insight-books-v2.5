import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    let filename=""
    if(type==="invoice"){
        // Get invoice to send
        const invoice = await prisma.invoice.findUnique({
          where: {
            id: id,
            tenantId: user.tenantId
          }
        });
        
      if (!invoice) {
        return NextResponse.json({ exists: false });
      }
      filename = `invoice-${invoice.invoiceNumber}.pdf`;
    }else{
      filename = `quotation-${id}.pdf`;
    }
    
    const filePath = path.join(process.cwd(), 'tmp', filename);
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ exists: true });
    }
    return NextResponse.json({ exists: false });
  } catch (err) {
    console.error('File check error:', err);
    return NextResponse.json({ error: 'Failed to check file' }, { status: 500 });
  }
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  const boundary = contentType.split('boundary=')[1];

  if (!boundary) {
    return NextResponse.json({ error: 'Missing boundary' }, { status: 400 });
  }

  const reader = request.body.getReader();
  const chunks = [];
  let done = false;

  while (!done) {
    const { value, done: isDone } = await reader.read();
    if (value) chunks.push(value);
    done = isDone;
  }

  const rawData = Buffer.concat(chunks);
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  // Find file part (only 1 file expected)
  const fileStartIndex = rawData.indexOf(boundaryBuffer);
  const nextBoundaryIndex = rawData.indexOf(boundaryBuffer, fileStartIndex + boundaryBuffer.length);

  const filePart = rawData.slice(fileStartIndex, nextBoundaryIndex);

  // Extract filename from Content-Disposition
  const fileHeaderEnd = filePart.indexOf('\r\n\r\n');
  const headerString = filePart.slice(0, fileHeaderEnd).toString();
  const filenameMatch = headerString.match(/filename="(.+?)"/);
  
  // Use the original filename but ensure it's consistent with the check logic
  let filename = filenameMatch ? filenameMatch[1] : `upload-${Date.now()}.pdf`;
  
  // If this is a quotation file, ensure it uses the quotation ID format
  if (filename.includes('quotation-') && filename.includes('.pdf')) {
    // Extract the quotation ID from the filename if possible
    // The filename should be in format: quotation-{quotationNumber}.pdf
    // We'll keep this format for consistency
  }

  const fileContent = filePart.slice(fileHeaderEnd + 4, filePart.length - 2); // remove trailing \r\n

  // Save file
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, fileContent);

  return NextResponse.json({
    success: true,
    message: 'PDF uploaded correctly',
    filename,
    path: filePath,
  });
}
