"use client";

import { useState, useEffect } from "react";
import { X, Save, Edit, Receipt, Clipboard, Trash2, Check, Download, Package } from "lucide-react";
import ExpenseForm from "./ExpenseForm";
import { addMoney, parseMoney } from "@/lib/money";

function expenseDisplayTitle(expense) {
  if (!expense) return "Expense Details";
  const label =
    expense.displayTitle ||
    expense.description ||
    (expense.documentNumber
      ? `COGS — ${expense.documentType === "sale" ? "Sale" : "Invoice"} ${expense.documentNumber}`
      : null);
  if (label && !String(label).startsWith("cogs-v2-") && !String(label).startsWith("cogs-")) {
    return label;
  }
  if (expense.isCOGS) return "Cost of Goods Sold";
  return "Expense Details";
}

// Modal component for viewing, creating, and editing expenses
const ExpenseModal = ({
  isOpen,
  onClose,
  expense = null,
  onSubmit,
  onDelete,
  title,
  isLoading = false,
  mode = "view", // "view", "create", or "edit"
  categories = [],
}) => {
  const [currentMode, setCurrentMode] = useState(mode);
  const [cogsSource, setCogsSource] = useState(null);
  const [cogsSourceLoading, setCogsSourceLoading] = useState(false);
  const [cogsSourceError, setCogsSourceError] = useState(null);

  // Reset mode when expense changes or modal opens/closes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, isOpen, expense]);

  // Lazy-load sold items for COGS register rows
  useEffect(() => {
    if (!isOpen || currentMode !== "view" || !expense?.isCOGS) {
      setCogsSource(null);
      setCogsSourceError(null);
      setCogsSourceLoading(false);
      return;
    }

    const sourceId = expense.sourceId || null;
    const linkedSaleId = expense.linkedSaleId || null;
    if (!sourceId && !linkedSaleId) {
      setCogsSource(null);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    if (expense.sourceType) params.set("sourceType", expense.sourceType);
    if (sourceId) params.set("sourceId", sourceId);
    if (linkedSaleId) params.set("linkedSaleId", linkedSaleId);

    setCogsSourceLoading(true);
    setCogsSourceError(null);
    fetch(`/api/expenses/cogs-source?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load sold items");
        return data;
      })
      .then((data) => {
        if (!cancelled) setCogsSource(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setCogsSource(null);
          setCogsSourceError(err?.message || "Failed to load sold items");
        }
      })
      .finally(() => {
        if (!cancelled) setCogsSourceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    currentMode,
    expense?.id,
    expense?.isCOGS,
    expense?.sourceType,
    expense?.sourceId,
    expense?.linkedSaleId,
  ]);

  // Format date for display (e.g., "March 15, 2025")
  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatMoney = (amount) =>
    parseMoney(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Format status with icon
  const renderStatus = (status) => {
    const s = String(status || "Draft");
    const styles = {
      Approved: "text-green-700",
      Pending: "text-amber-700",
      Submitted: "text-blue-700",
      "In review": "text-indigo-700",
      Rejected: "text-red-700",
      Draft: "text-gray-700",
      Reversed: "text-red-800",
    };
    const color = styles[s] || "text-gray-700";
    return (
      <div className={`flex items-center ${color}`}>
        {s === "Approved" ? <Check className="w-4 h-4 mr-1 text-green-500" /> : null}
        <span>{s}</span>
      </div>
    );
  };

  // Open receipt viewer
  const viewReceipts = () => {
    onClose();
    if (expense && expense.onViewReceipts) {
      expense.onViewReceipts();
    }
  };

  if (!isOpen) return null;

  const headerTitle =
    currentMode === "create"
      ? "Create New Expense"
      : currentMode === "edit"
        ? "Edit Expense"
        : title && !String(title).includes("cogs-v2-") && !String(title).includes("cogs-")
          ? title
          : expenseDisplayTitle(expense);

  const isSystemCogs = !!expense?.isCOGS;
  const soldItems = cogsSource?.found ? cogsSource.items || [] : [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="ib-modal-backdrop absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="ib-modal-panel relative z-[9999] flex w-full max-w-2xl max-h-[min(90vh,900px)] flex-col overflow-hidden text-left"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900 pr-4 truncate" title={headerTitle}>
            {currentMode === "view" ? `Expense Details: ${headerTitle}` : headerTitle}
          </h3>
          <button
            type="button"
            className="rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {currentMode === "view" && expense && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h4 className="font-medium text-lg break-words">
                      {expenseDisplayTitle(expense)}
                    </h4>
                    <p className="text-gray-500">{formatDate(expense.date)}</p>
                    {isSystemCogs && (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        System COGS from{" "}
                        {cogsSource?.documentType === "sale"
                          ? "POS sale"
                          : cogsSource?.documentType === "invoice"
                            ? "invoice"
                            : "sales document"}
                        {cogsSource?.documentNumber
                          ? ` ${cogsSource.documentNumber}`
                          : expense.documentNumber
                            ? ` ${expense.documentNumber}`
                            : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">MK {formatMoney(expense.amount)}</div>
                    {expense.taxAmount != null && parseMoney(expense.taxAmount) > 0 && (
                      <div className="text-sm text-gray-600 mt-1">
                        Tax: MK {formatMoney(expense.taxAmount)}
                        {expense.taxRate != null && Number(expense.taxRate) > 0
                          ? ` (${Number(expense.taxRate).toFixed(1)}%)`
                          : ""}{" "}
                        · Total: MK {formatMoney(addMoney(expense.amount, expense.taxAmount))}
                      </div>
                    )}
                    {renderStatus(expense.status)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h5 className="text-sm font-medium text-gray-500 mb-2">Amount breakdown</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Amount</span>
                    <p className="font-medium text-gray-900">MK {formatMoney(expense.amount)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tax</span>
                    <p className="font-medium text-gray-900">
                      MK {formatMoney(expense.taxAmount)}
                      {expense.taxRate != null && Number(expense.taxRate) > 0 && (
                        <span className="text-gray-500 font-normal ml-1">
                          ({Number(expense.taxRate).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total (incl. tax)</span>
                    <p className="font-semibold text-gray-900">
                      MK {formatMoney(addMoney(expense.amount, expense.taxAmount))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Category</h5>
                  <p>{expense.category}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Merchant</h5>
                  <p>
                    {expense.merchant ||
                      cogsSource?.counterparty ||
                      "-"}
                  </p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Source Account</h5>
                  <p>{expense.sourceAccount?.name || expense.glAccountLabel || "-"}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Submitted By</h5>
                  <p>{expense.submittedBy?.name || "-"}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Created On</h5>
                  <p>{formatDate(expense.createdAt)}</p>
                </div>
                {expense.transactionReference ? (
                  <div>
                    <h5 className="text-sm font-medium text-gray-500">Journal</h5>
                    <p className="font-mono text-sm">{expense.transactionReference}</p>
                  </div>
                ) : null}
              </div>

              {/* Items sold (COGS linked invoice / POS sale) */}
              {isSystemCogs && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    <h5 className="text-sm font-medium text-gray-700">Items sold</h5>
                  </div>
                  {cogsSourceLoading ? (
                    <p className="text-sm text-gray-500 italic">Loading items…</p>
                  ) : cogsSourceError ? (
                    <p className="text-sm text-red-600">{cogsSourceError}</p>
                  ) : !cogsSource?.found ? (
                    <p className="text-sm text-gray-500 italic">
                      No linked invoice or POS sale found for this COGS entry.
                    </p>
                  ) : soldItems.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Linked {cogsSource.documentType} {cogsSource.documentNumber} has no line
                      items.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-3">
                        From {cogsSource.documentType === "sale" ? "POS sale" : "invoice"}{" "}
                        <span className="font-semibold text-gray-700">
                          {cogsSource.documentNumber}
                        </span>
                        {cogsSource.counterparty ? ` · ${cogsSource.counterparty}` : ""}
                        {cogsSource.itemsPreferredStocked
                          ? " · stocked items that drive COGS"
                          : " · all document lines"}
                      </p>
                      <div className="overflow-x-auto rounded-md border border-gray-100">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Item</th>
                              <th className="px-3 py-2 text-right font-semibold">Qty</th>
                              <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                              <th className="px-3 py-2 text-right font-semibold">Line total</th>
                              <th className="px-3 py-2 text-right font-semibold">Est. COGS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {soldItems.map((item) => (
                              <tr key={item.id} className="bg-white">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-gray-900">
                                    {item.productName || item.description}
                                  </div>
                                  {item.productName &&
                                    item.description &&
                                    item.productName !== item.description && (
                                      <div className="text-xs text-gray-500 truncate max-w-[220px]">
                                        {item.description}
                                      </div>
                                    )}
                                  {item.sku ? (
                                    <div className="text-[11px] font-mono text-gray-400">
                                      {item.sku}
                                    </div>
                                  ) : null}
                                  {item.isService ? (
                                    <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase text-slate-500">
                                      Service
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                  {item.quantity}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                  {formatMoney(item.unitPrice)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums font-medium">
                                  {formatMoney(item.amount)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-700">
                                  {parseMoney(item.cogsAmount) > 0
                                    ? formatMoney(item.cogsAmount)
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isSystemCogs && expense.attachments?.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="text-sm font-medium text-gray-700">Linked receipt</h5>
                  </div>
                  <div className="space-y-2">
                    {expense.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center p-2 border border-gray-200 rounded bg-gray-50"
                      >
                        <div className="flex-shrink-0 text-gray-400 mr-2">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.virtual
                              ? "Opens the source invoice / POS receipt PDF"
                              : attachment.size}
                          </p>
                        </div>
                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            View
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expense.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Notes</h5>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{expense.notes}</p>
                </div>
              )}

              {!isSystemCogs && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="text-sm font-medium text-gray-500">Receipts</h5>
                  </div>

                  {expense.attachments?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {expense.attachments.slice(0, 2).map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center p-2 border border-gray-200 rounded"
                        >
                          <div className="flex-shrink-0 text-gray-400 mr-2">
                            {attachment.type?.includes("image") ? (
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="h-10 w-10 object-cover rounded"
                              />
                            ) : (
                              <Receipt className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{attachment.name}</p>
                            <p className="text-xs text-gray-500">{attachment.size}</p>
                          </div>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-gray-400 hover:text-gray-500"
                          >
                            <Download className="h-5 w-5" />
                          </a>
                        </div>
                      ))}

                      {expense.attachments.length > 2 && (
                        <div
                          className="flex items-center justify-center p-2 border border-gray-200 rounded bg-gray-50 cursor-pointer"
                          onClick={viewReceipts}
                        >
                          <span className="text-gray-500">
                            +{expense.attachments.length - 2} more
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No receipts attached</p>
                  )}
                </div>
              )}
            </div>
          )}

          {(currentMode === "create" || currentMode === "edit") && (
            <ExpenseForm
              expense={currentMode === "edit" ? expense : null}
              onSubmit={onSubmit}
              onCancel={() => (expense ? setCurrentMode("view") : onClose())}
              isLoading={isLoading}
              categories={categories}
            />
          )}
        </div>

        {currentMode === "view" && expense && (
          <div className="flex shrink-0 justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div>
              {onDelete && !isSystemCogs && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center"
                  onClick={() => onDelete(expense.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={onClose}
              >
                Close
              </button>

              {!isSystemCogs && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
                  onClick={() => setCurrentMode("edit")}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseModal;
export { expenseDisplayTitle };
