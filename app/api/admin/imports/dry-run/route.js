import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { dryRunImport } from '@/lib/admin/importDryRun';

/**
 * POST /api/admin/imports/dry-run
 * Body (JSON): { type: 'tenants'|'users', rows: [...] | csv string }
 * Or multipart: fields type + file (csv) or rows (json string)
 * Never persists — validation/preview only.
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let type;
    let rows;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      type = form.get('type');
      const file = form.get('file');
      const rowsField = form.get('rows');

      if (file && typeof file === 'object' && typeof file.text === 'function') {
        rows = await file.text();
      } else if (typeof rowsField === 'string') {
        try {
          rows = JSON.parse(rowsField);
        } catch {
          rows = rowsField;
        }
      } else {
        rows = [];
      }
    } else {
      const body = await request.json().catch(() => ({}));
      type = body.type;
      rows = body.rows ?? body.csv ?? body.data;
    }

    const importType = String(type || '').trim().toLowerCase();
    if (importType === 'tenants') {
      if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.create)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (importType === 'users') {
      if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.create)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid type. Use 'tenants' or 'users'." },
        { status: 400 }
      );
    }

    const result = dryRunImport(importType, rows);

    return NextResponse.json({
      success: result.ok,
      dryRun: true,
      persisted: false,
      ...result,
      message: result.ok
        ? `Dry-run OK — ${result.rowCount} row(s) valid. Nothing was written.`
        : `Dry-run found ${result.errors.length} issue(s). Nothing was written.`,
    });
  } catch (error) {
    console.error('imports dry-run error:', error);
    return NextResponse.json(
      { success: false, error: 'Import dry-run failed', dryRun: true, persisted: false },
      { status: 500 }
    );
  }
}
