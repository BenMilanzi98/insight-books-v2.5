/**
 * Resolve raw database IDs to human-readable labels for finance UI and exports.
 */
import { getPaymentMethodName as legacyPaymentMethodName } from '@/lib/paymentMethods';

const LEGACY_METHOD_KEYS = new Set([
  'cash',
  'bank_transfer',
  'mobile_money',
  'check',
  'credit_card',
  'airtel_money',
  'mpamba',
  'paychangu',
  'stock in',
  'stock_in',
  'stock out',
  'stock_out',
]);

export function looksLikeRecordId(value) {
  return typeof value === 'string' && value.length > 20 && /^[a-z0-9]+$/i.test(value);
}

export function humanizeSourceType(sourceType) {
  if (!sourceType) return 'Manual';
  return String(sourceType)
    .replace(/^Tax-/i, 'Tax ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * @param {string|null|undefined} paymentMethod
 * @param {Map<string, { name: string, accountType?: string }>} [paymentAccountById]
 */
export function resolvePaymentMethodLabel(paymentMethod, paymentAccountById = new Map()) {
  if (paymentMethod == null || paymentMethod === '') return '—';

  const raw = String(paymentMethod).trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');

  const account = paymentAccountById.get(raw);
  if (account?.name) {
    return account.accountType
      ? `${account.name} (${account.accountType})`
      : account.name;
  }

  if (LEGACY_METHOD_KEYS.has(key) || LEGACY_METHOD_KEYS.has(raw.toLowerCase())) {
    const legacy = legacyPaymentMethodName(key);
    if (legacy && legacy !== '-') return legacy;
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (looksLikeRecordId(raw)) return 'Unknown method';
  return raw;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string[]} methodIds
 */
export async function buildPaymentAccountMap(prisma, tenantId, methodIds) {
  const ids = [...new Set((methodIds || []).filter(looksLikeRecordId))];
  if (!ids.length) return new Map();

  const accounts = await prisma.paymentAccount.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, name: true, accountType: true },
  });
  return new Map(accounts.map((a) => [a.id, a]));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {Array<{ paymentMethod?: string|null }>} payments
 */
export async function enrichPaymentsWithMethodNames(prisma, tenantId, payments) {
  const map = await buildPaymentAccountMap(
    prisma,
    tenantId,
    payments.map((p) => p.paymentMethod)
  );
  return payments.map((p) => ({
    ...p,
    paymentMethodName: resolvePaymentMethodLabel(p.paymentMethod, map),
  }));
}

/**
 * Batch-resolve source document labels for ledger rows.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {Array<{ sourceType?: string|null, sourceId?: string|null }>} items
 * @returns {Promise<Map<string, string>>} key `${sourceType}::${sourceId}`
 */
export async function resolveSourceDocumentLabelsBatch(prisma, tenantId, items) {
  const map = new Map();
  const byType = new Map();

  for (const item of items || []) {
    const sourceType = item?.sourceType;
    const sourceId = item?.sourceId;
    if (!sourceType || !sourceId) continue;
    const key = `${sourceType}::${sourceId}`;
    if (map.has(key)) continue;
    if (!byType.has(sourceType)) byType.set(sourceType, new Set());
    byType.get(sourceType).add(String(sourceId));
  }

  const load = async (type, ids, resolver) => {
    const idList = [...ids];
    if (!idList.length) return;
    const rows = await resolver(idList);
    for (const row of rows) {
      const key = `${type}::${row.id}`;
      if (row.label) map.set(key, row.label);
    }
  };

  const tenantWhere = { tenantId };

  await Promise.all([
    load('Invoice', byType.get('Invoice'), async (ids) => {
      const rows = await prisma.invoice.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, invoiceNumber: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : 'Invoice',
      }));
    }),
    load('Sale', byType.get('Sale'), async (ids) => {
      const rows = await prisma.sale.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, saleNumber: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.saleNumber ? `Sale ${r.saleNumber}` : 'Sale',
      }));
    }),
    load('Expense', byType.get('Expense'), async (ids) => {
      const rows = await prisma.expense.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, description: true, merchant: true, originalReference: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label:
          r.description ||
          r.merchant ||
          (r.originalReference ? String(r.originalReference).slice(0, 80) : 'Expense'),
      }));
    }),
    load('InvoicePayment', byType.get('InvoicePayment'), async (ids) => {
      const rows = await prisma.invoice.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, invoiceNumber: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.invoiceNumber ? `Invoice payment — ${r.invoiceNumber}` : 'Invoice payment',
      }));
    }),
    load('GoodsReceipt', byType.get('GoodsReceipt'), async (ids) => {
      const rows = await prisma.goodsReceipt.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, receiptNumber: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.receiptNumber ? `Goods receipt ${r.receiptNumber}` : 'Goods receipt',
      }));
    }),
    load('SupplierBill', byType.get('SupplierBill'), async (ids) => {
      const rows = await prisma.supplierBill.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, billNumber: true },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.billNumber ? `Supplier bill ${r.billNumber}` : 'Supplier bill',
      }));
    }),
    load('Payroll', byType.get('Payroll'), async (ids) => {
      const rows = await prisma.payroll.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        include: { employee: { select: { name: true } } },
      });
      return rows.map((r) => {
        const period =
          r.periodStart && r.periodEnd
            ? `${new Date(r.periodStart).toLocaleDateString()} – ${new Date(r.periodEnd).toLocaleDateString()}`
            : '';
        const name = r.employee?.name || 'Employee';
        return { id: r.id, label: period ? `Payroll — ${name} (${period})` : `Payroll — ${name}` };
      });
    }),
    load('Payment', byType.get('Payment'), async (ids) => {
      const rows = await prisma.payment.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, reference: true, invoice: { select: { invoiceNumber: true } } },
      });
      return rows.map((r) => ({
        id: r.id,
        label:
          r.reference ||
          (r.invoice?.invoiceNumber ? `Payment — Invoice ${r.invoice.invoiceNumber}` : 'Payment'),
      }));
    }),
    load('ExpensePayment', byType.get('ExpensePayment'), async (ids) => {
      const rows = await prisma.payment.findMany({
        where: { ...tenantWhere, id: { in: ids } },
        select: { id: true, reference: true, expense: { select: { description: true } } },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.reference || r.expense?.description || 'Expense payment',
      }));
    }),
  ]);

  // Tax-* and other prefixed types: use humanized type without raw id when not resolved
  for (const [type, ids] of byType.entries()) {
    for (const id of ids) {
      const key = `${type}::${id}`;
      if (!map.has(key)) {
        map.set(key, humanizeSourceType(type));
      }
    }
  }

  return map;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string[]} reversedTransactionIds
 * @returns {Promise<Map<string, string>>}
 */
