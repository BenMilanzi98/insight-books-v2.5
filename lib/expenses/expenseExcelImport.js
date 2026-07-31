/**
 * Expense xlsx import — parse + dry-run (no DB writes in dry-run).
 * Modes: NEW_EXPENSE_IMPORT | DRAFT_ONLY_IMPORT | RECONCILE_EXISTING
 */

import prisma from '@/lib/prisma';
import { EXPENSE_STATUSES } from './expenseStateMachine.js';

export const IMPORT_MODES = Object.freeze({
  NEW_EXPENSE_IMPORT: 'NEW_EXPENSE_IMPORT',
  DRAFT_ONLY_IMPORT: 'DRAFT_ONLY_IMPORT',
  RECONCILE_EXISTING: 'RECONCILE_EXISTING',
});

function sheetToObjects(worksheet) {
  const rows = [];
  let headers = [];
  worksheet.eachRow((row, rowNumber) => {
    const values = row.values;
    // exceljs row.values is 1-indexed
    const cells = Array.isArray(values) ? values.slice(1) : [];
    if (rowNumber === 1) {
      headers = cells.map((c) => String(c ?? '').trim());
      return;
    }
    if (!headers.length) return;
    const obj = {};
    let empty = true;
    headers.forEach((h, i) => {
      if (!h) return;
      let v = cells[i];
      if (v != null && typeof v === 'object' && 'text' in v) v = v.text;
      if (v != null && typeof v === 'object' && 'result' in v) v = v.result;
      if (v instanceof Date) {
        obj[h] = v.toISOString().slice(0, 10);
        empty = false;
        return;
      }
      if (v != null && String(v).trim() !== '') empty = false;
      obj[h] = v == null ? '' : String(v).trim();
    });
    if (!empty) rows.push({ rowNumber, ...obj });
  });
  return rows;
}

function manifestToMap(rows) {
  const map = {};
  for (const r of rows) {
    const key = r.Key || r.key;
    const value = r.Value ?? r.value;
    if (key) map[String(key).trim()] = value == null ? '' : String(value).trim();
  }
  return map;
}

/**
 * Parse an xlsx buffer into named sheet row arrays.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 */
export async function parseWorkbookBuffer(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = {
    manifest: [],
    expenses: [],
    expenseLines: [],
    payments: [],
  };

  for (const ws of workbook.worksheets) {
    const name = String(ws.name || '').trim().toLowerCase();
    const rows = sheetToObjects(ws);
    if (name === 'export manifest' || name === 'manifest') {
      sheets.manifest = rows;
    } else if (name === 'expenses') {
      sheets.expenses = rows;
    } else if (name === 'expense lines' || name === 'expenselines') {
      sheets.expenseLines = rows;
    } else if (name === 'payments') {
      sheets.payments = rows;
    }
  }

  return sheets;
}

async function resolveAccountByCode(db, tenantId, accountCode) {
  const code = String(accountCode || '').trim();
  if (!code) return null;
  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ accountCode: code }, { code }],
    },
    select: { id: true, accountCode: true, code: true, accountName: true, name: true },
  });
}

function detectMode(manifest, options = {}) {
  if (options.mode && IMPORT_MODES[options.mode]) return options.mode;
  const hinted = String(manifest.importMode || manifest.mode || '').trim();
  if (IMPORT_MODES[hinted]) return hinted;
  // Default: new expenses as drafts
  return IMPORT_MODES.DRAFT_ONLY_IMPORT;
}

