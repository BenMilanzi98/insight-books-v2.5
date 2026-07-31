import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { previewImport } from '@/lib/bankReconciliation/application/importService.js';

export async function POST(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.IMPORT);
  if (guard.response) return guard.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const paymentAccountId = form.get('paymentAccountId');
    if (!file || !paymentAccountId) {
      return NextResponse.json({ error: 'file and paymentAccountId required' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await previewImport(prisma, guard.context, {
      paymentAccountId: String(paymentAccountId),
      fileName: file.name || 'statement.csv',
      buffer,
      mimeType: file.type,
      profileId: form.get('profileId') ? String(form.get('profileId')) : null,
      statementOpening: form.get('statementOpening') || null,
      statementClosing: form.get('statementClosing') || null,
    });
    // Do not echo full parsedRows to client — keep preview capped
    return NextResponse.json({
      batch: result.batch,
      previewRows: result.previewRows,
      totalRows: result.totalRows,
      duplicateRowCount: result.duplicateRowCount,
      balanceCheck: result.balanceCheck,
      // stash hash so confirm can re-parse; client sends batchId + file again
    });
  } catch (error) {
    return accountingErrorResponse(error, 'preview statement import');
  }
}
