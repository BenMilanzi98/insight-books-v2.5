"use client";

import { useState, useEffect } from "react";
import { X, Save, Edit, Receipt, Clipboard, Trash2, Check, Download } from "lucide-react";
import ExpenseForm from "./ExpenseForm";
import { addMoney, parseMoney } from "@/lib/money";

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
  
  // Reset mode when expense changes or modal opens/closes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, isOpen, expense]);
  
  // Format date for display (e.g., "March 15, 2025")
  const formatDate = (dateString) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatMoney = (amount) =>
    parseMoney(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Format status with icon
  const renderStatus = (status) => {
    const s = String(status || 'Draft');
    const styles = {
      Approved: 'text-green-700',
      Pending: 'text-amber-700',
      Submitted: 'text-blue-700',
      'In review': 'text-indigo-700',
      Rejected: 'text-red-700',
      Draft: 'text-gray-700',
      Reversed: 'text-red-800',
    };
    const color = styles[s] || 'text-gray-700';
    return (
      <div className={`flex items-center ${color}`}>
        {s === 'Approved' ? <Check className="w-4 h-4 mr-1 text-green-500" /> : null}
        <span>{s}</span>
      </div>
    );
  };

  // Open receipt viewer
  const viewReceipts = () => {
    // This would typically trigger a receipt viewer modal
    // For now, we'll just handle it through a callback
    onClose();
    if (expense && expense.onViewReceipts) {
      expense.onViewReceipts();
    }
  };
  
  // If the modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-gray-500/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel — capped to viewport with internal scroll */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[9999] flex w-full max-w-2xl max-h-[min(90vh,900px)] flex-col overflow-hidden rounded-lg bg-white text-left shadow-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">
            {currentMode === "create" ? "Create New Expense" :
             currentMode === "edit" ? "Edit Expense" :
             title || "Expense Details"}
          </h3>
          <button
            type="button"
            className="rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {currentMode === "view" && expense && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-lg">{expense.description}</h4>
                    <p className="text-gray-500">{formatDate(expense.date)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">MK {formatMoney(expense.amount)}</div>
                    {(expense.taxAmount != null && parseMoney(expense.taxAmount) > 0) && (
                      <div className="text-sm text-gray-600 mt-1">
                        Tax: MK {formatMoney(expense.taxAmount)}{expense.taxRate != null && Number(expense.taxRate) > 0 ? ` (${Number(expense.taxRate).toFixed(1)}%)` : ''} · Total: MK {formatMoney(addMoney(expense.amount, expense.taxAmount))}
                      </div>
                    )}
                    {renderStatus(expense.status)}
                  </div>
                </div>
              </div>

              {/* Tax breakdown - always show so net/tax/total are tracked */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h5 className="text-sm font-medium text-gray-500 mb-2">Amount breakdown</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Amount</span>
                    <p className="font-medium text-gray-900">
                      MK {formatMoney(expense.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tax</span>
                    <p className="font-medium text-gray-900">
                      MK {formatMoney(expense.taxAmount)}
                      {expense.taxRate != null && Number(expense.taxRate) > 0 && (
                        <span className="text-gray-500 font-normal ml-1">({Number(expense.taxRate).toFixed(1)}%)</span>
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

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Category</h5>
                  <p>{expense.category}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Merchant</h5>
                  <p>{expense.merchant || "-"}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Source Account</h5>
                  <p>{expense.sourceAccount?.name || "-"}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Submitted By</h5>
                  <p>{expense.submittedBy?.name || "-"}</p>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Created On</h5>
                  <p>{formatDate(expense.createdAt)}</p>
                </div>
              </div>

              {/* Notes */}
              {expense.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500">Notes</h5>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{expense.notes}</p>
                </div>
              )}

              {/* Receipts Section */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-sm font-medium text-gray-500">Receipts</h5>
                </div>

                {expense.attachments?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {expense.attachments.slice(0, 2).map(attachment => (
                      <div
                        key={attachment.id}
                        className="flex items-center p-2 border border-gray-200 rounded"
                      >
                        <div className="flex-shrink-0 text-gray-400 mr-2">
                          {attachment.type?.includes('image')
                            ? <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="h-10 w-10 object-cover rounded"
                              />
                            : <Receipt className="h-5 w-5" />}
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
            </div>
          )}

          {(currentMode === "create" || currentMode === "edit") && (
            <ExpenseForm
              expense={currentMode === "edit" ? expense : null}
              onSubmit={onSubmit}
              onCancel={() => expense ? setCurrentMode("view") : onClose()}
              isLoading={isLoading}
              categories={categories}
            />
          )}
        </div>

        {/* Footer */}
        {currentMode === "view" && expense && (
          <div className="flex shrink-0 justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div>
              {onDelete && (
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

              <button
                type="button"
                className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
                onClick={() => setCurrentMode("edit")}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseModal;