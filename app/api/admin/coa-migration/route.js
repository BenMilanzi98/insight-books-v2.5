import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildCoaReconciliationReport,
  listCatchAllOccupants,
} from '@/lib/coaMigration';

function toCsv(rows) {
  if (!rows.length) return 'id,tenantId,originalAccountId,originalCode,status,mappedToCode,migratedAt\n';
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'reconciliation';
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400 });
    }

    if (action === 'reconciliation') {
      const report = await buildCoaReconciliationReport(tenantId);
      return NextResponse.json(report);
    }

    if (action === 'catch-alls') {
      const data = await listCatchAllOccupants(tenantId);
      return NextResponse.json(data);
    }

    if (action === 'migration-log') {
      const format = (searchParams.get('format') || 'json').toLowerCase();
      const rows = await prisma.coaMigrationLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      if (format === 'csv') {
        return new NextResponse(toCsv(rows), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="coa-migration-log-${tenantId.slice(0, 8)}.csv"`,
          },
        });
      }
      return NextResponse.json({ tenantId, count: rows.length, rows });
    }

    if (action === 'skipped-tenants') {
      const locked = await prisma.tenant.findMany({
        where: { coaLocked: true },
        select: { id: true, name: true, subdomain: true },
        take: 200,
      });
      return NextResponse.json({ tenants: locked });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('admin coa-migration GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Request failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.action === 'approveEquityMigration') {
      if (!body.tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
      }
      await prisma.tenant.update({
        where: { id: body.tenantId },
        data: { coaEquityMigrationApproved: true },
      });
      return NextResponse.json({ ok: true, tenantId: body.tenantId });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('admin coa-migration POST:', error);
    return NextResponse.json(
      { error: error?.message || 'Request failed' },
      { status: 500 }
    );
  }
}
