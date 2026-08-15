"use client";
import { tt } from '@/lib/i18n/runtime';

/**
 * Generic opening-balance line editor for setup domain steps.
 * Payload shape: { lines: [{ accountId, debit, credit, description, customerId, supplierId }] }
 */
export default function SetupDomainLinesForm({
  form,
  setForm,
  help,
  showCustomer = false,
  showSupplier = false,
}) {
  const lines = Array.isArray(form.lines) ? form.lines : [];

  const updateLine = (index, patch) => {
    const next = lines.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setForm((prev) => ({ ...prev, lines: next }));
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [
        ...(Array.isArray(prev.lines) ? prev.lines : []),
        { accountId: "", debit: "", credit: "", description: "" },
      ],
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-4">
      {help ? <p className="text-sm text-slate-600">{help}</p> : null}
      <div className="space-y-3">
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            {tt('No lines yet. Add account lines for this opening domain. Debits and credits across all domains must balance before posting.')}
          </p>
        ) : null}
        {lines.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <label className="text-xs sm:col-span-2 lg:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">{tt('Account ID')}</span>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={row.accountId || ""}
                onChange={(e) => updateLine(index, { accountId: e.target.value })}
                placeholder={tt('Chart of Accounts account id')}
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium text-slate-700">{tt('Debit')}</span>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={row.debit || ""}
                onChange={(e) => updateLine(index, { debit: e.target.value, credit: "" })}
                inputMode="decimal"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium text-slate-700">{tt('Credit')}</span>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={row.credit || ""}
                onChange={(e) => updateLine(index, { credit: e.target.value, debit: "" })}
                inputMode="decimal"
              />
            </label>
            <label className="text-xs sm:col-span-2 lg:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">{tt('Description')}</span>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={row.description || ""}
                onChange={(e) => updateLine(index, { description: e.target.value })}
              />
            </label>
            {showCustomer ? (
              <label className="text-xs sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">{tt('Customer ID')}</span>
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={row.customerId || ""}
                  onChange={(e) => updateLine(index, { customerId: e.target.value })}
                />
              </label>
            ) : null}
            {showSupplier ? (
              <label className="text-xs sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">{tt('Supplier ID')}</span>
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={row.supplierId || ""}
                  onChange={(e) => updateLine(index, { supplierId: e.target.value })}
                />
              </label>
            ) : null}
            <div className="flex items-end sm:col-span-2 lg:col-span-6">
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="text-xs text-red-600 hover:underline"
              >
                {tt('Remove line')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addLine}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {tt('Add line')}
      </button>
    </div>
  );
}
