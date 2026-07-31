/**
 * /api/coa-v2/templates — versioned Chart of Accounts templates.
 *
 * GET — list registered template versions.
 *   ?compare=TEMPLATE_KEY[&version=N] additionally returns a read-only
 *   comparison of the session business against that template (preview).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { compareTemplateToBusiness } from '@/lib/coaV2/templates/coaTemplates.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const templates = await prisma.coaV2Template.findMany({
      select: {
        id: true, templateKey: true, name: true, version: true, businessType: true,
        country: true, description: true, status: true, publishedAt: true,
        _count: { select: { accounts: true } },
      },
      orderBy: [{ templateKey: 'asc' }, { version: 'desc' }],
    });

    const { searchParams } = new URL(request.url);
    const compareKey = searchParams.get('compare');
    let comparison = null;
    if (compareKey) {
      const versionRaw = searchParams.get('version');
      comparison = await compareTemplateToBusiness(context, {
        templateKey: compareKey,
        version: versionRaw ? Number(versionRaw) : undefined,
      });
    }

    return NextResponse.json({ templates, comparison });
  } catch (error) {
    return coaErrorResponse(error, 'list chart of accounts templates');
  }
}
