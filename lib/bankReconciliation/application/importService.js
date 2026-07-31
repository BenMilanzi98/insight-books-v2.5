/**
 * Statement import — security, parse, idempotency, duplicates, balance validation.
 */

import { assertSafeStatementFile } from '../infrastructure/fileSecurity.js';
import { parseStatementBuffer } from '../infrastructure/parsers/index.js';
import { ImportBatchStatus } from '../domain/enums.js';
import { toSignedMinor, fromSignedMinor } from '../domain/signedAmount.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { getPaymentAccountForRecon, assertReconcilablePaymentAccount, getConfiguration } from './configService.js';

async function loadProfileOptions(db, tenantId, profileId, fallback = {}) {
  if (!profileId) return fallback;
  const profile = await db.bankRecStatementProfile.findFirst({
    where: { id: profileId, tenantId, status: 'ACTIVE' },
  });
  if (!profile) return fallback;
  return {
    format: profile.format,
    columnMap: profile.columnMap || {},
    ...(profile.options || {}),
    ...fallback,
  };
}

/**
 * Preview import without persisting statement rows (creates PENDING/PREVIEWED batch).
 */
export async function previewImport(db, context, input) {
  const { paymentAccountId, fileName, buffer, mimeType, profileId, statementOpening, statementClosing } = input;
  const pa = await getPaymentAccountForRecon(db, context.businessId, paymentAccountId);
  assertReconcilablePaymentAccount(pa);

  const meta = assertSafeStatementFile({ buffer, fileName, mimeType });
  const existing = await db.bankRecImportBatch.findUnique({
    where: {
      tenantId_paymentAccountId_fileHash: {
        tenantId: context.businessId,
        paymentAccountId: pa.id,
        fileHash: meta.fileHash,
      },
    },
  });
  if (existing && existing.status === ImportBatchStatus.CONFIRMED) {
    throw new AccountingValidationError('This statement file was already imported for this account.', [
      { path: 'fileHash', message: 'duplicate', batchId: existing.id },
    ]);
  }

  const cfg = await getConfiguration(db, context.businessId, pa.id);
  const profileOptions = await loadProfileOptions(db, context.businessId, profileId || cfg?.defaultProfileId, {
    currency: cfg?.currency || 'MWK',
  });

  let parsed;
  try {
    parsed = parseStatementBuffer(buffer, fileName, profileOptions);
  } catch (err) {
    const batch = await upsertBatch(db, {
      existing,
      tenantId: context.businessId,
      paymentAccountId: pa.id,
      profileId: profileId || null,
      fileName,
      meta,
      status: ImportBatchStatus.FAILED,
      errorSummary: err.message,
      userId: context.userId,
    });
    throw Object.assign(err, { batchId: batch.id });
  }

  const balanceCheck = validateStatementBalances({
    rows: parsed.rows,
    statementOpening: statementOpening ?? parsed.statementOpening,
    statementClosing: statementClosing ?? parsed.statementClosing,
  });

  const fingerprints = parsed.rows.map((r) => r.rowFingerprint);
  const prior = fingerprints.length
    ? await db.bankRecStatementTransaction.findMany({
        where: {
          tenantId: context.businessId,
          paymentAccountId: pa.id,
          rowFingerprint: { in: fingerprints },
        },
        select: { rowFingerprint: true },
      })
    : [];
  const priorSet = new Set(prior.map((p) => p.rowFingerprint));
  const duplicateRowCount = parsed.rows.filter((r) => priorSet.has(r.rowFingerprint)).length;

  const batch = await upsertBatch(db, {
    existing,
    tenantId: context.businessId,
    paymentAccountId: pa.id,
    profileId: profileId || null,
    fileName,
    meta,
    status: ImportBatchStatus.PREVIEWED,
    rowCount: parsed.rows.length,
    duplicateRowCount,
    statementOpening: balanceCheck.opening,
    statementClosing: balanceCheck.closing,
    periodStart: minDate(parsed.rows),
    periodEnd: maxDate(parsed.rows),
    balanceValid: balanceCheck.valid,
    parseWarnings: [...(parsed.warnings || []), ...balanceCheck.warnings],
    userId: context.userId,
  });

  return {
    batch,
    previewRows: parsed.rows.slice(0, 100),
    totalRows: parsed.rows.length,
    duplicateRowCount,
    balanceCheck,
    parsedRows: parsed.rows,
  };
}

/**
 * Confirm a previewed import — persist statement transactions.
 * `parsedRows` may be re-supplied from preview or re-parsed from buffer.
 */
