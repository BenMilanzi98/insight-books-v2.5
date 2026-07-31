/**
 * GET /api/coa-v2/export — export the business Chart of Accounts as CSV.
 *
 * Includes governance columns (category, behaviour, purpose, FS/CF mappings,
 * currency policy). Cell values are guarded against spreadsheet formula
 * injection. Business-scoped; audited.
 */

import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import prisma from '@/lib/prisma';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

/** Neutralize =, +, -, @ leading characters so exported cells never execute. */
function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const HEADERS = [
  'accountCode', 'accountName', 'description', 'category', 'subType', 'behaviour',
  'parentCode', 'normalBalance', 'postingAllowed', 'manualPostingAllowed', 'status',
  'systemPurpose', 'controlAccountPurpose', 'financialStatementSection',
  'cashFlowClassification', 'currencyPolicy', 'hierarchyPath',
];

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_EXPORT,
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const accounts = await prisma.account.findMany({
      where: { tenantId: context.businessId },
      select: {
        accountCode: true, code: true, accountName: true, name: true, description: true,
        accountType: true, normalBalance: true, isActive: true,
        parentAccount: { select: { accountCode: true, code: true } },
        coaV2Category: true, coaV2SubType: true, coaV2Behaviour: true, coaV2NormalBalance: true,
        coaV2Status: true, postingAllowed: true, manualPostingAllowed: true,
        systemPurpose: true, controlAccountPurpose: true, financialStatementSection: true,
        cashFlowClassification: true, currencyPolicy: true, hierarchyPath: true,
      },
      orderBy: { accountCode: 'asc' },
    });

    const lines = [HEADERS.join(',')];
    for (const a of accounts) {
      lines.push([
        csvCell(a.accountCode ?? a.code),
        csvCell(a.accountName ?? a.name),
        csvCell(a.description),
        csvCell(a.coaV2Category ?? a.accountType),
        csvCell(a.coaV2SubType),
        csvCell(a.coaV2Behaviour),
        csvCell(a.parentAccount?.accountCode ?? a.parentAccount?.code),
        csvCell(a.coaV2NormalBalance ?? a.normalBalance),
        csvCell(a.postingAllowed ?? ''),
        csvCell(a.manualPostingAllowed ?? ''),
        csvCell(a.coaV2Status ?? (a.isActive === false ? 'INACTIVE' : 'ACTIVE')),
        csvCell(a.systemPurpose),
        csvCell(a.controlAccountPurpose),
        csvCell(a.financialStatementSection),
        csvCell(a.cashFlowClassification),
        csvCell(a.currencyPolicy),
        csvCell(a.hierarchyPath),
      ].join(','));
    }

    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.EXPORT,
      context,
      entityType: 'ChartOfAccounts',
      entityId: context.businessId,
      newValues: { accountCount: accounts.length },
    });

    return new Response(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="chart-of-accounts.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return coaErrorResponse(error, 'export chart of accounts');
  }
}
