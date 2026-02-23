// app/api/purchases/orders/[id]/upload/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST - Upload supplier invoice (PDF/Image) and store against PO. Links to supplier ledger via PO → SupplierBill.
 */
export async function POST(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: orderId } = await params;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId }
    });
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required (PDF or image)' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }
    const mime = (file.type || '').toLowerCase();
    const allowed = ALLOWED_TYPES.some((t) => t === mime || mime.startsWith(t.split('/')[0]));
    if (!allowed) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, JPEG, PNG, GIF, WebP' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', user.tenantId, 'po-invoices', orderId);
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || (mime === 'application/pdf' ? '.pdf' : '.jpg');
    const safeName = `${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const fileUrl = `/uploads/${user.tenantId}/po-invoices/${orderId}/${safeName}`;

    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { supplierInvoiceUrl: fileUrl }
    });

    return NextResponse.json({ url: fileUrl, message: 'Supplier invoice uploaded and linked to PO.' });
  } catch (error) {
    console.error('PO invoice upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload supplier invoice' },
      { status: 500 }
    );
  }
}
