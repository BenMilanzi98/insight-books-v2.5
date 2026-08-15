'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialFilters() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  return { from: localDate(from), to: localDate(to), type: 'all' };
}

function money(amount) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'MWK',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

const emptyReport = {
  revenue: { total: 0, bySource: { RENTAL_SPACE: 0, CUSTOMER_HIRE: 0 } },
  tax: { total: 0 },
  reversals: { count: 0, total: 0 },
  damages: { count: 0, total: 0 },
  repairs: { count: 0, total: 0 },
  utilization: { spaceBookings: 0, customerHireBookings: 0, qtyDays: 0 },
  supplierHireSpend: { count: 0, total: 0 },
  rows: [],
};

export default function RentalReportsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(nextFilters);
      const response = await fetch(`/api/rentals/reports?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load report');
      setReport(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function submitFilters(event) {
    event.preventDefault();
    loadReport();
  }

  const metrics = [
    ['Revenue', money(report.revenue.total), 'Outbound rental and customer-hire invoices'],
    ['Tax', money(report.tax.total), 'Tax on recognised rental revenue'],
    ['Reversals', money(report.reversals.total), `${report.reversals.count} voided invoice(s)`],
    ['Damage & loss', money(report.damages.total), `${report.damages.count} recorded charge(s)`],
    ['Repairs', money(report.repairs.total), `${report.repairs.count} tagged expense(s)`],
    ['Supplier hire', money(report.supplierHireSpend.total), `${report.supplierHireSpend.count} accrued cost(s)`],
  ];

  return (
    <main className="min-h-full p-4 sm:p-6 lg:p-8">
      <PosStylePageHeader
        title="Rental reports"
        description="Revenue, operational usage, repairs, and supplier hire cost."
      />

      <PosStylePanel className="mb-6 p-4 sm:p-5">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submitFilters}>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {tt('From')}
            <input className="rounded-lg border border-gray-300 bg-white px-3 py-2" name="from" type="date" value={filters.from} onChange={updateFilter} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {tt('To')}
            <input className="rounded-lg border border-gray-300 bg-white px-3 py-2" name="to" type="date" value={filters.to} onChange={updateFilter} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {tt('Report type')}
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2" name="type" value={filters.type} onChange={updateFilter}>
              <option value="all">{tt('All activity')}</option>
              <option value="space">{tt('Rental space')}</option>
              <option value="customer_hire">{tt('Customer hire')}</option>
              <option value="supplier_hire">{tt('Supplier hire')}</option>
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60" disabled={loading} type="submit">
            {loading ? 'Loading…' : 'Apply filters'}
          </button>
        </form>
      </PosStylePanel>

      {error ? <p className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value, detail]) => (
          <PosStylePanel key={label} className="p-4" accent={label === 'Reversals' ? 'rose' : label === 'Revenue' ? 'green' : 'default'}>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
          </PosStylePanel>
        ))}
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <PosStylePanel className="p-4" accent="blue">
          <h2 className="font-semibold text-[var(--text-primary)]">{tt('Revenue source')}</h2>
          <p className="mt-2 text-sm text-gray-600">Rental space: {money(report.revenue.bySource.RENTAL_SPACE)}</p>
          <p className="text-sm text-gray-600">Customer hire: {money(report.revenue.bySource.CUSTOMER_HIRE)}</p>
        </PosStylePanel>
        <PosStylePanel className="p-4" accent="purple">
          <h2 className="font-semibold text-[var(--text-primary)]">{tt('Utilization')}</h2>
          <p className="mt-2 text-sm text-gray-600">Space bookings: {report.utilization.spaceBookings}</p>
          <p className="text-sm text-gray-600">Customer-hire bookings: {report.utilization.customerHireBookings}</p>
          <p className="text-sm text-gray-600">Quantity-days: {report.utilization.qtyDays}</p>
        </PosStylePanel>
        <PosStylePanel className="p-4">
          <h2 className="font-semibold text-[var(--text-primary)]">{tt('Repair entry convention')}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {tt('Tag rental repair expenses with')} <code>source=REPAIR</code> {tt('or')} <code>RENTAL_REPAIR</code> {tt('in Notes to include them here.')}
          </p>
        </PosStylePanel>
      </section>

      <PosStylePanel className="overflow-hidden" accent={false}>
        <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-[var(--text-primary)]">{tt('Report activity')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3 sm:px-5">{tt('Date')}</th><th className="px-4 py-3">{tt('Type')}</th><th className="px-4 py-3">{tt('Description')}</th><th className="px-4 py-3 text-right sm:px-5">{tt('Amount')}</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.rows.map((row, index) => (
                <tr key={`${row.type}-${row.invoiceId || row.transactionId || index}`} className="text-gray-700">
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">{row.type.replaceAll('_', ' ')}</span></td>
                  <td className="px-4 py-3">{row.href ? <a className="font-medium text-blue-700 hover:underline" href={row.href}>{row.label}</a> : row.label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium sm:px-5">{money(row.amount)}</td>
                </tr>
              ))}
              {!loading && report.rows.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-500 sm:px-5" colSpan="4">{tt('No report activity in this period.')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </PosStylePanel>
    </main>
  );
}
