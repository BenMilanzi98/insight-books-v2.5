/**
 * Load sold line items for a COGS expense register row (Invoice-COGS / Sale-COGS).
 * Prefers stocked (non-service) lines; falls back to all document lines.
 */

import { parseMoney, multiplyMoney } from '@/lib/money';
import {
  isCogsDocumentSourceType,
  resolveCogsLinkedSaleId,
} from '@/lib/cogsExpenseRegisterLink';

function mapSaleItem(item) {
  const qty = Number(item.quantity) || 0;
  const unitPrice = parseMoney(item.unitPrice);
  const amount = parseMoney(item.amount);
  const product = item.product;
  const isService = !!product?.isService || !!item.isCustom;
  let unitCost = parseMoney(product?.averageCost ?? product?.cost ?? 0);
  let cogsAmount = 0;
  const custom = item.customProductData;
  if (custom && typeof custom === 'object') {
    const fifo =
      custom.fifoCogs ??
      custom.cogsAmount ??
      custom.totalCogs ??
      custom.costOfGoods;
    if (fifo != null && parseMoney(fifo) > 0) {
      cogsAmount = parseMoney(fifo);
      if (qty > 0) unitCost = cogsAmount / qty;
    }
  }
  if (cogsAmount <= 0 && unitCost > 0 && qty > 0 && !isService) {
    cogsAmount = multiplyMoney(unitCost, qty);
  }
  return {
    id: item.id,
    description: item.description || product?.name || 'Item',
    productName: product?.name || null,
    sku: product?.sku || null,
    quantity: qty,
    unitPrice,
    amount,
    unitCost,
    cogsAmount,
    isService,
    isStocked: !isService && !!item.productId,
  };
}

function mapInvoiceItem(item) {
  const qty = Number(item.quantity) || 0;
  const unitPrice = parseMoney(item.unitPrice);
  const amount = parseMoney(item.amount ?? item.netAmount);
  const product = item.product;
  const isService = !!product?.isService;
  const unitCost = parseMoney(product?.averageCost ?? product?.cost ?? 0);
  const cogsAmount =
    !isService && unitCost > 0 && qty > 0 ? multiplyMoney(unitCost, qty) : 0;
  return {
    id: item.id,
    description: item.description || product?.name || 'Item',
    productName: product?.name || null,
    sku: product?.sku || null,
    quantity: qty,
    unitPrice,
    amount,
    unitCost,
    cogsAmount,
    isService,
    isStocked: !isService && !!item.productId,
  };
}

function preferStockedOrAll(items) {
  const stocked = items.filter((i) => i.isStocked);
  return stocked.length > 0 ? stocked : items;
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{ tenantId: string, sourceType?: string|null, sourceId?: string|null, linkedSaleId?: string|null }} params
 */
export async function loadCogsSourceSoldItems(db, { tenantId, sourceType, sourceId, linkedSaleId }) {
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const type = String(sourceType || '');
  const docId =
    linkedSaleId ||
    resolveCogsLinkedSaleId(sourceType, sourceId) ||
    (sourceId ? String(sourceId) : null);

  if (!docId) {
    return { found: false, reason: 'missing_document_id' };
  }

  // Prefer explicit source type; otherwise try invoice then sale.
  if (isCogsDocumentSourceType(type)) {
    if (type === 'Invoice-COGS' || type === 'Invoice') {
      return loadInvoiceSoldItems(db, tenantId, docId);
    }
    return loadSaleSoldItems(db, tenantId, docId);
  }

  const invoiceResult = await loadInvoiceSoldItems(db, tenantId, docId);
  if (invoiceResult.found) return invoiceResult;
  return loadSaleSoldItems(db, tenantId, docId);
}

async function loadInvoiceSoldItems(db, tenantId, invoiceId) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId, isDeleted: false },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      total: true,
      client: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          netAmount: true,
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              isService: true,
              cost: true,
              averageCost: true,
            },
          },
        },
      },
    },
  });
  if (!invoice) return { found: false, reason: 'invoice_not_found' };

  const mapped = (invoice.items || []).map(mapInvoiceItem);
  const items = preferStockedOrAll(mapped);
  return {
    found: true,
    documentType: 'invoice',
    documentId: invoice.id,
    documentNumber: invoice.invoiceNumber,
    documentStatus: invoice.status,
    documentDate: invoice.issueDate,
    documentTotal: parseMoney(invoice.total),
    counterparty: invoice.client?.name || null,
    itemsPreferredStocked: items.length !== mapped.length || items.every((i) => i.isStocked),
    items,
  };
}

