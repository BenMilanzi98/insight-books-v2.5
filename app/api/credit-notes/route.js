// app/api/credit-notes/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createCreditNoteJournalEntry } from '@/lib/transactionJournalHelpers';

/**
 * Generate next credit note number: CN-YYYYMM-00001
 */
async function generateCreditNoteNumber(tenantId, tx = prisma) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `CN-${dateStr}`;

  const last = await tx.creditNote.findFirst({
    where: { tenantId, noteNumber: { startsWith: prefix } },
    orderBy: { noteNumber: 'desc' },
    select: { noteNumber: true },
  });

  let seq = 1;
  if (last?.noteNumber) {
    const parts = last.noteNumber.split('-');
    const lastPart = parts[parts.length - 1];
    const parsed = parseInt(lastPart, 10);
    if (!isNaN(parsed) && parsed >= 1) seq = parsed + 1;
  }
  return `${prefix}-${String(seq).padStart(5, '0')}`;
}

/**
 * GET - List credit notes with filters
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')) || 10));
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const invoiceId = searchParams.get('invoiceId');
    const sortBy = searchParams.get('sortBy') || 'noteDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const where = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (invoiceId) where.invoiceId = invoiceId;

    const [items, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          sale: { select: { id: true, saleNumber: true } },
          createdBy: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditNote.count({ where }),
    ]);

    return NextResponse.json({
      creditNotes: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error('Credit notes list error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to list credit notes' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create credit note (Draft or Posted)
 * Body: clientId, invoiceId?, saleId?, amount, reason, noteDate?, notes?, postToLedger?: boolean
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      invoiceId,
      saleId,
      amount,
      reason,
      noteDate,
      notes,
      postToLedger = false,
    } = body;

    if (!clientId || amount == null || !reason?.trim()) {
      return NextResponse.json(
        { error: 'clientId, amount, and reason are required' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (invoiceId) {
      const inv = await prisma.invoice.findFirst({
        where: { id: invoiceId, tenantId: user.tenantId, clientId },
      });
      if (!inv) {
        return NextResponse.json({ error: 'Invoice not found or does not belong to client' }, { status: 400 });
      }
    }
    if (saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, tenantId: user.tenantId, clientId },
      });
      if (!sale) {
        return NextResponse.json({ error: 'Sale not found or does not belong to client' }, { status: 400 });
      }
    }

    const date = noteDate ? new Date(noteDate) : new Date();

    const creditNote = await prisma.$transaction(async (tx) => {
      const noteNumber = await generateCreditNoteNumber(user.tenantId, tx);
      const note = await tx.creditNote.create({
        data: {
          noteNumber,
          tenantId: user.tenantId,
          clientId,
          invoiceId: invoiceId || null,
          saleId: saleId || null,
          amount: numAmount,
          reason: reason.trim(),
          noteDate: date,
          status: postToLedger ? 'Posted' : 'Draft',
          createdById: user.id,
          postedAt: postToLedger ? new Date() : null,
          postedById: postToLedger ? user.id : null,
          notes: notes?.trim() || null,
        },
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          sale: { select: { id: true, saleNumber: true } },
          createdBy: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true } },
        },
      });

      if (postToLedger) {
        await createCreditNoteJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          creditNoteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: date,
          amount: numAmount,
          reason: reason.trim(),
          tx,
        });
      }

      return note;
    });

    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (e) {
    console.error('Create credit note error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to create credit note' },
      { status: 500 }
    );
  }
}
