/**
 * Bulk POS sale receipt export helpers — date ranges, Prisma load, tax data.
 */

export const MAX_RECEIPTS_PER_EXPORT = 5000;
export const RECEIPT_EXPORT_BATCH_SIZE = 50;

/** Statuses excluded from receipt archives (case variants for DB compatibility) */
const EXCLUDED_SALE_STATUSES = [
  'voided',
  'Voided',
  'VOIDED',
  'void',
  'Void',
  'VOID',
  'cancelled',
  'Cancelled',
  'CANCELLED',
  'canceled',
  'Canceled',
  'CANCELED',
];

export const saleReceiptInclude = {
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      itemTaxes: {
        select: {
          id: true,
          saleItemId: true,
          taxName: true,
          taxCode: true,
          taxRate: true,
          taxAmount: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  },
  /** Used to rebuild line items when SaleItem rows were deleted but COGS rows remain */
  inventoryBatchConsumptions: {
    include: {
      batch: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
    },
  },
  payments: {
    include: {
      allocations: {
        include: {
          paymentAccount: {
            select: {
              id: true,
              name: true,
              accountType: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
};

function toNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * When SaleItem rows are missing (legacy cleanup / orphaned COGS), rebuild printable lines
 * from inventory consumptions or a single totals fallback so receipts are never blank.
 *
 * @param {object} sale — may include inventoryBatchConsumptions
 * @returns {object[]}
 */
export function ensureSaleLineItemsForReceipt(sale) {
  const existing = Array.isArray(sale?.items) ? sale.items : [];
  if (existing.length > 0) return existing;

  const subtotal = toNumber(sale?.subtotal, toNumber(sale?.total, 0));
  const consumptions = Array.isArray(sale?.inventoryBatchConsumptions)
    ? sale.inventoryBatchConsumptions
    : [];

  if (consumptions.length > 0) {
    /** @type {Map<string, { description: string, quantity: number, productId: string|null }>} */
    const byKey = new Map();
    for (const c of consumptions) {
      const product = c.batch?.product;
      const key = product?.id || c.saleItemId || c.id;
      const description =
        product?.name ||
        (product?.sku ? `SKU ${product.sku}` : null) ||
        'Sold item';
      const qty = toNumber(c.quantity, 0);
      const prev = byKey.get(key);
      if (prev) {
        prev.quantity += qty;
      } else {
        byKey.set(key, {
          description,
          quantity: qty,
          productId: product?.id || null,
        });
      }
    }

    const groups = [...byKey.values()].filter((g) => g.quantity > 0);
    const totalQty = groups.reduce((s, g) => s + g.quantity, 0);
    if (groups.length > 0 && totalQty > 0 && subtotal > 0) {
      let allocated = 0;
      return groups.map((g, idx) => {
        const isLast = idx === groups.length - 1;
        const amount = isLast
          ? Math.round((subtotal - allocated) * 100) / 100
          : Math.round(((subtotal * g.quantity) / totalQty) * 100) / 100;
        allocated += amount;
        const unitPrice = Math.round((amount / g.quantity) * 100) / 100;
        return {
          id: `reconstructed-${idx}`,
          description: g.description,
          quantity: g.quantity,
          unitPrice,
          amount,
          discountAmount: 0,
          taxAmount: 0,
          itemTaxes: [],
          product: g.productId ? { id: g.productId, name: g.description } : null,
          _reconstructed: true,
        };
      });
    }

    if (groups.length > 0) {
      return groups.map((g, idx) => ({
        id: `reconstructed-${idx}`,
        description: g.description,
        quantity: g.quantity,
        unitPrice: 0,
        amount: 0,
        discountAmount: 0,
        taxAmount: 0,
        itemTaxes: [],
        _reconstructed: true,
      }));
    }
  }

  const label =
    (sale?.title && String(sale.title).trim()) ||
    (sale?.notes && String(sale.notes).trim()) ||
    'Sale';

  return [
    {
      id: 'reconstructed-total',
      description: label,
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal,
      discountAmount: 0,
      taxAmount: toNumber(sale?.totalTaxAmount, 0),
      itemTaxes: [],
      _reconstructed: true,
    },
  ];
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d) {
  const x = startOfLocalDay(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}

/**
 * Resolve preset / custom date bounds (local calendar).
 * @param {{ preset?: string, dateFrom?: string|null, dateTo?: string|null, now?: Date }} args
 * @returns {{ dateFrom: Date, dateTo: Date, preset: string }}
 */
export function resolveReceiptDateRange({
  preset = 'custom',
  dateFrom = null,
  dateTo = null,
  now = new Date(),
} = {}) {
  const p = String(preset || 'custom').toLowerCase();
  const ref = now instanceof Date ? now : new Date(now);

  if (p === 'this_week') {
    const from = startOfWeekMonday(ref);
    const to = endOfLocalDay(ref);
    return { dateFrom: from, dateTo: to, preset: 'this_week' };
  }

  if (p === 'this_month') {
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const to = endOfLocalDay(ref);
    return { dateFrom: from, dateTo: to, preset: 'this_month' };
  }

  if (p === 'this_year') {
    const from = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = endOfLocalDay(ref);
    return { dateFrom: from, dateTo: to, preset: 'this_year' };
  }

  // custom — missing bounds default to all history through end of today
  let from;
  let to;
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid dateFrom.');
    from = startOfLocalDay(d);
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid dateTo.');
    to = endOfLocalDay(d);
  }
  if (!from && !to) {
    from = new Date(2000, 0, 1, 0, 0, 0, 0);
    to = endOfLocalDay(ref);
  } else {
    if (from && !to) to = endOfLocalDay(ref);
    if (to && !from) from = new Date(2000, 0, 1, 0, 0, 0, 0);
  }
  if (from > to) throw new Error('dateFrom must be on or before dateTo.');
  return { dateFrom: from, dateTo: to, preset: 'custom' };
}

/**
 * @param {string} tenantId
 * @param {{ dateFrom: Date, dateTo: Date, branchId?: string|null }} filters
 */
export function buildReceiptExportWhere(tenantId, filters) {
  const where = {
    tenantId,
    isReversal: false,
    saleDate: {
      gte: filters.dateFrom,
      lte: filters.dateTo,
    },
    status: { notIn: EXCLUDED_SALE_STATUSES },
  };
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  return where;
}

/**
 * Normalize Decimal fields and ensure printable line items for PDF drawing.
 * @param {object} sale
 */
export function normalizeSaleForReceiptPdf(sale) {
  const num = (v) => {
    if (v == null || v === '') return v;
    if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  };

  const withItems = {
    ...sale,
    items: ensureSaleLineItemsForReceipt(sale),
  };

  const items = (withItems.items || []).map((item) => ({
    ...item,
    amount: num(item.amount) ?? 0,
    unitPrice: num(item.unitPrice) ?? 0,
    discountAmount: num(item.discountAmount) ?? 0,
    taxAmount: num(item.taxAmount) ?? 0,
    quantity: num(item.quantity) ?? 1,
    itemTaxes: (item.itemTaxes || []).map((t) => ({
      ...t,
      taxRate: num(t.taxRate) ?? 0,
      taxAmount: num(t.taxAmount) ?? 0,
    })),
  }));

  return {
    ...withItems,
    items,
    subtotal: num(sale.subtotal) ?? 0,
    total: num(sale.total) ?? 0,
    totalTaxAmount: num(sale.totalTaxAmount) ?? 0,
    totalDiscountAmount: num(sale.totalDiscountAmount) ?? 0,
    posAmountTendered: num(sale.posAmountTendered),
    posChangeGiven: num(sale.posChangeGiven),
    payments: (sale.payments || []).map((p) => ({
      ...p,
      amount: num(p.amount) ?? 0,
      allocations: (p.allocations || []).map((a) => ({
        ...a,
        amount: num(a.amount) ?? 0,
      })),
    })),
  };
}

/**
 * Build tax groups for receipt PDF (same rules as single receipt route).
 * @param {object[]} items
 * @param {number} totalTaxAmount
 */
export function buildSaleTaxData(items, totalTaxAmount = 0) {
  const taxGroups = {};
  let totalTaxFromItems = 0;
  const itemsArray = Array.isArray(items) ? items : [];

  itemsArray.forEach((item) => {
    const itemTaxes = item.itemTaxes || [];
    if (itemTaxes.length > 0) {
      itemTaxes.forEach((tax) => {
        const taxAmount = parseFloat(tax.taxAmount || 0);
        if (taxAmount <= 0) return;
        const taxKey = (tax.taxName || tax.taxId || 'Tax').trim();
        if (!taxGroups[taxKey]) {
          taxGroups[taxKey] = {
            taxName: tax.taxName || tax.taxId || 'Tax',
            taxCode: tax.taxCode || null,
            totalAmount: 0,
          };
        }
        taxGroups[taxKey].totalAmount += taxAmount;
        totalTaxFromItems += taxAmount;
      });
    } else {
      const taxAmount = parseFloat(item.taxAmount || 0);
      if (taxAmount <= 0) return;
      const taxKey = item.taxDescription || 'Tax';
      if (!taxGroups[taxKey]) {
        taxGroups[taxKey] = {
          taxName: item.taxDescription || 'Tax',
          taxCode: null,
          totalAmount: 0,
        };
      }
      taxGroups[taxKey].totalAmount += taxAmount;
      totalTaxFromItems += taxAmount;
    }
  });

  const sortedTaxGroups = Object.values(taxGroups)
    .filter((g) => g.totalAmount > 0)
    .sort((a, b) => (a.taxName || '').localeCompare(b.taxName || ''));

  const resolvedTotalTax =
    totalTaxFromItems > 0 ? totalTaxFromItems : parseFloat(totalTaxAmount || 0);
  const hasAnyTaxes =
    sortedTaxGroups.length > 0 || resolvedTotalTax > 0.000001;

  return {
    taxGroups: sortedTaxGroups,
    hasAnyTaxes,
    totalTaxFromItems,
    totalTaxAmount: resolvedTotalTax,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ dateFrom: Date, dateTo: Date, branchId?: string|null }} filters
 */
export async function countSalesForReceiptExport(prisma, tenantId, filters) {
  return prisma.sale.count({
    where: buildReceiptExportWhere(tenantId, filters),
  });
}

/**
 * Yield sales in stable archive order (saleDate asc, id asc) in batches.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ dateFrom: Date, dateTo: Date, branchId?: string|null }} filters
 * @param {{ batchSize?: number }} [opts]
 */
export async function* iterateSalesForReceiptExport(
  prisma,
  tenantId,
  filters,
  opts = {}
) {
  const batchSize = opts.batchSize || RECEIPT_EXPORT_BATCH_SIZE;
  const where = buildReceiptExportWhere(tenantId, filters);
  let skip = 0;

  for (;;) {
    const batch = await prisma.sale.findMany({
      where,
      include: saleReceiptInclude,
      orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
      skip,
      take: batchSize,
    });

    if (!batch.length) break;

    for (const sale of batch) {
      yield sale;
    }

    skip += batch.length;
    if (batch.length < batchSize) break;
  }
}

/**
 * Format YYYY-MM-DD for filenames.
 * @param {Date} d
 */
export function formatDateForFilename(d) {
  if (!d) return 'all';
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
