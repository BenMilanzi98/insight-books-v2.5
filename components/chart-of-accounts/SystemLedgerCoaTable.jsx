'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Shield,
  Eye,
  Edit,
  GitMerge,
  Trash2,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  SYSTEM_COA_STRUCTURE,
  groupAccountsByCode,
  sumLedgerBalances,
  pickPrimaryAccountForStructure,
  accountsFor1130ExtraDropdown,
  accountsForCatchAllDropdown,
  accountsFor3100CapitalDropdown,
  accountTypeForStructureCode,
} from '@/lib/coaSystemStructureTree.js';
import { structureNodeBalanceBreakdown } from '@/lib/coaStructureDisplayBalance.js';

const ROOT_CODES = new Set(['1000', '2000', '3000', '4000', '5000']);

const ROOT_THEME = {
  '1000': {
    accent: 'border-l-[3px] border-l-emerald-500',
    rowBg: 'bg-emerald-50/50',
  },
  '2000': {
    accent: 'border-l-[3px] border-l-sky-500',
    rowBg: 'bg-sky-50/50',
  },
  '3000': {
    accent: 'border-l-[3px] border-l-violet-500',
    rowBg: 'bg-violet-50/50',
  },
  '4000': {
    accent: 'border-l-[3px] border-l-amber-500',
    rowBg: 'bg-amber-50/40',
  },
  '5000': {
    accent: 'border-l-[3px] border-l-rose-500',
    rowBg: 'bg-rose-50/50',
  },
};

const coaBtnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]';

function collectStructureExpandKeys(nodes, out = []) {
  for (const n of nodes) {
    if (n.children?.length) {
      out.push(`struct-${n.code}`);
      collectStructureExpandKeys(n.children, out);
    }
  }
  return out;
}

function typeBadgeClass(t) {
  const x = String(t || '').toLowerCase();
  if (x === 'asset') return 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70';
  if (x === 'liability') return 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/70';
  if (x === 'equity') return 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/70';
  if (x === 'income' || x === 'revenue') return 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/70';
  if (x === 'expense') return 'bg-rose-50 text-rose-900 ring-1 ring-rose-200/70';
  return 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80';
}

/**
 * SYSTEM structure chart (same for every tenant) + dropdown buckets for out-of-tree codes.
 *
 * @param {Object} props
 * @param {Array<Record<string, unknown>>} props.accounts
 * @param {boolean} props.activeFilter
 * @param {boolean} props.loading
 * @param {(a: Record<string, unknown>) => void} [props.onViewAccount]
 * @param {(a: Record<string, unknown>) => void} [props.onEditAccount]
 * @param {(a: Record<string, unknown>) => void} [props.onMergeAccount]
 * @param {(id: string) => void} [props.onDeleteAccount]
 * @param {boolean} [props.showExpandToolbar]
 * @param {boolean} [props.showEdit]
 * @param {boolean} [props.showDelete]
 * @param {import('react').ReactNode} [props.emptyStateExtra] — e.g. Sync / Import actions when the ledger list is empty
 */
