import {
  OUTBOUND_INVOICE_SOURCE,
  RENTAL_TRACE_EVENT,
  resolveOutboundInvoiceSource,
} from './rentalSourceTags.js';

const REPORT_TYPES = new Set(['all', 'space', 'customer_hire', 'supplier_hire']);
const EXCLUDED_REVENUE_STATUSES = new Set(['void', 'draft', 'cancelled']);

function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function inRange(date, from, to) {
  if (!date) return false;
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function dateValue(date) {
  return date instanceof Date ? date : new Date(date);
}

function normalizedType(type) {
  const value = String(type || 'all').toLowerCase();
  if (!REPORT_TYPES.has(value)) throw new Error('Invalid report type');
  return value;
}

function matchesOutboundType(source, type) {
  return (
    type === 'all' ||
    (type === 'space' && source === OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE) ||
    (type === 'customer_hire' && source === OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE)
  );
}

function isRentalOperationalType(type) {
  return type === 'all' || type === 'space';
}

function resolveTraceSource(record) {
  const source = resolveOutboundInvoiceSource(record.rentalTransaction?.kind);
  if (source) return source;

  const notes = String(record.notes || '');
  if (/rentalSource=CUSTOMER_HIRE|rentalKind=(hiring|quantity_pool)/i.test(notes)) {
    return OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE;
  }
  if (/rentalSource=RENTAL_SPACE|rentalKind=(rental|space)/i.test(notes)) {
    return OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE;
  }
  return null;
}

function matchesOperationalTraceType(record, type) {
  const source = resolveTraceSource(record);
  if (type === 'all') return true;
  if (source) return matchesOutboundType(source, type);
  return type === 'space';
}

function addRow(rows, row) {
  rows.push({
    ...row,
    date: dateValue(row.date).toISOString(),
  });
}

/**
 * Build a tenant-scoped operational report for outbound rentals and supplier hire.
 *
 * Supplier hire cost comes from HireAccrual because hiring-v2 writes that model at
 * accrual time and only links a SupplierBill later when the accrual is cleared.
 */
export async function buildRentalHiringReport({ prisma, tenantId, from, to, type = 'all' }) {
  if (!prisma || !tenantId) throw new Error('prisma and tenantId are required');

  const reportType = normalizedType(type);
  const fromDate = dateValue(from);
  const toDate = dateValue(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    throw new Error('A valid report date range is required');
  }

  const range = { gte: fromDate, lte: toDate };
  const [invoices, charges, expenses, transactions, hireAccruals] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        isRentalInvoice: true,
        isDeleted: false,
        OR: [{ issueDate: range }, { voidedAt: range }],
      },
      include: { rentalTransaction: true },
    }),
    prisma.rentalCharge.findMany({
      where: { tenantId, createdAt: range },
    }),
    prisma.expense.findMany({
      where: { tenantId, date: range, isDeleted: false },
    }),
    prisma.rentalTransaction.findMany({
      where: {
        tenantId,
        startAt: { lte: toDate },
        endAt: { gte: fromDate },
      },
      include: { items: true },
    }),
    prisma.hireAccrual.findMany({
      where: {
        tenantId,
        createdAt: range,
        status: { not: 'VOID' },
      },
      include: { agreement: true },
    }),
  ]);

  const report = {
    revenue: {
      total: 0,
      bySource: {
        RENTAL_SPACE: 0,
        CUSTOMER_HIRE: 0,
      },
    },
    tax: { total: 0 },
    reversals: { count: 0, total: 0 },
    damages: { total: 0, count: 0 },
    repairs: { total: 0, count: 0 },
    utilization: { spaceBookings: 0, customerHireBookings: 0, qtyDays: 0 },
    supplierHireSpend: { total: 0, count: 0 },
    rows: [],
  };

  for (const invoice of invoices) {
    const isDamageInvoice = /source=DAMAGE/i.test(String(invoice.notes || ''));
    if (isDamageInvoice) {
      if (
        matchesOperationalTraceType(invoice, reportType) &&
        !EXCLUDED_REVENUE_STATUSES.has(String(invoice.status || '').toLowerCase()) &&
        inRange(invoice.issueDate, fromDate, toDate)
      ) {
        const amount = asNumber(invoice.total);
        report.damages.count += 1;
        report.damages.total += amount;
        addRow(report.rows, {
          date: invoice.issueDate,
          type: RENTAL_TRACE_EVENT.DAMAGE,
          label: invoice.invoiceNumber || `Damage invoice ${invoice.id}`,
          amount,
          invoiceId: invoice.id,
          href: '/invoices',
        });
      }
      continue;
    }

    const source = resolveOutboundInvoiceSource(invoice.rentalTransaction?.kind);
    if (!source || !matchesOutboundType(source, reportType)) continue;

    const status = String(invoice.status || '').toLowerCase();
    const total = asNumber(invoice.total);
    const voidedInPeriod = inRange(invoice.voidedAt, fromDate, toDate);
    const isVoid = status === 'void' || Boolean(invoice.voidedAt);

    if (isVoid && voidedInPeriod) {
      report.reversals.count += 1;
      report.reversals.total += total;
      addRow(report.rows, {
        date: invoice.voidedAt,
        type: RENTAL_TRACE_EVENT.REVERSAL,
        label: `Voided ${invoice.invoiceNumber || `invoice ${invoice.id}`}`,
        amount: total,
        invoiceId: invoice.id,
        transactionId: invoice.rentalTransaction?.id,
        href: '/invoices',
      });
      continue;
    }

    if (EXCLUDED_REVENUE_STATUSES.has(status) || !inRange(invoice.issueDate, fromDate, toDate)) {
      continue;
    }

    report.revenue.total += total;
    report.revenue.bySource[source] += total;
    report.tax.total += asNumber(invoice.taxAmount);
    addRow(report.rows, {
      date: invoice.issueDate,
      type: RENTAL_TRACE_EVENT.REVENUE,
      label: invoice.invoiceNumber || `Invoice ${invoice.id}`,
      amount: total,
      invoiceId: invoice.id,
      transactionId: invoice.rentalTransaction?.id,
      href: '/invoices',
    });
  }

  for (const transaction of transactions) {
    const source = resolveOutboundInvoiceSource(transaction.kind);
    if (!source || !matchesOutboundType(source, reportType)) continue;

    if (source === OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE) {
      report.utilization.spaceBookings += 1;
    } else {
      report.utilization.customerHireBookings += 1;
    }

    const itemQtyDays = (transaction.items || []).reduce(
      (total, item) => total + asNumber(item.quantity || 1) * asNumber(item.billableUnits),
      0
    );
    const spanDays = Math.max(
      1,
      Math.ceil((dateValue(transaction.endAt) - dateValue(transaction.startAt)) / 86_400_000)
    );
    report.utilization.qtyDays += itemQtyDays || spanDays;
  }

  if (isRentalOperationalType(reportType)) {
    for (const charge of charges) {
      if (!/damage|loss/i.test(String(charge.chargeType || ''))) continue;
      const amount = asNumber(charge.amount);
      report.damages.count += 1;
      report.damages.total += amount;
      addRow(report.rows, {
        date: charge.createdAt,
        type: /loss/i.test(String(charge.chargeType)) ? RENTAL_TRACE_EVENT.DAMAGE_LOSS : RENTAL_TRACE_EVENT.DAMAGE,
        label: charge.description || charge.chargeType,
        amount,
      });
    }

  }

  if (reportType !== 'supplier_hire') {
    for (const expense of expenses) {
      if (!/(source=REPAIR|RENTAL_REPAIR)/i.test(String(expense.notes || ''))) continue;
      if (!matchesOperationalTraceType(expense, reportType)) continue;
      const amount = asNumber(expense.amount);
      report.repairs.count += 1;
      report.repairs.total += amount;
      addRow(report.rows, {
        date: expense.date,
        type: RENTAL_TRACE_EVENT.REPAIR,
        label: expense.description || expense.merchant || 'Rental repair',
        amount,
      });
    }
  }

  if (reportType === 'all' || reportType === 'supplier_hire') {
    for (const accrual of hireAccruals) {
      const amount = asNumber(accrual.amount);
      report.supplierHireSpend.count += 1;
      report.supplierHireSpend.total += amount;
      addRow(report.rows, {
        date: accrual.createdAt,
        type: RENTAL_TRACE_EVENT.SUPPLIER_HIRE_SPEND,
        label: `Supplier hire accrual ${accrual.agreement?.agreementNumber || accrual.agreementId}`,
        amount,
      });
    }
  }

  report.rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return report;
}
