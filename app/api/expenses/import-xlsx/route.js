import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  parseWorkbookBuffer,
  dryRunExpenseImport,
  executeExpenseImport,
  IMPORT_MODES,
} from '@/lib/expenses/expenseExcelImport.js';

async function readWorkbookBuffer(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') || form.get('workbook');
    if (!file || typeof file === 'string') {
      return { error: 'No file uploaded (expected multipart field "file")', status: 400 };
    }
    const ab = await file.arrayBuffer();
    return { buffer: Buffer.from(ab), mode: form.get('mode') || null };
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return { error: 'Expected multipart file or JSON { base64 }', status: 400 };
  }

  if (body.base64) {
    const raw = String(body.base64).replace(/^data:[^;]+;base64,/, '');
    return { buffer: Buffer.from(raw, 'base64'), mode: body.mode || null };
  }

  return { error: 'Provide multipart file or JSON body.base64', status: 400 };
}

/**
 * POST /api/expenses/import-xlsx?dryRun=true (default)
 * dryRun=false executes NEW_EXPENSE_IMPORT / DRAFT_ONLY_IMPORT as Draft only (no auto-post).
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'expenses.create');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryRunParam = searchParams.get('dryRun');
    const dryRun = dryRunParam == null ? true : dryRunParam !== 'false';

    const loaded = await readWorkbookBuffer(request);
    if (loaded.error) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    let sheets;
    try {
      sheets = await parseWorkbookBuffer(loaded.buffer);
    } catch (parseErr) {
      return NextResponse.json(
        { error: 'Invalid Excel workbook', details: parseErr.message },
        { status: 400 }
      );
    }

    const modeHint = loaded.mode || searchParams.get('mode') || undefined;

    if (dryRun) {
      const result = await dryRunExpenseImport({
        tenantId: user.tenantId,
        sheets,
        db: prisma,
        mode: modeHint,
      });
      if (result.errors.some((e) => e.code === 'CROSS_TENANT_MANIFEST')) {
        return NextResponse.json(
          { error: 'Cross-tenant import rejected', ...result, dryRun: true },
          { status: 403 }
        );
      }
      return NextResponse.json({ dryRun: true, ...result });
    }

    try {
      const result = await executeExpenseImport({
        tenantId: user.tenantId,
        userId: user.id,
        sheets,
        db: prisma,
        mode: modeHint,
      });
      return NextResponse.json({ dryRun: false, ...result });
    } catch (execErr) {
      if (execErr.code === 'CROSS_TENANT_MANIFEST') {
        return NextResponse.json(
          { error: 'Cross-tenant import rejected', dryRun: execErr.dryRun, dryRunFlag: false },
          { status: 403 }
        );
      }
      if (execErr.code === 'RECONCILE_EXECUTE_FORBIDDEN') {
        return NextResponse.json(
          {
            error: execErr.message,
            mode: IMPORT_MODES.RECONCILE_EXISTING,
            dryRun: execErr.dryRun,
          },
          { status: 400 }
        );
      }
      throw execErr;
    }
  } catch (error) {
    console.error('expense import-xlsx:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import expenses workbook' },
      { status: 500 }
    );
  }
}