export default function SystemLedgerCoaTable({
  accounts,
  activeFilter,
  loading,
  onViewAccount,
  onEditAccount,
  onMergeAccount,
  onDeleteAccount,
  showExpandToolbar = true,
  showEdit = true,
  showDelete = true,
  emptyStateExtra = null,
}) {
  const [expandedAccounts, setExpandedAccounts] = useState(() => new Set());

  useEffect(() => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.children?.length) {
            next.add(`struct-${n.code}`);
            walk(n.children);
          }
        }
      };
      walk(SYSTEM_COA_STRUCTURE);
      next.add('struct-3100');
      return next;
    });
  }, [accounts.length]);

  const toggleExpand = (expandKey) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(expandKey)) next.delete(expandKey);
      else next.add(expandKey);
      return next;
    });
  };

  const accountsByCode = useMemo(() => groupAccountsByCode(accounts), [accounts]);

  const dropdownBuckets = useMemo(
    () => ({
      h1130: accountsFor1130ExtraDropdown(accounts),
      c1999: accountsForCatchAllDropdown(accounts, '1999'),
      c2999: accountsForCatchAllDropdown(accounts, '2999'),
      c3999: accountsForCatchAllDropdown(accounts, '3999'),
      c4900: accountsForCatchAllDropdown(accounts, '4900'),
      c5900: accountsForCatchAllDropdown(accounts, '5900'),
      cap3100: accountsFor3100CapitalDropdown(accounts),
    }),
    [accounts]
  );

  const structureBalanceMemo = useMemo(() => new Map(), [accounts, activeFilter]);

  const handleExpandAll = useCallback(() => {
    setExpandedAccounts(new Set(collectStructureExpandKeys(SYSTEM_COA_STRUCTURE)));
  }, []);

  const handleCollapseToRoots = useCallback(() => {
    const next = new Set();
    for (const r of SYSTEM_COA_STRUCTURE) {
      next.add(`struct-${r.code}`);
    }
    next.add('struct-3100');
    setExpandedAccounts(next);
  }, []);

  const renderLedgerExtrasDropdown = (title, items) => {
    if (!items?.length) return null;
    return (
      <details className="mt-2 rounded-lg border border-indigo-100/90 bg-indigo-50/40 p-2.5 open:shadow-sm">
        <summary className="cursor-pointer select-none text-xs font-semibold text-indigo-900 hover:text-indigo-950">
          {title}{' '}
          <span className="ml-1 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
            {items.length}
          </span>
        </summary>
        <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto border-t border-indigo-200/40 pt-2 pl-0.5">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-xs ring-1 ring-slate-200/50"
            >
              <button
                type="button"
                onClick={() => onViewAccount?.(a)}
                className="min-w-0 flex-1 text-left font-mono text-[11px] leading-snug text-slate-900 hover:underline"
              >
                <span className="font-semibold">{a.accountCode || a.code}</span>
                <span className="font-sans text-slate-600"> — {a.accountName || a.name || '—'}</span>
              </button>
              <span className="shrink-0 font-mono text-[11px] font-medium text-slate-700">
                {formatCurrency(Number(a.currentBalance) || 0)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    );
  };

  const renderStructureNodeRow = (node, level = 0) => {
    const structKey = `struct-${node.code}`;
    const matches = (accountsByCode.get(node.code) || []).filter((a) =>
      activeFilter ? a.isActive !== false : true
    );
    const breakdown = structureNodeBalanceBreakdown(
      node,
      accountsByCode,
      dropdownBuckets,
      activeFilter,
      structureBalanceMemo
    );
    const rowBalance = breakdown.display;
    const primary =
      pickPrimaryAccountForStructure(matches, node.name, node.code) ||
      matches.find((m) => m.isActive !== false) ||
      matches[0] ||
      null;
    const acctType = primary
      ? primary.accountType || primary.type || accountTypeForStructureCode(node.code)
      : accountTypeForStructureCode(node.code);
    const isRoot = level === 0 && ROOT_CODES.has(node.code);
    const hasStructChildren = !!(node.children && node.children.length > 0);
    const isExpanded = expandedAccounts.has(structKey);
    const legacyName =
      primary &&
      (primary.accountName || primary.name) &&
      node.name &&
      String(primary.accountName || primary.name).trim() !== String(node.name).trim();

    const dupes = matches.length > 1 ? matches : [];
    const hExtra = node.code === '1130' ? dropdownBuckets.h1130 : [];
    const catchExtra =
      node.code === '1999'
        ? dropdownBuckets.c1999
        : node.code === '2999'
          ? dropdownBuckets.c2999
          : node.code === '3999'
            ? dropdownBuckets.c3999
            : node.code === '4900'
              ? dropdownBuckets.c4900
              : node.code === '5900'
                ? dropdownBuckets.c5900
                : [];
    const capExtra = node.code === '3100' ? dropdownBuckets.cap3100 : [];

    const rootTheme = isRoot ? ROOT_THEME[node.code] : null;
    const showRollupHint =
      primary &&
      primary.postedDirectBalance != null &&
      Math.abs(Number(primary.postedDirectBalance) - Number(rowBalance || 0)) > 0.005;
    const subtreeMismatch =
      hasStructChildren &&
      matches.length > 0 &&
      Math.abs(breakdown.leafSelf - breakdown.childrenSum) > 0.005;
    const rollupBalanceTitle =
      showRollupHint || subtreeMismatch
        ? [
            showRollupHint
              ? `Posted on this code only: ${formatCurrency(primary.postedDirectBalance)}. Displayed: ${formatCurrency(rowBalance)}.`
              : null,
            subtreeMismatch
              ? `Visible subtree sums to ${formatCurrency(breakdown.childrenSum)}; rolled row ${formatCurrency(breakdown.leafSelf)}. Check hidden parents or links.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')
        : undefined;

    const isLocked = primary ? primary.isSystem || primary.transactionCount > 0 : true;
    const rowActive = primary ? primary.isActive !== false : true;

    return (
      <React.Fragment key={structKey}>
        <tr
          className={[
            'group/row border-b border-slate-100/90 transition-colors duration-150',
            primary && !primary.isActive ? 'opacity-55' : '',
            isRoot && rootTheme
              ? `${rootTheme.accent} ${rootTheme.rowBg} hover:bg-white/80`
              : 'border-l-[3px] border-l-transparent bg-white hover:bg-slate-50/70',
          ].join(' ')}
        >
          <td className="px-2 py-2.5 align-middle sm:px-4 sm:py-3 md:px-5 md:py-3.5">
            <div
              className="flex items-center gap-2.5 min-w-0"
              style={{ paddingLeft: `${level * 14}px` }}
            >
              {hasStructChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(structKey)}
                  className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-900 active:scale-[0.98]"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={16} strokeWidth={2.25} /> : <ChevronRight size={16} strokeWidth={2.25} />}
                </button>
              ) : (
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                </span>
              )}
              <code
                className={[
                  'shrink-0 rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold tabular-nums tracking-tight',
                  isRoot
                    ? 'bg-white/90 text-slate-900 shadow-sm ring-1 ring-slate-300/50'
                    : 'bg-slate-100/95 text-slate-800 ring-1 ring-slate-200/50',
                ].join(' ')}
              >
                {node.code}
              </code>
            </div>
          </td>
          <td className="px-4 py-3 align-middle sm:px-5 sm:py-3.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={[
                  'min-w-0 text-[13px] leading-snug text-slate-900',
                  isRoot || hasStructChildren ? 'font-semibold tracking-tight' : 'font-medium text-slate-800',
                ].join(' ')}
              >
                {node.name}
              </span>
              {legacyName ? (
                <span
                  className="max-w-[220px] truncate text-[11px] font-normal text-slate-500 sm:max-w-xs"
                  title="The GL code matches this row, but the name stored on the account differs from the standard chart label. Rename the account if the label is wrong, or open the duplicate list when several rows share this code.">
                  DB name: {primary.accountName || primary.name}
                </span>
              ) : null}
              {primary?.mergedIntoAccount ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900 ring-1 ring-violet-100" title="System merge: row and code kept for audit; pickers use target">
                  → {primary.mergedIntoAccount.accountCode}{' '}
                  {primary.mergedIntoAccount.accountName || ''}
                </span>
              ) : null}
              {primary?.isSystem ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Shield size={10} strokeWidth={2.5} />
                  System
                </span>
              ) : null}
              {primary?.requiresReclassification ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 ring-1 ring-amber-200/80">
                  Needs reclassification
                </span>
              ) : null}
            </div>
            {renderLedgerExtrasDropdown('Multiple database rows for this GL code', dupes)}
            {node.code === '1130' ? renderLedgerExtrasDropdown('Other bank & mobile GL accounts (e.g. 1130-03, 113001)', hExtra) : null}
            {node.code === '3100'
              ? renderLedgerExtrasDropdown("Owner's capital sub-accounts (3101–3199)", capExtra)
              : null}
            {['1999', '2999', '3999', '4900', '5900'].includes(node.code) && catchExtra.length
              ? renderLedgerExtrasDropdown(
                  node.code === '1999'
                    ? 'Other asset-range accounts (1000–1999)'
                    : node.code === '2999'
                      ? 'Other liability-range accounts (2000–2999)'
                      : node.code === '3999'
                        ? 'Other equity-range accounts & legacy codes'
                        : node.code === '4900'
                          ? 'Other revenue-range accounts (4000–4900)'
                          : 'Other expense-range accounts (5000–5900)',
                  catchExtra
                )
              : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:hidden">
              <span
                className="font-mono text-xs tabular-nums font-medium text-slate-700"
                title={rollupBalanceTitle || undefined}
              >
                {formatCurrency(rowBalance)}
              </span>
              {acctType ? (
                <span className={`text-[10px] font-medium capitalize ${typeBadgeClass(acctType)} rounded px-1.5 py-0`}>
                  {acctType}
                </span>
              ) : null}
            </div>
          </td>
          <td className="hidden px-4 py-3 align-middle sm:table-cell sm:px-5 sm:py-3.5">
            <span
              className={[
                'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize',
                typeBadgeClass(acctType),
              ].join(' ')}
            >
              {acctType || '—'}
            </span>
          </td>
          <td
            className="hidden px-4 py-3 text-right align-middle font-mono text-[12px] font-semibold tabular-nums text-slate-800 sm:table-cell sm:px-5 sm:py-3.5 md:text-[13px]"
            title={rollupBalanceTitle || undefined}
          >
            {formatCurrency(rowBalance)}
          </td>
          <td className="px-4 py-3 align-middle sm:px-5 sm:py-3.5">
            {!primary ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 sm:text-xs">
                <span className="hidden sm:inline">Not set up</span>
                <span className="sm:hidden">—</span>
              </span>
            ) : rowActive ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100 sm:text-xs">
                <CheckCircle size={12} strokeWidth={2.5} className="text-emerald-600" />
                <span className="hidden sm:inline">Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 sm:text-xs">
                <XCircle size={12} strokeWidth={2.5} />
                <span className="hidden sm:inline">Inactive</span>
              </span>
            )}
          </td>
          <td className="px-3 py-3 align-middle sm:px-5 sm:py-3.5">
            <div className="inline-flex items-center justify-end gap-0.5 rounded-xl border border-slate-200/80 bg-slate-50/90 p-0.5 shadow-sm sm:justify-start">
              <button
                type="button"
                onClick={() => primary && onViewAccount?.(primary)}
                disabled={!primary}
                className={`touch-manipulation rounded-md p-2.5 sm:p-2 ${!primary ? 'cursor-not-allowed text-slate-200' : 'text-slate-500 transition-colors hover:bg-white hover:text-slate-900'}`}
                title={primary ? 'View details' : 'No ledger row for this code yet'}
              >
                <Eye size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
              {showEdit ? (
                <button
                  type="button"
                  onClick={() => primary && !primary.isSystem && onEditAccount?.(primary)}
                  className={`touch-manipulation rounded-md p-2.5 transition-colors sm:p-2 ${
                    !primary || primary.isSystem
                      ? 'cursor-not-allowed text-slate-200'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                  title={!primary ? 'No ledger row' : primary.isSystem ? 'System account (read-only)' : 'Edit'}
                  disabled={!primary || primary.isSystem}
                >
                  <Edit size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => primary && onMergeAccount?.(primary)}
                disabled={!primary}
                className={`touch-manipulation rounded-md p-2.5 sm:p-2 ${!primary ? 'cursor-not-allowed text-slate-200' : 'text-slate-500 transition-colors hover:bg-white hover:text-violet-700'}`}
                title={
                  !primary
                    ? 'No ledger row'
                    : primary.isSystem
                      ? 'Merge this system account into another (same type/normal balance)'
                      : 'Merge into another account'
                }
              >
                <GitMerge size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
              {showDelete ? (
                <button
                  type="button"
                  onClick={() => primary && onDeleteAccount?.(primary.id)}
                  className={`touch-manipulation rounded-md p-2.5 transition-colors sm:p-2 ${!primary || isLocked ? 'cursor-not-allowed text-slate-200' : 'text-slate-500 hover:bg-white hover:text-rose-600'}`}
                  title={!primary ? 'No ledger row' : isLocked ? 'Account in use or system account' : 'Delete or deactivate'}
                  disabled={!primary || isLocked}
                >
                  <Trash2 size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
                </button>
              ) : null}
            </div>
          </td>
        </tr>
        {hasStructChildren && isExpanded && node.children.map((child) => renderStructureNodeRow(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_32px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]">
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-6 py-32">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400/15" />
            <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-600/20 ring-1 ring-white/10">
              <Loader2 size={32} className="animate-spin" strokeWidth={2} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Loading chart of accounts…</p>
        </div>
      ) : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {accounts.length === 0 ? (
            <div className="flex flex-col gap-3 border-b border-amber-200/80 bg-amber-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} />
                <div>
                  <p className="text-sm font-semibold text-amber-950">No ledger rows loaded yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                    The chart below always follows the standard SYSTEM structure. Sync or import to create accounts —
                    balances and actions will fill in as codes match.
                  </p>
                </div>
              </div>
              {emptyStateExtra ? (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{emptyStateExtra}</div>
              ) : null}
            </div>
          ) : null}
          {showExpandToolbar && accounts.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2 border-b border-slate-100/90 bg-slate-50/50 px-3 py-2 sm:px-4">
              <button type="button" onClick={handleExpandAll} className={coaBtnSecondary} title="Expand all rows">
                <ChevronsDownUp size={17} strokeWidth={2} />
                Expand all
              </button>
              <button type="button" onClick={handleCollapseToRoots} className={coaBtnSecondary} title="Collapse to main categories">
                <ChevronsUpDown size={17} strokeWidth={2} />
                Main only
              </button>
            </div>
          ) : null}
          <table className="w-full min-w-[280px] border-collapse text-left text-sm md:min-w-full">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-md">
                <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                  Code
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                  Account
                </th>
                <th className="sticky top-0 z-10 hidden whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-5">
                  Type
                </th>
                <th className="sticky top-0 z-10 hidden whitespace-nowrap px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-5">
                  Balance
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                  Status
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap px-3 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                  Actions
                </th>
              </tr>
            </thead>
            {SYSTEM_COA_STRUCTURE.map((root, idx) => (
              <tbody
                key={root.code}
                className={
                  idx === 0 ? '' : 'border-t-2 border-slate-100 bg-gradient-to-b from-slate-50/40 to-white'
                }
              >
                {renderStructureNodeRow(root, 0)}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