function num(value) {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Dry-run expense import — never writes to DB.
 *
 * @returns {Promise<{ mode, creates, links, skips, errors, duplicates, manifest }>}
 */
export async function dryRunExpenseImport({
  tenantId,
  sheets,
  db = prisma,
  mode: requestedMode,
}) {
  const manifest = manifestToMap(sheets.manifest || []);
  const mode = detectMode(manifest, { mode: requestedMode });

  const creates = [];
  const links = [];
  const skips = [];
  const errors = [];
  const duplicates = [];

  const manifestTenant = String(manifest.tenantId || '').trim();
  if (manifestTenant && manifestTenant !== String(tenantId)) {
    errors.push({
      code: 'CROSS_TENANT_MANIFEST',
      message: `Export Manifest tenantId "${manifestTenant}" does not match session tenant`,
      rowNumber: 0,
    });
    return { mode, creates, links, skips, errors, duplicates, manifest };
  }

  const expenseRows = sheets.expenses || [];
  if (!expenseRows.length) {
    errors.push({ code: 'NO_EXPENSE_ROWS', message: 'Expenses sheet is empty', rowNumber: 0 });
    return { mode, creates, links, skips, errors, duplicates, manifest };
  }

  // Prefetch existing by originalReference / id for reconcile + duplicate detection
  const refs = expenseRows
    .map((r) => r.originalReference || r.externalRef || r.expenseId)
    .filter(Boolean)
    .map(String);
  const existing = refs.length
    ? await db.expense.findMany({
        where: {
          tenantId,
          isDeleted: false,
          OR: [
            { id: { in: refs } },
            { originalReference: { in: refs } },
          ],
        },
        select: {
          id: true,
          originalReference: true,
          amount: true,
          status: true,
          paymentStatus: true,
          expenseAccountId: true,
        },
      })
    : [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  const byRef = new Map(
    existing.filter((e) => e.originalReference).map((e) => [e.originalReference, e])
  );

  for (const row of expenseRows) {
    const rowNumber = row.rowNumber;
    const accountCode = row.accountCode || row.AccountCode;
    const amount = num(row.amount);
    const taxAmount = num(row.taxAmount || 0);
    const description = row.description || row.Description || '';
    const date = row.date || row.Date;
    const externalRef = row.externalRef || row.originalReference || '';
    const expenseId = row.expenseId || '';

    if (!description) {
      errors.push({ code: 'MISSING_DESCRIPTION', message: 'description is required', rowNumber });
      continue;
    }
    if (!date) {
      errors.push({ code: 'MISSING_DATE', message: 'date is required', rowNumber });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ code: 'INVALID_AMOUNT', message: 'amount must be a positive number', rowNumber });
      continue;
    }
    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      errors.push({ code: 'INVALID_TAX', message: 'taxAmount must be >= 0', rowNumber });
      continue;
    }

    const account = accountCode
      ? await resolveAccountByCode(db, tenantId, accountCode)
      : null;
    if (accountCode && !account) {
      errors.push({
        code: 'ACCOUNT_NOT_FOUND',
        message: `Account code "${accountCode}" not found for tenant (accounts are never auto-created)`,
        rowNumber,
      });
      continue;
    }

    const match =
      (expenseId && byId.get(expenseId)) ||
      (externalRef && byRef.get(externalRef)) ||
      null;

    if (mode === IMPORT_MODES.RECONCILE_EXISTING) {
      if (match) {
        links.push({
          rowNumber,
          expenseId: match.id,
          externalRef,
          accountId: account?.id ?? match.expenseAccountId,
          action: 'link',
        });
      } else {
        skips.push({
          rowNumber,
          reason: 'NO_EXISTING_MATCH',
          externalRef,
          expenseId,
        });
      }
      continue;
    }

    if (match) {
      duplicates.push({
        rowNumber,
        existingExpenseId: match.id,
        externalRef,
        expenseId,
      });
      skips.push({
        rowNumber,
        reason: 'DUPLICATE_EXISTING',
        existingExpenseId: match.id,
      });
      continue;
    }

    // NEW_EXPENSE_IMPORT and DRAFT_ONLY_IMPORT both create as Draft (no auto-post)
    creates.push({
      rowNumber,
      description,
      date,
      category: row.category || 'General',
      amount,
      taxAmount,
      taxRate: num(row.taxRate || 0) || 0,
      expenseAccountId: account?.id ?? null,
      accountCode: accountCode || null,
      paymentMethod: row.paymentMethod || null,
      paymentStatus: row.paymentStatus || EXPENSE_STATUSES.PENDING,
      merchant: row.merchant || null,
      supplierId: row.supplierId || null,
      branchId: row.branchId || null,
      originalReference: externalRef || null,
      notes: row.notes || null,
      status: EXPENSE_STATUSES.DRAFT,
      mode,
    });
  }

  return { mode, creates, links, skips, errors, duplicates, manifest };
}

/**
 * Execute import for NEW_EXPENSE_IMPORT / DRAFT_ONLY_IMPORT only (creates Draft rows).
 * RECONCILE_EXISTING is detect-only and never writes.
 */
export async function executeExpenseImport({
  tenantId,
  userId,
  sheets,
  db = prisma,
  mode: requestedMode,
}) {
  const dry = await dryRunExpenseImport({ tenantId, sheets, db, mode: requestedMode });
  if (dry.errors.some((e) => e.code === 'CROSS_TENANT_MANIFEST')) {
    const err = new Error(dry.errors[0].message);
    err.code = 'CROSS_TENANT_MANIFEST';
    err.dryRun = dry;
    throw err;
  }
  if (dry.mode === IMPORT_MODES.RECONCILE_EXISTING) {
    const err = new Error('RECONCILE_EXISTING is detect-only and cannot execute writes');
    err.code = 'RECONCILE_EXECUTE_FORBIDDEN';
    err.dryRun = dry;
    throw err;
  }

  const created = [];
  for (const row of dry.creates) {
    if (!row.expenseAccountId) {
      dry.errors.push({
        code: 'ACCOUNT_REQUIRED_ON_EXECUTE',
        message: 'expenseAccountId/accountCode required to create expense',
        rowNumber: row.rowNumber,
      });
      continue;
    }
    const expense = await db.expense.create({
      data: {
        tenantId,
        submittedById: userId,
        description: row.description,
        date: new Date(row.date),
        category: row.category,
        amount: row.amount,
        taxAmount: row.taxAmount,
        taxRate: row.taxRate,
        expenseAccountId: row.expenseAccountId,
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus || EXPENSE_STATUSES.PENDING,
        paidAmount: 0,
        merchant: row.merchant,
        supplierId: row.supplierId || null,
        branchId: row.branchId || null,
        originalReference: row.originalReference,
        notes: row.notes,
        status: EXPENSE_STATUSES.DRAFT,
        isDeleted: false,
      },
    });
    created.push({ rowNumber: row.rowNumber, expenseId: expense.id });
  }

  return { ...dry, created, executed: true };
}