async function loadSaleSoldItems(db, tenantId, saleId) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, tenantId },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      saleDate: true,
      total: true,
      client: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          productId: true,
          isCustom: true,
          customProductData: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              isService: true,
              cost: true,
              averageCost: true,
            },
          },
        },
      },
    },
  });
  if (!sale) return { found: false, reason: 'sale_not_found' };

  const mapped = (sale.items || []).map(mapSaleItem);
  const items = preferStockedOrAll(mapped);
  return {
    found: true,
    documentType: 'sale',
    documentId: sale.id,
    documentNumber: sale.saleNumber,
    documentStatus: sale.status,
    documentDate: sale.saleDate,
    documentTotal: parseMoney(sale.total),
    counterparty: sale.client?.name || null,
    itemsPreferredStocked: items.length !== mapped.length || items.every((i) => i.isStocked),
    items,
  };
}

/**
 * Virtual receipt/PDF link for a COGS register row (POS sale or invoice).
 * Points at existing document endpoints — no file is stored on ExpenseAttachment.
 *
 * @param {'invoice'|'sale'|string|null|undefined} documentType
 * @param {string|null|undefined} documentId
 * @param {string|null|undefined} documentNumber
 */
export function buildCogsVirtualReceiptAttachment(documentType, documentId, documentNumber) {
  if (!documentId) return null;
  const kind = String(documentType || '').toLowerCase();
  if (kind !== 'invoice' && kind !== 'sale') return null;

  const label = documentNumber ? String(documentNumber) : String(documentId);
  if (kind === 'invoice') {
    return {
      id: `virtual-invoice-${documentId}`,
      name: `Invoice ${label}.pdf`,
      type: 'application/pdf',
      size: 'PDF',
      url: `/api/invoices/${documentId}/download/pdf`,
      date: null,
      virtual: true,
      documentType: 'invoice',
      documentId,
    };
  }

  return {
    id: `virtual-sale-${documentId}`,
    name: `Sale receipt ${label}.pdf`,
    type: 'application/pdf',
    size: 'PDF',
    url: `/api/sales/${documentId}/receipt?format=pdf`,
    date: null,
    virtual: true,
    documentType: 'sale',
    documentId,
  };
}

/**
 * Batch-resolve human labels for COGS register rows (invoice/sale numbers).
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} tenantId
 * @param {Array<Record<string, unknown>>} rows
 */
export async function enrichCogsRegisterRowLabels(db, tenantId, rows) {
  if (!rows?.length) return rows;

  const invoiceIds = new Set();
  const saleIds = new Set();
  for (const row of rows) {
    if (!row?.isCOGS) continue;
    const id = row.linkedSaleId || resolveCogsLinkedSaleId(row.sourceType, row.sourceId);
    if (!id) continue;
    const type = String(row.sourceType || '');
    if (type === 'Invoice-COGS' || type === 'Invoice') invoiceIds.add(id);
    else if (type === 'Sale-COGS' || type === 'Sale') saleIds.add(id);
    else {
      invoiceIds.add(id);
      saleIds.add(id);
    }
  }

  const [invoices, sales] = await Promise.all([
    invoiceIds.size
      ? db.invoice.findMany({
          where: { tenantId, id: { in: [...invoiceIds] } },
          select: { id: true, invoiceNumber: true },
        })
      : [],
    saleIds.size
      ? db.sale.findMany({
          where: { tenantId, id: { in: [...saleIds] } },
          select: { id: true, saleNumber: true },
        })
      : [],
  ]);

  const invMap = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
  const saleMap = new Map(sales.map((s) => [s.id, s.saleNumber]));

  return rows.map((row) => {
    if (!row?.isCOGS) return row;
    const id = row.linkedSaleId || resolveCogsLinkedSaleId(row.sourceType, row.sourceId);
    if (!id) return row;
    const type = String(row.sourceType || '');
    let label = null;
    let documentType = null;
    if ((type === 'Invoice-COGS' || type === 'Invoice') && invMap.has(id)) {
      label = invMap.get(id);
      documentType = 'invoice';
    } else if ((type === 'Sale-COGS' || type === 'Sale') && saleMap.has(id)) {
      label = saleMap.get(id);
      documentType = 'sale';
    } else if (invMap.has(id)) {
      label = invMap.get(id);
      documentType = 'invoice';
    } else if (saleMap.has(id)) {
      label = saleMap.get(id);
      documentType = 'sale';
    }
    if (!label) return { ...row, documentType: row.documentType || null };
    const kind = documentType === 'invoice' ? 'Invoice' : 'Sale';
    const isCredit = parseMoney(row.amount) < 0;
    const description = isCredit
      ? `COGS credit — ${kind} ${label}`
      : `COGS — ${kind} ${label}`;
    const virtualReceipt = buildCogsVirtualReceiptAttachment(documentType, id, label);
    return {
      ...row,
      description,
      documentNumber: label,
      documentType,
      displayTitle: description,
      attachments: virtualReceipt ? [virtualReceipt] : row.attachments || [],
    };
  });
}