export async function resolveReversedEntryLabelsBatch(prisma, tenantId, reversedTransactionIds) {
  const map = new Map();
  const ids = [...new Set((reversedTransactionIds || []).filter(Boolean))];
  if (!ids.length) return map;

  const [transactions, journals] = await Promise.all([
    prisma.transaction.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, reference: true, description: true },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, referenceNumber: true, description: true },
    }),
  ]);

  for (const t of transactions) {
    map.set(t.id, t.reference || t.description || 'Original entry');
  }
  for (const j of journals) {
    if (!map.has(j.id)) {
      map.set(j.id, j.referenceNumber || j.description || 'Original journal');
    }
  }

  for (const id of ids) {
    if (!map.has(id)) map.set(id, 'Original entry');
  }
  return map;
}

export function getSourceDocumentLabel(sourceLabelsMap, sourceType, sourceId, fallbackReference = '') {
  if (!sourceType && !sourceId) return fallbackReference || '—';
  if (sourceType && sourceId) {
    const key = `${sourceType}::${sourceId}`;
    const label = sourceLabelsMap?.get(key);
    if (label) return label;
  }
  if (fallbackReference) return fallbackReference;
  if (sourceType) return humanizeSourceType(sourceType);
  return '—';
}

export function getEntryDisplayLabel(entry) {
  if (!entry) return '—';
  if (entry.reference) return entry.reference;
  if (entry.entryType === 'JournalEntry') return entry.reference || 'Journal entry';
  return entry.description || humanizeSourceType(entry.sourceType) || 'Ledger entry';
}
