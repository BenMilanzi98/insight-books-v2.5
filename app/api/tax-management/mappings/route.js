import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listTaxAccountMappings,
  upsertTaxAccountMapping,
} from '@/lib/taxManagement/taxAccountMappingService';
import { TAX_PURPOSE_LIST } from '@/lib/taxManagement/purposes';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get('purpose');
    const mappings = await listTaxAccountMappings({
      tenantId: user.tenantId,
      purpose: purpose || null,
    });

    return NextResponse.json({
      mappings,
      purposes: TAX_PURPOSE_LIST,
    });
  } catch (error) {
    console.error('GET /api/tax-management/mappings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load mappings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const perm = await requireAnyPermission(request, [
      'tax.update',
      'taxManagement.update',
    ]);
    if (perm) return perm;

    const body = await request.json();
    const { purpose, accountId, taxTypeId, effectiveFrom, effectiveTo, notes } = body || {};
    if (!purpose || !accountId) {
      return NextResponse.json(
        { error: 'purpose and accountId are required' },
        { status: 400 }
      );
    }

    const mapping = await upsertTaxAccountMapping({
      tenantId: user.tenantId,
      userId: user.id,
      purpose,
      accountId,
      taxTypeId: taxTypeId || null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      notes: notes || null,
    });

    return NextResponse.json({ success: true, mapping }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tax-management/mappings:', error);
    const status =
      error.code === 'UNKNOWN_PURPOSE' || error.code === 'MAPPING_UNAVAILABLE'
        ? 400
        : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to save mapping', code: error.code },
      { status }
    );
  }
}
