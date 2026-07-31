/**
 * /api/accounting-v2/ledger/export — CSV export of the canonical ledger.
 *
 * GET — exports EXACTLY what the ledger screen shows, via the same query
 * service (single query contract for screen and export — fixes the legacy
 * divergence class). Modes:
 *   type=summary          — per-account opening/movement/closing
 *   type=account&accountId — account activity with running balances
 * Every export is audited. CSV cells are protected against formula injection.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  getBusinessLedgerSummary,
  getAccountLedger,
} from '@/lib/accountingV2/ledger/ledgerQueryService.js';
import { recordAccountingAudit } from '@/lib/accountingV2/infrastructure/auditTrail.js';

function csvCell(value) {
  if (value == null) return '';
  let text = String(value);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const csvRow = (cells) => cells.map(csvCell).join(',');

function parseDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.LEDGER_EXPORT,
    ACCOUNTING_PERMISSIONS.LEDGER_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'summary';
    const options = {
      startDate: parseDate(searchParams.get('startDate')),
      endDate: parseDate(searchParams.get('endDate')),
      branchId: searchParams.get('branchId') || null,
    };

    let rows = [];
    let filename;
    if (type === 'account') {
      const accountId = searchParams.get('accountId');
      const ledger = await getAccountLedger(prisma, context, {
        accountId,
        ...options,
        page: 1,
        pageSize: 500,
        order: 'asc',
      });
      // Export every page under the same engine ordering.
      let lines = [...ledger.lines];
      for (let p = 2; (p - 1) * 500 < ledger.pagination.totalLines; p += 1) {
        const next = await getAccountLedger(prisma, context, {
          accountId,
          ...options,
          page: p,
          pageSize: 500,
          order: 'asc',
        });
        lines = lines.concat(next.lines);
      }
      rows.push(csvRow(['Account', ledger.account.accountCode, ledger.account.accountName]));
      rows.push(csvRow(['Opening balance', ledger.opening.display]));
      rows.push(csvRow([]));
      rows.push(csvRow(['Posting date', 'Journal', 'Reference', 'Description', 'Debit', 'Credit', 'Running balance', 'Source']));
      for (const line of lines) {
        rows.push(
          csvRow([
            new Date(line.postingDate).toISOString().slice(0, 10),
            line.journalNumber ?? line.journalId,
            line.reference,
            line.lineDescription ?? line.description,
            line.debit,
            line.credit,
            line.runningBalance.display,
            line.sourceType ? `${line.sourceType}:${line.sourceId ?? ''}` : line.journalKind,
          ])
        );
      }
      rows.push(csvRow([]));
      rows.push(csvRow(['Period debits', ledger.period.debit]));
      rows.push(csvRow(['Period credits', ledger.period.credit]));
      rows.push(csvRow(['Closing balance', ledger.closing.display]));
      filename = `ledger-account-${ledger.account.accountCode ?? accountId}.csv`;
    } else {
      const summary = await getBusinessLedgerSummary(prisma, context, {
        ...options,
        includeZeroActivity: searchParams.get('includeZero') === 'true',
      });
      rows.push(csvRow(['Code', 'Account', 'Type', 'Normal balance', 'Opening', 'Debits', 'Credits', 'Closing', 'Abnormal']));
      for (const account of summary.accounts) {
        rows.push(
          csvRow([
            account.accountCode,
            account.accountName,
            account.accountType,
            account.normalBalance,
            account.opening.display,
            account.periodDebit,
            account.periodCredit,
            account.closing.display,
            account.closing.abnormal ? 'YES' : '',
          ])
        );
      }
      rows.push(csvRow([]));
      rows.push(csvRow(['Total debits', summary.totals.periodDebit]));
      rows.push(csvRow(['Total credits', summary.totals.periodCredit]));
      rows.push(csvRow(['Balanced', summary.totals.balanced ? 'YES' : 'NO']));
      filename = 'ledger-summary.csv';
    }

    await recordAccountingAudit({
      action: 'acctv2.ledger.export',
      entityType: 'LedgerExport',
      entityId: `${context.businessId}:${type}`,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        type,
        startDate: options.startDate ?? null,
        endDate: options.endDate ?? null,
        accountId: searchParams.get('accountId') ?? null,
      },
      requestId: context.requestId,
      correlationId: context.correlationId,
    });

    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return accountingErrorResponse(error, 'ledger export');
  }
}
