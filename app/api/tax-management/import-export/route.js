import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { TAX_PURPOSE_LIST } from '@/lib/taxManagement/purposes';
import { upsertTaxAccountMapping } from '@/lib/taxManagement/taxAccountMappingService';

/**
 * Controlled import for purpose→account mappings.
 * POST { dryRun: true|false, rows: [{ purpose, accountId, notes? }] }
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, [
      'tax.update',
      'taxManagement.update',
      'tax.export',
    ]);
    if (perm) return perm;

    const body = await request.json();
    const dryRun = body.dryRun !== false; // default dry-run
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'rows[] is required' }, { status: 400 });
    }
    if (rows.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 rows per import' }, { status: 400 });
    }

    const results = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const purpose = String(row.purpose || '').trim();
      const accountId = String(row.accountId || '').trim();
      if (!TAX_PURPOSE_LIST.includes(purpose)) {
        results.push({ index: i, ok: false, error: `Unknown purpose: ${purpose}` });
        continue;
      }
      if (!accountId) {
        results.push({ index: i, ok: false, error: 'accountId required' });
        continue;
      }
      if (dryRun) {
        results.push({ index: i, ok: true, action: 'WOULD_UPSERT', purpose, accountId });
        continue;
      }
      try {
        const mapping = await upsertTaxAccountMapping({
          tenantId: user.tenantId,
          userId: user.id,
          purpose,
          accountId,
          notes: row.notes || `import:${new Date().toISOString()}`,
        });
        results.push({
          index: i,
          ok: true,
          action: 'UPSERTED',
          mappingId: mapping.id,
          purpose,
          accountId,
        });
      } catch (err) {
        results.push({
          index: i,
          ok: false,
          error: err.message || 'Upsert failed',
          code: err.code,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      dryRun,
      total: rows.length,
      okCount,
      failCount: rows.length - okCount,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    supportedImports: ['tax-account-mappings'],
    dryRunDefault: true,
    purposes: TAX_PURPOSE_LIST,
    example: {
      dryRun: true,
      rows: [{ purpose: 'VAT_OUTPUT', accountId: 'acc_...', notes: 'optional' }],
    },
  });
}