export async function confirmImport(db, context, input) {
  const { batchId, buffer, fileName, mimeType, reconciliationId } = input;
  const batch = await db.bankRecImportBatch.findFirst({
    where: { id: batchId, tenantId: context.businessId },
  });
  if (!batch) {
    throw new AccountingValidationError('Import batch not found.', [{ path: 'batchId', message: 'not found' }]);
  }
  if (batch.status === ImportBatchStatus.CONFIRMED) {
    return { batch, created: 0, skippedDuplicates: 0 };
  }

  let rows = input.parsedRows;
  if (!rows) {
    if (!buffer) {
      throw new AccountingValidationError('Buffer required to confirm import without preview rows.', [
        { path: 'buffer', message: 'required' },
      ]);
    }
    assertSafeStatementFile({ buffer, fileName: fileName || batch.fileName, mimeType });
    const cfg = await getConfiguration(db, context.businessId, batch.paymentAccountId);
    const profileOptions = await loadProfileOptions(db, context.businessId, batch.profileId || cfg?.defaultProfileId, {
      currency: cfg?.currency || 'MWK',
    });
    rows = parseStatementBuffer(buffer, fileName || batch.fileName, profileOptions).rows;
  }

  const existingFp = await db.bankRecStatementTransaction.findMany({
    where: {
      tenantId: context.businessId,
      paymentAccountId: batch.paymentAccountId,
      rowFingerprint: { in: rows.map((r) => r.rowFingerprint) },
    },
    select: { rowFingerprint: true },
  });
  const skip = new Set(existingFp.map((e) => e.rowFingerprint));
  const toCreate = rows.filter((r) => !skip.has(r.rowFingerprint));

  if (toCreate.length) {
    await db.bankRecStatementTransaction.createMany({
      data: toCreate.map((r) => ({
        tenantId: context.businessId,
        importBatchId: batch.id,
        paymentAccountId: batch.paymentAccountId,
        reconciliationId: reconciliationId || batch.reconciliationId || null,
        lineNumber: r.lineNumber,
        transactionDate: r.transactionDate,
        valueDate: r.valueDate,
        description: r.description,
        reference: r.reference,
        referenceNormalized: r.referenceNormalized,
        payee: r.payee,
        signedAmountMinor: r.signedAmountMinor,
        signedAmount: r.signedAmount,
        runningBalance: r.runningBalance,
        currency: r.currency || 'MWK',
        rowFingerprint: r.rowFingerprint,
        remainingAmountMinor: r.signedAmountMinor,
        rawPayload: r.rawPayload,
      })),
    });
  }

  const updated = await db.bankRecImportBatch.update({
    where: { id: batch.id },
    data: {
      status: ImportBatchStatus.CONFIRMED,
      rowCount: rows.length,
      duplicateRowCount: skip.size,
      confirmedAt: new Date(),
      confirmedBy: context.userId ?? null,
      reconciliationId: reconciliationId || batch.reconciliationId || null,
    },
  });

  return { batch: updated, created: toCreate.length, skippedDuplicates: skip.size };
}

function validateStatementBalances({ rows, statementOpening, statementClosing }) {
  const warnings = [];
  const opening = statementOpening != null && statementOpening !== '' ? fromSignedMinor(toSignedMinor(statementOpening)) : null;
  let closing =
    statementClosing != null && statementClosing !== '' ? fromSignedMinor(toSignedMinor(statementClosing)) : null;

  if (closing == null && rows.length) {
    const lastBal = rows[rows.length - 1].runningBalance;
    if (lastBal != null) closing = String(lastBal);
  }

  let valid = true;
  if (opening != null && closing != null) {
    const net = rows.reduce((s, r) => s + r.signedAmountMinor, 0);
    const expected = toSignedMinor(opening) + net;
    const actual = toSignedMinor(closing);
    if (expected !== actual) {
      valid = false;
      warnings.push(
        `Balance validation failed: opening(${opening}) + net movements ≠ closing(${closing}). expectedMinor=${expected} actualMinor=${actual}`
      );
    }
  } else {
    warnings.push('Statement opening/closing not fully provided; balance validation skipped.');
  }

  return { valid, opening, closing, warnings };
}

async function upsertBatch(db, opts) {
  const data = {
    tenantId: opts.tenantId,
    paymentAccountId: opts.paymentAccountId,
    profileId: opts.profileId,
    fileName: opts.fileName,
    fileHash: opts.meta.fileHash,
    mimeType: opts.meta.mimeType,
    byteSize: opts.meta.byteSize,
    status: opts.status,
    rowCount: opts.rowCount ?? 0,
    duplicateRowCount: opts.duplicateRowCount ?? 0,
    statementOpening: opts.statementOpening,
    statementClosing: opts.statementClosing,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    balanceValid: opts.balanceValid,
    errorSummary: opts.errorSummary ?? null,
    parseWarnings: opts.parseWarnings ?? undefined,
    createdBy: opts.userId ?? null,
  };
  if (opts.existing) {
    return db.bankRecImportBatch.update({ where: { id: opts.existing.id }, data });
  }
  return db.bankRecImportBatch.create({ data });
}

function minDate(rows) {
  if (!rows.length) return null;
  return rows.reduce((m, r) => (r.transactionDate < m ? r.transactionDate : m), rows[0].transactionDate);
}
function maxDate(rows) {
  if (!rows.length) return null;
  return rows.reduce((m, r) => (r.transactionDate > m ? r.transactionDate : m), rows[0].transactionDate);
}

export { validateStatementBalances };
