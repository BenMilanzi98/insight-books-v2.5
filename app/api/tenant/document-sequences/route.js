import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  DOCUMENT_SEQUENCE_TYPES,
  resetDocumentSequences,
} from '@/lib/documentSequences';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with this user' }, { status: 400 });
    }

    const sequences = await prisma.documentSequence.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { documentType: 'asc' },
      select: { documentType: true, lastIssued: true, updatedAt: true },
    });

    return NextResponse.json({ sequences });
  } catch (error) {
    console.error('GET document-sequences:', error);
    return NextResponse.json(
      { error: 'Failed to load document sequences.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with this user' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const types = Array.isArray(body.types) ? body.types : [];
    const lastIssued = body.lastIssued !== undefined ? Number(body.lastIssued) : 0;

    if (types.length === 0) {
      return NextResponse.json(
        { error: 'Provide a non-empty types array (PO, GR, INV, QUO).' },
        { status: 400 }
      );
    }

    const invalid = types.filter((t) => !DOCUMENT_SEQUENCE_TYPES.includes(t));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown document types: ${invalid.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Number.isFinite(lastIssued) || lastIssued < 0) {
      return NextResponse.json(
        { error: 'lastIssued must be a number greater than or equal to 0.' },
        { status: 400 }
      );
    }

    await resetDocumentSequences(prisma, user.tenantId, types, lastIssued);

    try {
      await prisma.auditLog.create({
        data: {
          action: 'DOCUMENT_SEQUENCES_RESET',
          entityType: 'TENANT',
          entityId: user.tenantId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({ types, lastIssued }),
        },
      });
    } catch (auditErr) {
      console.warn('Document sequence reset: audit log failed:', auditErr?.message || auditErr);
    }

    return NextResponse.json({
      ok: true,
      message:
        lastIssued === 0
          ? 'Counters reset. The next new purchase order, receipt, invoice, or quotation (per type selected) will use suffix 00001.'
          : `Counters updated. Next issued suffix will be ${String(lastIssued + 1).padStart(5, '0')} for each selected type.`,
      types,
      lastIssued,
    });
  } catch (error) {
    console.error('POST document-sequences:', error);
    return NextResponse.json(
      { error: 'Failed to reset document sequences.' },
      { status: 500 }
    );
  }
}
