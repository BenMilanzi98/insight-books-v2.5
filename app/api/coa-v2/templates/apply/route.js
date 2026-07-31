/**
 * POST /api/coa-v2/templates/apply — apply SELECTED template additions.
 *
 * Body: { templateKey, version?, codes: string[] }
 * Creates only missing accounts; never updates or deletes existing rows,
 * never reassigns a system purpose that is already taken. Audited.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { applyTemplateAdditions } from '@/lib/coaV2/templates/coaTemplates.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function POST(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_MANAGE_TEMPLATES,
    ACCOUNTING_PERMISSIONS.COA_MANAGE,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const templateKey = String(body?.templateKey || '').trim();
  const codes = Array.isArray(body?.codes) ? body.codes.map((c) => String(c).trim()).filter(Boolean) : [];
  if (!templateKey || codes.length === 0) {
    return NextResponse.json({ error: 'templateKey and a non-empty codes array are required' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      applyTemplateAdditions({
        db: tx,
        context,
        ref: { templateKey, version: body?.version != null ? Number(body.version) : undefined },
        codes,
      })
    );

    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.TEMPLATE_APPLY,
      context,
      entityType: 'CoaV2Template',
      entityId: `${templateKey}:${body?.version ?? 'latest'}`,
      newValues: { createdCodes: result.created.map((c) => c.code) },
      reason: body?.reason ?? null,
    });

    return NextResponse.json(
      {
        created: result.created,
        message: `Added ${result.created.length} account(s) from template ${templateKey}`,
      },
      { status: 201 }
    );
  } catch (error) {
    return coaErrorResponse(error, 'apply template additions');
  }
}
