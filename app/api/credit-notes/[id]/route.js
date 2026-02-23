// app/api/credit-notes/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createCreditNoteJournalEntry } from '@/lib/transactionJournalHelpers';

/**
 * GET - Single credit note
 */
export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const note = await prisma.creditNote.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        client: true,
        invoice: { select: { id: true, invoiceNumber: true, total: true, issueDate: true } },
        sale: { select: { id: true, saleNumber: true, total: true, saleDate: true } },
        createdBy: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true } },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
    }

    return NextResponse.json({ creditNote: note });
  } catch (e) {
    console.error('Get credit note error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to get credit note' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update credit note or post draft to ledger
 * Body: postToLedger?: boolean (if true and status is Draft, post and set Posted)
 */
export async function PATCH(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const note = await prisma.creditNote.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!note) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { postToLedger } = body;

    if (postToLedger && note.status === 'Draft') {
      await prisma.$transaction(async (tx) => {
        await createCreditNoteJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          creditNoteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: note.noteDate,
          amount: note.amount,
          reason: note.reason,
          tx,
        });
        await tx.creditNote.update({
          where: { id },
          data: {
            status: 'Posted',
            postedAt: new Date(),
            postedById: user.id,
          },
        });
      });
    }

    const updated = await prisma.creditNote.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        sale: { select: { id: true, saleNumber: true } },
        createdBy: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ creditNote: updated });
  } catch (e) {
    console.error('Update credit note error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to update credit note' },
      { status: 500 }
    );
  }
}
