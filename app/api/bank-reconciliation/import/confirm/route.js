import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardBankReconRoute, accountingErrorResponse } from '@/lib/bankReconciliation/api/routeGuard.js';
import { BANK_RECON_PERMISSIONS } from '@/lib/bankReconciliation/permissions.js';
import { confirmImport } from '@/lib/bankReconciliation/application/importService.js';

export async function POST(request) {
  const guard = await guardBankReconRoute(request, BANK_RECON_PERMISSIONS.IMPORT);
  if (guard.response) return guard.response;
  try {
    const form = await request.formData();
    const batchId = form.get('batchId');
    const file = form.get('file');
    if (!batchId || !file) {
      return NextResponse.json({ error: 'batchId and file required' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await confirmImport(prisma, guard.context, {
      batchId: String(batchId),
      buffer,
      fileName: file.name,
      mimeType: file.type,
      reconciliationId: form.get('reconciliationId') ? String(form.get('reconciliationId')) : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'confirm statement import');
  }
}
