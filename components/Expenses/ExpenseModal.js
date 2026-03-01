"use client";

import { useState, useEffect } from "react";
import { X, Save, Edit, Receipt, Clipboard, Trash2, Check, Download } from "lucide-react";
import ExpenseForm from "./ExpenseForm";

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
  categories = []
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
  
  // Format status with icon
  const renderStatus = (status) => {
    // Always show as Approved
    return (
      <div className="flex items-center text-green-700">
        <Check className="w-4 h-4 mr-1 text-green-500" />
        <span>Approved</span>
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
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity z-[9998]"
          onClick={onClose}
        ></div>
        
        {/* Modal content */}
        <div className="relative z-[9999] inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {currentMode === "create" ? "Create New Expense" : 
               currentMode === "edit" ? "Edit Expense" : 
               title || "Expense Details"}
            </h3>
            <button
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Body */}
          <div className="px-6 py-4">
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
                      <div className="text-xl font-bold">MK {expense.amount}</div>
                      {(expense.taxAmount != null && Number(expense.taxAmount) > 0) && (
                        <div className="text-sm text-gray-600 mt-1">
                          Tax: MK {Number(expense.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{expense.taxRate != null && Number(expense.taxRate) > 0 ? ` (${Number(expense.taxRate).toFixed(1)}%)` : ''} · Total: MK {((typeof expense.amount === 'string' ? parseFloat(expense.amount.replace(/,/g, '')) : Number(expense.amount)) + (Number(expense.taxAmount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        MK {(typeof expense.amount === 'string' ? parseFloat(expense.amount.replace(/,/g, '')) : Number(expense.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Tax</span>
                      <p className="font-medium text-gray-900">
                        MK {(Number(expense.taxAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {expense.taxRate != null && Number(expense.taxRate) > 0 && (
                          <span className="text-gray-500 font-normal ml-1">({Number(expense.taxRate).toFixed(1)}%)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total (incl. tax)</span>
                      <p className="font-semibold text-gray-900">
                        MK {((typeof expense.amount === 'string' ? parseFloat(expense.amount.replace(/,/g, '')) : Number(expense.amount)) + (Number(expense.taxAmount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    {/* <button
                      className="text-blue-600 hover:text-blue-700 text-sm flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                      onClick={viewReceipts}
                    >
                      <Receipt className="h-4 w-4 mr-1" />
                      {expense.attachments?.length 
                        ? `View All (${expense.attachments.length})` 
                        : "Add Receipt"}
                    </button> */}
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
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
              {/* Left side - Delete button (if allowed) */}
              <div>
                {expense.status === "Pending" && (
                  <button
                    className="px-4 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center"
                    onClick={() => onDelete && onDelete(expense.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                )}
              </div>
              
              {/* Right side - Action buttons */}
              <div className="flex space-x-3">
                <button
                  className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={onClose}
                >
                  Close
                </button>
                
                {expense.status === "Pending" && (
                  <button
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
    </div>
  );
};

export default ExpenseModal;