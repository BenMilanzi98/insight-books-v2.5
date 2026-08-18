"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Image from "next/image";
import { Eye, Search, Download, Calendar, X, FileText, Receipt, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import SupplierForm from "@/components/purchases/SupplierForm";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";
import {
  assertReceiptDateOnOrAfterPurchaseOrder,
  getPurchaseOrderMinReceiptDateStr,
} from "@/lib/goodsReceiptDateUtils";
import { receiptUnitCostFromPurchaseOrderLine } from "@/lib/receiptUnitCostFromPoLine";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";
import StatCard from "@/components/ui/StatCard";

async function updateSupplier(id, payload) {
  const res = await fetch(`/api/purchases/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update supplier");
  }
  return res.json();
}

async function deleteSupplier(id) {
  const res = await fetch(`/api/purchases/suppliers/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to delete supplier");
  }
  return res.json();
}

const formatMoney = (value) => `MWK ${Number(value || 0).toLocaleString()}`;



function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 ">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tt('Cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white  hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? tt('Removing…') : tt('Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierTransactionsModal({ supplier, transactions, onClose, loading }) {
  if (!supplier) return null;

  const summary = transactions?.summary || {};
  const bills = summary.bills || {};
  const expenses = summary.expenses || {};
  const payments = summary.payments || {};
  const billsList = transactions?.bills || [];
  const expensesList = transactions?.expenses || [];
  const paymentsList = transactions?.payments || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-sky-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{supplier.supplierName}</h2>
            <p className="text-sm text-gray-600 mt-1">Code: {supplier.supplierCode}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">{tt('Loading transactions...')}</div>
            </div>
          ) : transactions ? (
            <div className="p-6 space-y-6">
              {/* Overall Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <DollarSign size={16} className="text-indigo-600" />
                    {tt('Total Owed')}
                  </div>
                  <div className="mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-red-600 sm:text-2xl">
                    {formatMoney(summary.totalOwed || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills: {formatMoney(bills.billsOutstanding || 0)} + Expenses: {formatMoney(expenses.expensesOutstanding || 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <FileText size={16} className="text-blue-600" />
                    {tt('Total Billed')}
                  </div>
                  <div className="mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-gray-900 sm:text-2xl">
                    {formatMoney(summary.totalBilled || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills: {formatMoney(bills.totalBillsAmount || 0)} + Expenses: {formatMoney(expenses.totalExpensesAmount || 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <TrendingDown size={16} className="text-green-600" />
                    {tt('Total Paid')}
                  </div>
                  <div className="mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-green-600 sm:text-2xl">
                    {formatMoney(summary.totalPaid || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills: {formatMoney(bills.totalBillsPaid || 0)} + Expenses: {formatMoney(expenses.totalExpensesPaid || 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <TrendingUp size={16} className="text-orange-600" />
                    {tt('Current Balance')}
                  </div>
                  <div className="mt-2 min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-orange-600 sm:text-2xl">
                    {formatMoney(summary.currentBalance || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {tt('From supplier record')}
                  </div>
                </div>
              </div>

              {/* Bills Section */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Receipt size={20} className="text-indigo-600" />
                    {tt('Bills Summary')}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">{tt('Total Bills')}</div>
                      <div className="text-lg font-semibold text-gray-900">{bills.totalBills || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Total Amount')}</div>
                      <div className="text-lg font-semibold text-gray-900">{formatMoney(bills.totalBillsAmount || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Amount Paid')}</div>
                      <div className="text-lg font-semibold text-green-600">{formatMoney(bills.totalBillsPaid || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Outstanding')}</div>
                      <div className="text-lg font-semibold text-red-600">{formatMoney(bills.billsOutstanding || 0)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      Paid: {bills.paidBillsCount || 0}
                    </span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      Partial: {bills.partiallyPaidBillsCount || 0}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                      Unpaid: {bills.unpaidBillsCount || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    {tt('Expenses Summary')}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">{tt('Total Expenses')}</div>
                      <div className="text-lg font-semibold text-gray-900">{expenses.totalExpenses || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Total Amount')}</div>
                      <div className="text-lg font-semibold text-gray-900">{formatMoney(expenses.totalExpensesAmount || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Amount Paid')}</div>
                      <div className="text-lg font-semibold text-green-600">{formatMoney(expenses.totalExpensesPaid || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{tt('Outstanding')}</div>
                      <div className="text-lg font-semibold text-red-600">{formatMoney(expenses.expensesOutstanding || 0)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      Fully Paid: {expenses.fullyPaidExpensesCount || 0}
                    </span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      Partial: {expenses.partiallyPaidExpensesCount || 0}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                      Unpaid: {expenses.unpaidExpensesCount || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payments Section */}
              {payments.totalPayments > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign size={20} className="text-green-600" />
                      {tt('Payments Summary')}
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">{tt('Total Payments')}</div>
                        <div className="text-lg font-semibold text-gray-900">{payments.totalPayments || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">{tt('Total Amount Paid')}</div>
                        <div className="text-lg font-semibold text-green-600">{formatMoney(payments.totalPaymentsAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">{tt('Allocated to Bills')}</div>
                        <div className="text-lg font-semibold text-blue-600">{formatMoney(payments.paymentsToBills || 0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Bills */}
              {billsList.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">All Bills ({billsList.length})</h3>
                    {billsList.length > 10 && (
                      <span className="text-xs text-gray-500">{tt('Showing all bills')}</span>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Bill Number')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Date')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Due Date')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Amount')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Paid')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Balance')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {billsList.map((bill) => (
                          <tr key={bill.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{bill.billNumber}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(bill.billDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatMoney(bill.totalAmount)}</td>
                            <td className="px-4 py-2 text-sm text-right text-green-600">{formatMoney(bill.amountPaid)}</td>
                            <td className="px-4 py-2 text-sm text-right text-red-600 font-semibold">{formatMoney(bill.balanceDue)}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                bill.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                bill.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {bill.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {billsList.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{tt('Totals:')}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                              {formatMoney(billsList.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0))}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-green-600 text-right">
                              {formatMoney(billsList.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0))}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-red-600 text-right">
                              {formatMoney(billsList.reduce((sum, b) => sum + (Number(b.balanceDue) || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* All Expenses */}
              {expensesList.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">All Expenses ({expensesList.length})</h3>
                    {expensesList.length > 10 && (
                      <span className="text-xs text-gray-500">{tt('Showing all expenses')}</span>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Description')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Date')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Category')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Amount')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Paid')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Balance')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {expensesList.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{expense.description}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{expense.category || '-'}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-900">{formatMoney(expense.amount)}</td>
                            <td className="px-4 py-2 text-sm text-right text-green-600">{formatMoney(expense.paidAmount)}</td>
                            <td className="px-4 py-2 text-sm text-right text-red-600 font-semibold">{formatMoney(expense.balanceDue)}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                expense.paymentStatus === 'Fully paid' ? 'bg-green-100 text-green-800' :
                                expense.paymentStatus === 'Partially' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {expense.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {expensesList.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{tt('Totals:')}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                              {formatMoney(expensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-green-600 text-right">
                              {formatMoney(expensesList.reduce((sum, e) => sum + (Number(e.paidAmount) || 0), 0))}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-red-600 text-right">
                              {formatMoney(expensesList.reduce((sum, e) => sum + (Number(e.balanceDue) || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* All Payments */}
              {paymentsList.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">All Payments ({paymentsList.length})</h3>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Payment Number')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Date')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Method')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{tt('Amount')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{tt('Allocated Bills')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paymentsList.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{payment.paymentNumber}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(payment.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{payment.paymentMethodName || payment.paymentMethod || '-'}</td>
                            <td className="px-4 py-2 text-sm text-right text-green-600 font-semibold">{formatMoney(payment.totalAmount)}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {payment.allocations && payment.allocations.length > 0 ? (
                                <div className="space-y-1">
                                  {payment.allocations.map((alloc) => (
                                    <div key={alloc.id} className="text-xs">
                                      {alloc.bill?.billNumber || 'N/A'}: {formatMoney(alloc.amount)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">{tt('No allocations')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {paymentsList.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{tt('Total:')}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-green-600 text-right">
                              {formatMoney(paymentsList.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {billsList.length === 0 && expensesList.length === 0 && paymentsList.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                  <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 font-medium">{tt('No transactions found')}</p>
                  <p className="text-sm text-gray-500 mt-2">{tt('This supplier has no bills, expenses, or payments recorded.')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">{tt('No transaction data available')}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            {tt('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

async function fetchSuppliers(search = "", status = "all") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);
  const res = await fetch(`/api/purchases/suppliers?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load suppliers");
  }
  return res.json();
}

async function bulkUpdateSuppliers(ids, updates) {
  const res = await fetch("/api/purchases/suppliers/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, updates }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update suppliers");
  }
  return res.json();
}

// Bills functions
async function fetchBills(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/bills?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch bills");
  }
  return res.json();
}

async function createBill(payload) {
  const res = await fetch("/api/purchases/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create bill");
  }
  return res.json();
}

async function updateBill(id, payload) {
  const res = await fetch(`/api/purchases/bills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update bill");
  }
  return res.json();
}

async function deleteBill(id) {
  const res = await fetch(`/api/purchases/bills/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to delete bill");
  }
  return res.json();
}

// Orders functions
async function getOrders(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });
  const res = await fetch(`/api/purchases/orders?${searchParams.toString()}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Failed to fetch purchase orders (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function createOrder(payload) {
  const res = await fetch("/api/purchases/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to create purchase order");
  }
  return res.json();
}

async function updateOrder(id, payload) {
  const res = await fetch(`/api/purchases/orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to update purchase order");
  }
  return res.json();
}

async function deleteOrder(id) {
  const res = await fetch(`/api/purchases/orders/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to delete purchase order");
  }
  return res.json();
}

// Receipts functions
async function fetchReceipts(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/receipts?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch receipts");
  return res.json();
}

async function postReceipt(payload) {
  const res = await fetch("/api/purchases/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to post receipt");
  }
  return res.json();
}

// Payments functions
async function fetchPayments(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/payments?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
}

async function createPayment(payload) {
  const res = await fetch("/api/purchases/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create payment");
  }
  return res.json();
}

const statusOptions = ["Draft", "Approved", "Unpaid", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const statusColors = {
  Draft: "bg-gray-100 text-gray-800",
  Approved: "bg-blue-100 text-blue-800",
  Sent: "bg-indigo-100 text-indigo-800",
  "Partially Received": "bg-yellow-100 text-yellow-800",
  Received: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

// Form Section Components
function BillFormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{tt(title)}</h3>
        {description && <p className="text-xs text-gray-500">{tt(description)}</p>}
      </div>
      {children}
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{tt(title)}</h3>
        {description && <p className="text-xs text-gray-500">{tt(description)}</p>}
      </div>
      {children}
    </div>
  );
}

function PaymentFormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{tt(title)}</h3>
        {description && <p className="text-xs text-gray-500">{tt(description)}</p>}
      </div>
      {children}
    </div>
  );
}

function formatProductLabel(product) {
  const code = product.code || product.sku || product.productCode || "";
  const name = product.name || product.productName || "Unnamed Product";
  return code ? `${code} — ${name}` : name;
}

function ProductSearchSelect({
  products = [],
  value,
  onChange,
  placeholder = tt('Search products...'),
  required = false,
}) {
  const containerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value),
    [products, value]
  );

  useEffect(() => {
    if (!open) {
      setSearchTerm(selectedProduct ? formatProductLabel(selectedProduct) : "");
    }
  }, [selectedProduct, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        if (selectedProduct) {
          setSearchTerm(formatProductLabel(selectedProduct));
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return products.slice(0, 50);
    }
    return products
      .filter((product) => formatProductLabel(product).toLowerCase().includes(term))
      .slice(0, 50);
  }, [products, searchTerm]);

  const handleSelect = (product) => {
    onChange?.(product.id);
    setOpen(false);
    setSearchTerm(formatProductLabel(product));
  };

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" value={value || ""} required={required} />
      <input
        type="text"
        value={searchTerm}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{tt('No products found')}</p>
          ) : (
            filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSelect(product)}
              >
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.sku || product.code || "No SKU"} • In stock:{" "}
                    {product.stockLevel ?? product.quantityOnHand ?? "N/A"}
                  </p>
                </div>
                <div className="text-xs font-semibold text-gray-700">
                  MWK{" "}
                  {Number(
                    product.costPrice || product.purchasePrice || product.price || 0
                  ).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const getDefaultProductCost = (product) => {
  if (!product) return 0;
  
  // Helper to convert Decimal/object values to numbers
  const toNumber = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null) {
      // Handle Prisma Decimal type
      return Number(val) || null;
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
  };
  
  // Try multiple fields in order of preference
  // Priority: lastPurchaseCost > cost > averageCost > costPrice > purchasePrice
  const lastPurchaseCost = toNumber(product.lastPurchaseCost);
  const cost = toNumber(product.cost);
  const averageCost = toNumber(product.averageCost);
  const costPrice = toNumber(product.costPrice);
  const purchasePrice = toNumber(product.purchasePrice);
  const unitCost = toNumber(product.unitCost);
  const price = toNumber(product.price);
  
  const value = lastPurchaseCost || cost || averageCost || costPrice || purchasePrice || unitCost || price || 0;
  return value;
};

// Bill Form Component
function BillForm({ suppliers, initialData = null, onSave, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState({
    supplierId: initialData?.supplierId || "",
    billDate: initialData?.billDate
      ? format(new Date(initialData.billDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    dueDate: initialData?.dueDate
      ? format(new Date(initialData.dueDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    status: initialData?.status || "Unpaid",
    billNumber: initialData?.billNumber || "",
    notes: initialData?.notes || "",
    billType: initialData?.billType || "inventory",
  });
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        productId: item.productId || "",
        quantity: Number(item.quantity || item.quantityOrdered || 1),
        unitCost: Number(item.unitCost || 0),
        description: item.description || "",
      }));
    }
    return [{ productId: "", quantity: 1, unitCost: 0, description: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("/api/stock").then((res) => res.json()).then((data) => {
      setProducts(data.products || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      supplierId: initialData.supplierId || "",
      billDate: initialData.billDate
        ? format(new Date(initialData.billDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      dueDate: initialData.dueDate
        ? format(new Date(initialData.dueDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      status: initialData.status || "Unpaid",
      billNumber: initialData.billNumber || "",
      notes: initialData.notes || "",
      billType: initialData.billType || "inventory",
    });
    setItems(
      (initialData.items || []).map((item) => ({
        productId: item.productId || "",
        quantity: Number(item.quantity || item.quantityOrdered || 1),
        unitCost: Number(item.unitCost || 0),
        description: item.description || "",
      }))
    );
  }, [initialData]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            if (!Number(item.unitCost)) {
              updated.unitCost = getDefaultProductCost(product);
            }
            if (!item.description) {
              updated.description = product.description || product.name || "";
            }
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantity: 1, unitCost: 0, description: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        items: items.map(item => ({
          productId: item.productId || null,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost || 0),
          description: item.description || "",
        })),
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
      };
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <BillFormSection title={tt('Bill Details')} description="Supplier and key dates.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {tt('Supplier')} <span className="text-red-500">*</span>
            </label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">{tt('Select supplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Bill Type')}</label>
            <select
              name="billType"
              value={form.billType}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="inventory">{tt('Inventory Purchase')}</option>
              <option value="expense">{tt('Operating Expense')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Bill Number')}</label>
            <input
              type="text"
              name="billNumber"
              value={form.billNumber || ""}
              onChange={handleChange}
              placeholder={tt('Optional reference')}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Bill Date')}</label>
            <input
              type="date"
              name="billDate"
              value={form.billDate}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Due Date')}</label>
            <input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Status')}</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </BillFormSection>

      <BillFormSection title={tt('Line Items')} description="Add products and quantities.">
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-4"
            >
              {form.billType === "inventory" && (
                <ProductSearchSelect
                  products={products}
                  value={item.productId}
                  onChange={(productId) => handleItemChange(idx, "productId", productId)}
                  required
                />
              )}
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantity}
                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                required
                placeholder={tt('Quantity')}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
                placeholder={tt('Order Price')}
              />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK {(Number(item.quantity) * Number(item.unitCost)).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-red-600"
                  >
                    {tt('Remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </BillFormSection>

      <BillFormSection title={tt('Notes & Totals')}>
        <div className="space-y-3">
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder={tt('Extra context, project references, approvals…')}
          />
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700">{tt('Bill Total')}</p>
              <p className="text-sm text-amber-900">{tt('Subtotal excluding taxes')}</p>
            </div>
            <div className="text-lg font-semibold text-amber-900">
              MWK {subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </BillFormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tt('Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? tt('Update Bill') : tt('Save Bill')}
        </button>
      </div>
    </form>
  );
}

// Order Form Component
function OrderForm({ suppliers, products, initialData = null, onSave, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState(() => ({
    supplierId: initialData?.supplierId || "",
    poDate: initialData?.poDate
      ? format(new Date(initialData.poDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    expectedDeliveryDate: initialData?.expectedDeliveryDate
      ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
      : "",
    status: initialData?.status || "Approved",
    notes: initialData?.notes || "",
  }));
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered: String(item.quantityOrdered || ""),
        unitCost: String(item.unitCost || ""),
      }));
    }
    return [{ productId: "", quantityOrdered: "", unitCost: "", description: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      supplierId: initialData.supplierId || "",
      poDate: initialData.poDate
        ? format(new Date(initialData.poDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      expectedDeliveryDate: initialData.expectedDeliveryDate
        ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
        : "",
      status: "Approved", // Always set to Approved, even when editing
      notes: initialData.notes || "",
    });
    setItems(
      (initialData.items || []).map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered: String(item.quantityOrdered || ""),
        unitCost: String(item.unitCost || ""),
      }))
    );
  }, [initialData]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantityOrdered || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            const defaultCost = getDefaultProductCost(product);
            // Always populate cost when product is selected (user can still manually change it)
            if (defaultCost > 0) {
              updated.unitCost = String(defaultCost);
            } else {
              // If no cost found, set to empty string so user can enter manually
              updated.unitCost = "";
            }
            // Also auto-populate description if empty
            if (!updated.description) {
              updated.description = product.description || product.name || "";
            }
          } else {
            // Product not found, clear the cost
            updated.unitCost = "";
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantityOrdered: "", unitCost: "", description: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalizedItems = items.map((item) => ({
        ...item,
        quantityOrdered: Number(item.quantityOrdered || 0),
        unitCost: Number(item.unitCost || 0),
      }));
      // Always set status to Approved when saving
      await onSave({ ...form, status: "Approved", items: normalizedItems });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <FormSection
        title={tt('Order Information')}
        description="Supplier and timing for this purchase request."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {tt('Supplier')} <span className="text-red-500">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.supplierId}
              onChange={(e) => handleChange("supplierId", e.target.value)}
              required
            >
              <option value="">{tt('Select supplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('PO Date *')}</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.poDate}
              onChange={(e) => handleChange("poDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Expected Delivery')}</label>
            <input
              type="date"
              min={form.poDate || undefined}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.expectedDeliveryDate}
              onChange={(e) => handleChange("expectedDeliveryDate", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title={tt('Line Items')}
        description="Each product row drives receiving, costing, and billing."
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 sm:grid-cols-5"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600">{tt('Product')}</label>
                <ProductSearchSelect
                  products={products}
                  value={item.productId}
                  onChange={(productId) => handleItemChange(idx, "productId", productId)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">{tt('Quantity')}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.quantityOrdered}
                  onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">{tt('Order Price')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.unitCost}
                  onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">{tt('Description')}</label>
                <input
                  type="text"
                  placeholder={tt('Optional note')}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK{" "}
                  {(
                    Number(item.quantityOrdered || 0) * Number(item.unitCost || 0)
                  ).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => removeItem(idx)}
                  >
                    {tt('Remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </FormSection>

      <FormSection title={tt('Notes & Totals')} description="Internal instructions and quick totals overview.">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Notes')}</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder={tt('Delivery windows, approvals, offloading instructions…')}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-700">{tt('Subtotal')}</p>
              <p className="text-sm text-indigo-900">{tt('Products × Order Price')}</p>
            </div>
            <div className="text-lg font-semibold text-indigo-900">
              MWK {subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tt('Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? tt('Update Purchase Order') : tt('Save Purchase Order')}
        </button>
      </div>
    </form>
  );
}

// Receipt Form Component
function ReceiptForm({ suppliers, products, purchaseOrders, onSave, onCancel }) {
  const [form, setForm] = useState({
    supplierId: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    purchaseOrderId: "",
    status: "Posted",
    notes: "",
  });
  const [items, setItems] = useState([
    { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState([]);

  const selectedPoForReceipt = useMemo(
    () => purchaseOrders.find((p) => p.id === form.purchaseOrderId) || null,
    [purchaseOrders, form.purchaseOrderId]
  );
  const receiptDateMinStr =
    getPurchaseOrderMinReceiptDateStr(selectedPoForReceipt) ?? undefined;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSupplierChange = (supplierId) => {
    setForm(prev => ({ ...prev, supplierId, purchaseOrderId: "" }));
    setFilteredPurchaseOrders(purchaseOrders.filter(po => po.supplierId === supplierId));
    setItems([{ productId: "", quantityReceived: 1, unitCost: 0, poItemId: null }]);
  };

  const handlePurchaseOrderChange = (poId) => {
    const po = poId ? purchaseOrders.find((p) => p.id === poId) : null;
    const poMin = getPurchaseOrderMinReceiptDateStr(po);
    setForm((prev) => ({
      ...prev,
      purchaseOrderId: poId,
      ...(poMin ? { receiptDate: poMin } : {}),
    }));
    if (poId) {
      if (po && po.items) {
        const pit = Boolean(po.pricesIncludeTax);
        const goodsItems = po.items.filter(
          (line) => line.productId && (line.lineType || "goods") === "goods"
        );
        const openLines = goodsItems.filter((line) => {
          const already = Number(
            line.quantityReceivedEffective ?? line.quantityReceived ?? 0
          );
          const rem = Number(line.quantityOrdered ?? 0) - already;
          return rem > 0;
        });
        if (openLines.length > 0) {
          setItems(
            openLines.map((line) => {
              const ordered = Number(line.quantityOrdered ?? 0);
              const already = Number(
                line.quantityReceivedEffective ?? line.quantityReceived ?? 0
              );
              const remaining = Math.max(0, ordered - already);
              return {
                productId: line.productId,
                poItemId: line.id,
                quantityReceived: remaining > 0 ? remaining : 1,
                unitCost: receiptUnitCostFromPurchaseOrderLine(line, pit),
              };
            })
          );
        } else {
          setItems([
            { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
          ]);
        }
      }
    } else {
      setItems([
        { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
      ]);
    }
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product && (!Number(item.unitCost) || Number(item.unitCost) === 0)) {
            updated.unitCost = getDefaultProductCost(product);
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (selectedPoForReceipt && receiptDateMinStr && form.receiptDate) {
        assertReceiptDateOnOrAfterPurchaseOrder(form.receiptDate, selectedPoForReceipt);
      }
      await onSave({
        ...form,
        receiptType: "inventory",
        status: "Posted",
        items: items.map((row) => ({
          ...row,
          poItemId: row.poItemId || undefined,
        })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <FormSection title={tt('Receipt Details')} description="Supplier, dates, and posting status.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {tt('Supplier')} <span className="text-red-500">*</span>
            </label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">{tt('Select supplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Receipt Date')}</label>
            <input
              type="date"
              name="receiptDate"
              value={form.receiptDate}
              onChange={handleChange}
              min={receiptDateMinStr}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {receiptDateMinStr && selectedPoForReceipt && (
              <p className="mt-1 text-xs text-gray-500">
                Earliest date is the PO order date (
                {format(
                  new Date(selectedPoForReceipt.poDate || selectedPoForReceipt.createdAt),
                  "dd MMM yyyy"
                )}
                ).
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Purchase Order')}</label>
            <select
              name="purchaseOrderId"
              value={form.purchaseOrderId}
              onChange={(e) => handlePurchaseOrderChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">(Optional)</option>
              {filteredPurchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} — {po.supplier?.supplierName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection
        title={tt('Items Received')}
        description="Quantities update product stock levels using weighted cost."
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-4"
            >
              <ProductSearchSelect
                products={products}
                value={item.productId}
                onChange={(productId) => handleItemChange(idx, "productId", productId)}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantityReceived}
                onChange={(e) => handleItemChange(idx, "quantityReceived", e.target.value)}
                required
                placeholder={tt('Quantity')}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
                placeholder={tt('Order Price')}
              />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK{" "}
                  {(
                    Number(item.quantityReceived || 0) * Number(item.unitCost || 0)
                  ).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-red-600"
                  >
                    {tt('Remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </FormSection>

      <FormSection title={tt('Notes')} description="Optional internal notes for this receipt.">
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder={tt('Condition of goods, discrepancies, quality checks…')}
        />
      </FormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tt('Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? tt('Posting...') : tt('Post Receipt')}
        </button>
      </div>
    </form>
  );
}

// Payment Form Component
function PaymentForm({ suppliers, bills, onSave, onCancel, initialSupplierId = "", initialBillAllocations = [] }) {
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  const [form, setForm] = useState({
    supplierId: initialSupplierId || "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState(initialBillAllocations);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Set default payment method when accounts load
  useEffect(() => {
    if (paymentAccounts.length > 0 && !form.paymentMethod) {
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Bank' && acc.isActive) 
        || paymentAccounts.find(acc => acc.isActive) 
        || paymentAccounts[0];
      if (defaultAccount) {
        setForm(prev => ({ ...prev, paymentMethod: defaultAccount.id }));
      }
    }
  }, [paymentAccounts]);

  const supplierBills = useMemo(() => {
    if (!form.supplierId) return [];
    return bills.filter((bill) => {
      const balanceDue = Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
      const supplierId = bill.supplierId || bill.supplier?.id || "";
      return supplierId === form.supplierId && balanceDue > 0;
    });
  }, [form.supplierId, bills]);

  useEffect(() => {
    if (form.supplierId) {
      setAllocations(
        supplierBills.map((bill) => ({
          billId: bill.id,
          amount:
            initialBillAllocations.find((alloc) => alloc.billId === bill.id)?.amount || 0,
        }))
      );
    } else {
      setAllocations([]);
    }
  }, [form.supplierId, supplierBills, initialBillAllocations]);

  useEffect(() => {
    if (initialSupplierId) {
      setForm((prev) => ({ ...prev, supplierId: initialSupplierId }));
    }
    if (initialBillAllocations.length) {
      setAllocations(initialBillAllocations);
    }
  }, [initialSupplierId, initialBillAllocations]);

  const totalAllocations = useMemo(
    () => allocations.reduce((sum, alloc) => sum + Number(alloc.amount || 0), 0),
    [allocations]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        totalAmount: totalAllocations,
        allocations: allocations.filter((alloc) => Number(alloc.amount) > 0),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAllocationChange = (billId, amount) => {
    setAllocations((prev) =>
      prev.map((alloc) => (alloc.billId === billId ? { ...alloc, amount } : alloc))
    );
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <PaymentFormSection title={tt('Payment Details')} description="Who is being paid and how.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Supplier')}</label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">{tt('Select supplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Payment Date')}</label>
            <input
              type="date"
              name="paymentDate"
              value={form.paymentDate}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Payment Method')}</label>
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              disabled={isLoadingPaymentAccounts}
            >
              <option value="">{isLoadingPaymentAccounts ? tt('Loading accounts...') : tt('Select an account')}</option>
              {paymentAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.accountType ? `(${account.accountType})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{tt('Reference')}</label>
            <input
              type="text"
              name="referenceNumber"
              value={form.referenceNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
              placeholder={tt('Optional')}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
      </PaymentFormSection>

      <PaymentFormSection
        title={tt('Allocate to Bills')}
        description="Distribute the payment across outstanding supplier bills."
      >
        {form.supplierId ? (
          <div className="space-y-3">
            {supplierBills.length === 0 ? (
              <p className="text-sm text-gray-500">{tt('No outstanding bills for this supplier.')}</p>
            ) : (
              supplierBills.map((bill) => {
                const balanceDue = Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
                return (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{bill.billNumber}</div>
                      <div className="text-xs text-gray-500">
                        Due {bill.dueDate ? formatDateDDMMYYYY(bill.dueDate) : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Balance MWK {balanceDue.toLocaleString()}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={balanceDue}
                      step="0.01"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={allocations.find((alloc) => alloc.billId === bill.id)?.amount || ""}
                      onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{tt('Select a supplier to allocate payments.')}</p>
        )}
      </PaymentFormSection>

      <PaymentFormSection title={tt('Notes & Total')} description="Optional memo plus total payment amount.">
        <div className="space-y-3">
          <textarea
            name="notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder={tt('Payment memo, cheque details, bank confirmation code…')}
          />
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">{tt('Total Payment')}</p>
              <p className="text-sm text-emerald-900">{tt('Sum of bill allocations')}</p>
            </div>
            <div className="text-lg font-semibold text-emerald-900">
              MWK {totalAllocations.toLocaleString()}
            </div>
          </div>
        </div>
      </PaymentFormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tt('Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || totalAllocations <= 0}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? tt('Saving…') : tt('Record Payment')}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState("suppliers");

  /** POs eligible for new receipts — exclude Received to avoid duplicate goods receipts. */
  const receiptPoStatusFilter = useMemo(
    () => new Set(["Approved", "Sent", "Partially Received"]),
    []
  );
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [activeSupplier, setActiveSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [viewingSupplierTransactions, setViewingSupplierTransactions] = useState(null);
  const [supplierTransactions, setSupplierTransactions] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  // Bills state
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState(null);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billFormMode, setBillFormMode] = useState("create");
  const [activeBill, setActiveBill] = useState(null);
  const [deletingBill, setDeletingBill] = useState(null);
  const [deleteBillLoading, setDeleteBillLoading] = useState(false);
  const [billStatusFilter, setBillStatusFilter] = useState("");
  const [billSupplierFilter, setBillSupplierFilter] = useState("");
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderFormMode, setOrderFormMode] = useState("create");
  const [activeOrder, setActiveOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [deleteOrderLoading, setDeleteOrderLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [businessBrand, setBusinessBrand] = useState({
    name: "Your Business Name",
    tagline: "Purchase Order Receipt",
    address: "Add your business address in settings",
    phone: "+000 000 000 000",
    email: "info@yourbusiness.com",
    logoUrl: null
  });
  
  // Receipts state
  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptStatusFilter, setReceiptStatusFilter] = useState("");
  const [receiptSupplierFilter, setReceiptSupplierFilter] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  
  // Payments state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSupplierFilter, setPaymentSupplierFilter] = useState("");
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [viewingPayment, setViewingPayment] = useState(null);
  
  // View modals state
  const [viewingBill, setViewingBill] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  
  // Export date range state
  const [exportDateRange, setExportDateRange] = useState({
    bills: { startDate: "", endDate: "" },
    orders: { startDate: "", endDate: "" },
    receipts: { startDate: "", endDate: "" },
    payments: { startDate: "", endDate: "" }
  });

  // Handle restock from dashboard - check URL parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const restock = urlParams.get('restock');
    const productId = urlParams.get('productId');
    const tab = urlParams.get('tab');
    
    if (restock === 'true' && productId) {
      // Store product ID in sessionStorage to persist across re-renders
      sessionStorage.setItem('restockProductId', productId);
      
      // Set active tab to orders if specified
      if (tab === 'orders') {
        setActiveTab('orders');
      }
      
      // Clean up URL parameters immediately
      window.history.replaceState({}, '', '/purchases/suppliers');
    }
  }, []); // Run once on mount

  // Handle opening order form with product when products and suppliers are loaded and we're on orders tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeTab !== 'orders') return;
    if (products.length === 0) return;
    if (suppliers.length === 0) return; // Wait for suppliers to be loaded
    if (showOrderForm) return; // Already open, don't reopen
    
    // Check if we came from restock (we stored this in sessionStorage to persist across re-renders)
    const restockProductId = sessionStorage.getItem('restockProductId');
    if (restockProductId) {
      const product = products.find(p => p.id === restockProductId);
      
      if (product) {
        // Open order form with product pre-selected
        setShowOrderForm(true);
        setOrderFormMode('create');
        
        // Set initial data with the product pre-selected
        setActiveOrder({
          items: [{
            productId: product.id,
            quantityOrdered: product.reorderPoint || 10, // Suggest reorder point quantity
            unitCost: product.cost || product.costPrice || 0,
            description: product.description || product.name || ""
          }]
        });
        
        // Clear the sessionStorage
        sessionStorage.removeItem('restockProductId');
      }
    }
  }, [activeTab, products, suppliers, showOrderForm]); // Run when orders tab is active and both products and suppliers are loaded

  // Load suppliers
  useEffect(() => {
    const fetchTenantBrand = async () => {
      try {
        const res = await fetch("/api/tenant/settings");
        if (!res.ok) {
          throw new Error("Failed to load business profile");
        }
        const data = await res.json();
        setBusinessBrand({
          name: data.name || "Your Business Name",
          tagline: "Purchase Order Receipt",
          address: data.businessAddress || "Add your business address in settings",
          phone: data.businessPhone || "+000 000 000 000",
          email: data.businessEmail || data.email || "info@yourbusiness.com",
          logoUrl: data.logoUrl || null
        });
      } catch (error) {
        console.error("Failed to load tenant profile", error);
      }
    };
    fetchTenantBrand();
  }, []);

  // Load suppliers
  useEffect(() => {
    if (activeTab !== "suppliers") return;
    let mounted = true;
    setLoading(true);
    fetchSuppliers(search, statusFilter)
      .then((data) => {
        if (mounted) {
          let sorted = [...(data.suppliers ?? [])];
          
          // Sort suppliers
          sorted.sort((a, b) => {
            let aVal = a[sortBy] || "";
            let bVal = b[sortBy] || "";
            
            // Handle numeric sorting
            if (sortBy === "currentBalance" || sortBy === "paymentTerms") {
              aVal = Number(aVal) || 0;
              bVal = Number(bVal) || 0;
            } else {
              aVal = String(aVal).toLowerCase();
              bVal = String(bVal).toLowerCase();
            }
            
            if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
            if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
            return 0;
          });
          
          setSuppliers(sorted);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, search, statusFilter, sortBy, sortOrder]);

  // Load bills
  useEffect(() => {
    if (activeTab !== "bills") return;
    let mounted = true;
    setBillsLoading(true);
    Promise.all([
      fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
    ])
      .then(([billData, supplierData]) => {
        if (mounted) {
          setBills(billData.bills ?? []);
          setBillsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setBillsError(err.message);
      })
      .finally(() => {
        if (mounted) setBillsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, billStatusFilter, billSupplierFilter]);

  // Load orders
  useEffect(() => {
    if (activeTab !== "orders") return;
    let mounted = true;
    setOrdersLoading(true);
    Promise.all([
      getOrders({ search: orderSearch, status: orderStatusFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/stock").then((res) => res.json()),
    ])
      .then(([orderData, supplierData, productData]) => {
        if (mounted) {
          setOrders(orderData.purchaseOrders ?? []);
          setProducts(productData.products ?? []);
          // Also set suppliers so they're available for the order form
          if (supplierData.suppliers) {
            setSuppliers(supplierData.suppliers ?? []);
          }
          setOrdersError(null);
        }
      })
      .catch((err) => {
        if (mounted) setOrdersError(err.message);
      })
      .finally(() => {
        if (mounted) setOrdersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, orderSearch, orderStatusFilter]);

  // Load receipts
  useEffect(() => {
    if (activeTab !== "receipts") return;
    let mounted = true;
    setReceiptsLoading(true);
    Promise.all([
      fetchReceipts({ status: receiptStatusFilter, supplierId: receiptSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/stock").then((res) => res.json()),
      fetch("/api/purchases/orders?limit=200").then((res) => res.json()),
    ])
      .then(([receiptData, supplierData, productData, poData]) => {
        if (mounted) {
          setReceipts(receiptData.receipts ?? []);
          setProducts(productData.products ?? []);
          const filteredPOs = (poData.purchaseOrders ?? []).filter((po) =>
            receiptPoStatusFilter.has(po.status)
          );
          setPurchaseOrders(filteredPOs);
          setReceiptsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setReceiptsError(err.message);
      })
      .finally(() => {
        if (mounted) setReceiptsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, receiptStatusFilter, receiptSupplierFilter]);

  // Load payments
  useEffect(() => {
    if (activeTab !== "payments") return;
    let mounted = true;
    setPaymentsLoading(true);
    Promise.all([
      fetchPayments({ supplierId: paymentSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/purchases/bills").then((res) => res.json()),
    ])
      .then(([paymentData, supplierData, billData]) => {
        if (mounted) {
          setPayments(paymentData.payments ?? []);
          const outstandingBills =
            billData.bills?.filter(
              (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
            ) ?? [];
          setUnpaidBills(
            outstandingBills.map((bill) => ({
              ...bill,
              balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
              supplierId: bill.supplierId || bill.supplier?.id || "",
            }))
          );
          setPaymentsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setPaymentsError(err.message);
      })
      .finally(() => {
        if (mounted) setPaymentsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, paymentSupplierFilter]);

  useEffect(() => {
    const outstandingBills =
      bills.filter(
        (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
      ) ?? [];
    setUnpaidBills(
      outstandingBills.map((bill) => ({
        ...bill,
        balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
        supplierId: bill.supplierId || bill.supplier?.id || ""
      }))
    );
  }, [bills]);

  const stats = useMemo(() => {
    const count = suppliers.length;
    const totalBalance = suppliers.reduce((sum, supplier) => sum + Number(supplier.currentBalance || 0), 0);
    const active = suppliers.filter((supplier) => supplier.isActive !== false).length;
    return {
      count,
      totalBalance,
      active,
    };
  }, [suppliers]);

  const handleSaveSupplier = async (formData) => {
    if (formMode === "edit" && activeSupplier) {
      await updateSupplier(activeSupplier.id, formData);
    } else {
      const res = await fetch("/api/purchases/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save supplier");
      }
    }
    setShowForm(false);
    setActiveSupplier(null);
    setSearch("");
    // Refresh suppliers list
    refreshSuppliers();
  };

  const refreshSuppliers = async () => {
    try {
      setLoading(true);
      const data = await fetchSuppliers(search, statusFilter);
      let sorted = [...(data.suppliers ?? [])];
      
      // Sort suppliers
      sorted.sort((a, b) => {
        let aVal = a[sortBy] || "";
        let bVal = b[sortBy] || "";
        
        // Handle numeric sorting
        if (sortBy === "currentBalance" || sortBy === "paymentTerms") {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else {
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
      
      setSuppliers(sorted);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setDeleteLoading(true);
    try {
      await deleteSupplier(deletingSupplier.id);
      setDeletingSupplier(null);
      setSearch("");
      refreshSuppliers();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedSuppliers.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const updates = action === "activate" ? { isActive: true } : { isActive: false };
      await bulkUpdateSuppliers(Array.from(selectedSuppliers), updates);
      setSelectedSuppliers(new Set());
      setSearch("");
      refreshSuppliers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedSuppliers(new Set(suppliers.map(s => s.id)));
    } else {
      setSelectedSuppliers(new Set());
    }
  };

  const handleSelectSupplier = (id) => {
    const newSelected = new Set(selectedSuppliers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSuppliers(newSelected);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Bills handlers
  const billsStats = useMemo(() => {
    const total = bills.length;
    const unpaid = bills.filter((bill) => bill.status === "Unpaid" || bill.status === "Partially Paid").length;
    const overdue = bills.filter((bill) => bill.status === "Overdue").length;
    const outstanding = bills.reduce(
      (sum, bill) => sum + (Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0)),
      0
    );
    return { total, unpaid, overdue, outstanding };
  }, [bills]);

  const handleSaveBill = async (payload) => {
    if (billFormMode === "edit" && activeBill) {
      await updateBill(activeBill.id, payload);
    } else {
      await createBill(payload);
    }
    setShowBillForm(false);
    setActiveBill(null);
    // Reload bills
    const billData = await fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter });
    setBills(billData.bills ?? []);
  };

  const handleDeleteBill = async () => {
    if (!deletingBill) return;
    setDeleteBillLoading(true);
    try {
      await deleteBill(deletingBill.id);
      setDeletingBill(null);
      const billData = await fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter });
      setBills(billData.bills ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteBillLoading(false);
    }
  };

  // Orders handlers
  const ordersStats = useMemo(() => {
    const total = orders.length;
    const awaitingApproval = orders.filter((order) => order.status === "Draft").length;
    const awaitingReceipt = orders.filter((order) => order.status === "Approved" || order.status === "Sent").length;
    const openAmount = orders
      .filter((order) => order.status !== "Cancelled" && order.status !== "Received")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    return { total, awaitingApproval, awaitingReceipt, openAmount };
  }, [orders]);

  const handleSaveOrder = async (payload) => {
    if (orderFormMode === "edit" && activeOrder) {
      await updateOrder(activeOrder.id, payload);
    } else {
      await createOrder(payload);
    }
    setShowOrderForm(false);
    setActiveOrder(null);
    // Reload orders
    const orderData = await getOrders({ search: orderSearch, status: orderStatusFilter });
    setOrders(orderData.purchaseOrders ?? []);
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setDeleteOrderLoading(true);
    try {
      await deleteOrder(deletingOrder.id);
      setDeletingOrder(null);
      const orderData = await getOrders({ search: orderSearch, status: orderStatusFilter });
      setOrders(orderData.purchaseOrders ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteOrderLoading(false);
    }
  };

  const handlePreviewOrder = (order) => {
    setPreviewOrder(order);
    setShowOrderPreview(true);
  };

  // Export helper functions
  const handleExport = async (type, itemId = null) => {
    try {
      const dateRange = exportDateRange[type];
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange.endDate) params.set('endDate', dateRange.endDate);
      if (itemId) params.set('id', itemId);
      
      const url = `/api/purchases/${type}/export?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    }
  };

  const handleExportOrderPreview = () => {
    if (!previewOrder) return;

    const itemsRows = (previewOrder.items || [])
      .map(
        (item, index) => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${item.product?.name || item.description || "Product"}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${Number(item.quantityOrdered || 0).toLocaleString()}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoney(item.unitCost)}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoney(Number(item.quantityOrdered || 0) * Number(item.unitCost || 0))}</td>
        </tr>`
      )
      .join("");

    const logoUrl = businessBrand.logoUrl
      ? businessBrand.logoUrl.startsWith("http")
        ? businessBrand.logoUrl
        : `${window.location.origin}${businessBrand.logoUrl}`
      : null;

    const exportWindow = window.open("", "_blank");
    exportWindow.document.write(`
      <html>
        <head>
          <title>${previewOrder.poNumber} - Purchase Order</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h2 { margin-top: 32px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #f3f4f6; text-align: left; padding: 8px; border:1px solid #e5e7eb; }
            td { padding: 8px; border:1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:16px;">
              ${
                logoUrl
                  ? `<div style="height:64px;width:64px;border:1px solid #e5e7eb;border-radius:16px;padding:6px;display:flex;align-items:center;justify-content:center;">
                      <img src="${logoUrl}" alt={tt('Logo')} style="max-height:100%;max-width:100%;object-fit:contain;" />
                    </div>`
                  : ""
              }
              <div>
                <h1 style="margin:0;font-size:20px;color:#111827;">${businessBrand.name}</h1>
                <p style="margin:2px 0;color:#6b7280;font-size:12px;">${businessBrand.address}</p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">${businessBrand.phone} • ${businessBrand.email}</p>
              </div>
            </div>
            <div style="text-align:right;">
              <p style="text-transform:uppercase;font-size:10px;color:#6b7280;margin:0;">{tt('Document')}</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#111827;">${businessBrand.tagline}</p>
              <p style="margin:4px 0 0;color:#374151;font-size:16px;">${previewOrder.poNumber}</p>
            </div>
          </div>

          <p><strong>{tt('Supplier:')}</strong> ${previewOrder.supplier?.supplierName || "-"}</p>
          <p><strong>{tt('PO Date:')}</strong> ${
            previewOrder.poDate ? formatDateDDMMYYYY(previewOrder.poDate) : "-"
          }</p>
          <p><strong>{tt('Status:')}</strong> ${previewOrder.status}</p>
          <p><strong>{tt('Total Amount:')}</strong> ${formatMoney(previewOrder.totalAmount)}</p>
          <h2 style="margin-top:32px;">{tt('Line Items')}</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{tt('Product')}</th>
                <th style="text-align:right;">{tt('Qty Ordered')}</th>
                <th style="text-align:right;">{tt('Order Price')}</th>
                <th style="text-align:right;">{tt('Line Total')}</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || `<tr><td colspan="5" style="padding:8px;border:1px solid #e5e7eb;text-align:center;">{tt('No items available')}</td></tr>`}
            </tbody>
          </table>
          
          ${
            previewOrder.notes
              ? `<h2 style="margin-top:32px;">{tt('Notes')}</h2>
                <div style="padding:12px;border:1px dashed #d1d5db;border-radius:8px;background:#f9fafb;">
                  ${previewOrder.notes}
                </div>`
              : ""
          }
        </body>
      </html>
    `);
    exportWindow.document.close();
    exportWindow.focus();
    exportWindow.print();
    exportWindow.close();
  };

  // Receipts handlers
  const receiptsStats = useMemo(() => {
    const total = receipts.length;
    const draft = receipts.filter((receipt) => receipt.status === "Draft").length;
    const posted = receipts.filter((receipt) => receipt.status === "Posted").length;
    const inventoryValue = receipts
      .filter((receipt) => receipt.status === "Posted")
      .reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
    return { total, draft, posted, inventoryValue };
  }, [receipts]);

  const handleSaveReceipt = async (payload) => {
    await postReceipt(payload);
    setShowReceiptForm(false);
    // Reload receipts
    const receiptData = await fetchReceipts({ status: receiptStatusFilter, supplierId: receiptSupplierFilter });
    setReceipts(receiptData.receipts ?? []);
  };

  // Payments handlers
  const paymentsStats = useMemo(() => {
    const total = payments.length;
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0);
    return { total, totalPaid };
  }, [payments]);

  const [pendingPaymentPrefill, setPendingPaymentPrefill] = useState(null);

  const handleSavePayment = async (payload) => {
    await createPayment(payload);
    setShowPaymentForm(false);
    setPendingPaymentPrefill(null);
    // Reload payments
    const paymentData = await fetchPayments({ supplierId: paymentSupplierFilter });
    setPayments(paymentData.payments ?? []);
    // Reload unpaid bills
    const billData = await fetch("/api/purchases/bills").then((res) => res.json());
    const outstandingBills =
      billData.bills?.filter(
        (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
      ) ?? [];
    setUnpaidBills(
      outstandingBills.map((bill) => ({
        ...bill,
        balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
        supplierId: bill.supplierId || bill.supplier?.id || "",
      }))
    );
    setBills(billData.bills ?? []);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{tt('Supplier Management')}</h1>
          <p className="text-sm text-gray-500">{tt('Manage your suppliers.')}</p>
        </div>
        <button
            onClick={() => {
              setFormMode("create");
              setActiveSupplier(null);
              setShowForm(true);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {tt('Add Supplier')}
          </button>
      </div>

      <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Suppliers" value={stats.count} />
            <StatCard label="Active Suppliers" value={stats.active} />
            <StatCard
              label="Total Balance"
              value={`MWK ${stats.totalBalance.toLocaleString()}`}
              helper="Summed current balances"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 ">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tt('Search by name, code, email, or phone...')}
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">{tt('All Suppliers')}</option>
            <option value="active">{tt('Active Only')}</option>
            <option value="inactive">{tt('Inactive Only')}</option>
          </select>
          <button
            onClick={refreshSuppliers}
            disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title={tt('Refresh supplier list')}
          >
            {loading ? "Refreshing..." : "🔄"}
          </button>
        </div>

        {selectedSuppliers.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-indigo-50 p-3">
            <span className="text-sm font-medium text-indigo-900">
              {selectedSuppliers.size} supplier{selectedSuppliers.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction("activate")}
                disabled={bulkActionLoading}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {tt('Activate')}
              </button>
              <button
                onClick={() => handleBulkAction("deactivate")}
                disabled={bulkActionLoading}
                className="rounded-md bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {tt('Deactivate')}
              </button>
              <button
                onClick={() => setSelectedSuppliers(new Set())}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {tt('Clear')}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">{tt('Loading suppliers…')}</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-500">{tt('No suppliers found.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.size === suppliers.length && suppliers.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("supplierCode")}
                  >
                    <div className="flex items-center gap-1">
                      Code
                      {sortBy === "supplierCode" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("supplierName")}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === "supplierName" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tt('Contact')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tt('Phone')}
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("paymentTerms")}
                  >
                    <div className="flex items-center gap-1">
                      Payment Terms
                      {sortBy === "paymentTerms" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("currentBalance")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Balance Owed
                      {sortBy === "currentBalance" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("isActive")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === "isActive" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tt('Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm">
                {suppliers.map((supplier) => (
                  <tr 
                    key={supplier.id}
                    className={selectedSuppliers.has(supplier.id) ? "bg-indigo-50" : ""}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.has(supplier.id)}
                        onChange={() => handleSelectSupplier(supplier.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs text-gray-600">{supplier.supplierCode}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-gray-900">{supplier.supplierName}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.phone || supplier.mobile || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.paymentTerms ?? 30} days
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="font-semibold text-gray-900">
                        {formatMoney(supplier.currentBalance || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {supplier._count?.supplierBills || 0} bills, {supplier._count?.expenses || 0} expenses
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        supplier.isActive !== false 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {supplier.isActive !== false ? tt('Active') : tt('Inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          onClick={async () => {
                            setViewingSupplierTransactions(supplier);
                            setLoadingTransactions(true);
                            setSupplierTransactions(null);
                            try {
                              const res = await fetch(`/api/purchases/suppliers/${supplier.id}/transactions`);
                              if (res.ok) {
                                const data = await res.json();
                                setSupplierTransactions(data);
                              } else {
                                const errorData = await res.json().catch(() => ({}));
                                console.error('Error fetching transactions:', errorData.error);
                                alert(`Error: ${errorData.error || 'Failed to fetch transactions'}`);
                                setViewingSupplierTransactions(null);
                              }
                            } catch (err) {
                              console.error('Error fetching transactions:', err);
                              alert(`Error: ${err.message || 'Failed to fetch transactions'}`);
                              setViewingSupplierTransactions(null);
                            } finally {
                              setLoadingTransactions(false);
                            }
                          }}
                          title={tt('View all transactions')}
                        >
                          <Eye size={14} className="inline mr-1" />
                          {tt('View')}
                        </button>
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          onClick={() => {
                            setFormMode("edit");
                            setActiveSupplier(supplier);
                            setShowForm(true);
                          }}
                        >
                          {tt('Edit')}
                        </button>
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingSupplier(supplier)}
                        >
                          {tt('Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>
      </>

      {activeTab === "receipts" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Receipts" value={receiptsStats.total} helper="All statuses" />
            <StatCard label="Draft" value={receiptsStats.draft} />
            <StatCard label="Posted" value={receiptsStats.posted} />
            <StatCard
              label="Posted Inventory"
              value={`MWK ${receiptsStats.inventoryValue.toLocaleString()}`}
              helper="Added to stock"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tt('Goods Receipts')}</h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
                  <Calendar size={16} className="text-gray-500" />
                  <input
                    type="date"
                    value={exportDateRange.receipts.startDate}
                    onChange={(e) => setExportDateRange(prev => ({
                      ...prev,
                      receipts: { ...prev.receipts, startDate: e.target.value }
                    }))}
                    className="text-xs border-0 focus:ring-0"
                    placeholder={tt('From')}
                  />
                  <span className="text-gray-400">{tt('to')}</span>
                  <input
                    type="date"
                    value={exportDateRange.receipts.endDate}
                    onChange={(e) => setExportDateRange(prev => ({
                      ...prev,
                      receipts: { ...prev.receipts, endDate: e.target.value }
                    }))}
                    className="text-xs border-0 focus:ring-0"
                    placeholder={tt('To')}
                  />
                  <button
                    onClick={() => handleExport('receipts')}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <Download size={14} />
                    {tt('Export')}
                  </button>
                </div>
                <button
                  onClick={() => setShowReceiptForm(true)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {tt('Receive Goods')}
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={receiptSupplierFilter}
                onChange={(e) => setReceiptSupplierFilter(e.target.value)}
              >
                <option value="">{tt('All Suppliers')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={receiptStatusFilter}
                onChange={(e) => setReceiptStatusFilter(e.target.value)}
              >
                <option value="">{tt('All Statuses')}</option>
                <option value="Draft">{tt('Draft')}</option>
                <option value="Posted">{tt('Posted')}</option>
              </select>
            </div>

            {receiptsLoading ? (
              <p className="text-sm text-gray-500">{tt('Loading receipts…')}</p>
            ) : receiptsError ? (
              <p className="text-sm text-red-500">{receiptsError}</p>
            ) : receipts.length === 0 ? (
              <p className="text-sm text-gray-500">{tt('No goods receipts found.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Receipt #')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Supplier')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Date')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Status')}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Amount')}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {receipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {receipt.receiptNumber}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {receipt.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            PO {receipt.purchaseOrder?.poNumber ?? "-"}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {receipt.receiptDate
                            ? formatDateDDMMYYYY(receipt.receiptDate)
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              receipt.status === "Posted"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {receipt.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(receipt.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            onClick={() => setViewingReceipt(receipt)}
                          >
                            {tt('View')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "payments" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Payments Recorded" value={paymentsStats.total} />
            <StatCard label="Total Disbursed" value={`MWK ${paymentsStats.totalPaid.toLocaleString()}`} />
            <StatCard
              label="This Month"
              value={`MWK ${payments
                .filter((payment) => {
                  if (!payment.paymentDate) return false;
                  const date = new Date(payment.paymentDate);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                })
                .reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0)
                .toLocaleString()}`}
            />
            <StatCard
              label="Average Payment"
              value={`MWK ${(paymentsStats.totalPaid / (paymentsStats.total || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tt('Supplier Payments')}</h2>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
                  <Calendar size={16} className="text-gray-500" />
                  <input
                    type="date"
                    value={exportDateRange.payments.startDate}
                    onChange={(e) => setExportDateRange(prev => ({
                      ...prev,
                      payments: { ...prev.payments, startDate: e.target.value }
                    }))}
                    className="text-xs border-0 focus:ring-0"
                    placeholder={tt('From')}
                  />
                  <span className="text-gray-400">{tt('to')}</span>
                  <input
                    type="date"
                    value={exportDateRange.payments.endDate}
                    onChange={(e) => setExportDateRange(prev => ({
                      ...prev,
                      payments: { ...prev.payments, endDate: e.target.value }
                    }))}
                    className="text-xs border-0 focus:ring-0"
                    placeholder={tt('To')}
                  />
                  <button
                    onClick={() => handleExport('payments')}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <Download size={14} />
                    {tt('Export')}
                  </button>
                </div>
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {tt('Record Payment')}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={paymentSupplierFilter}
                onChange={(e) => setPaymentSupplierFilter(e.target.value)}
              >
                <option value="">{tt('All Suppliers')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>

            {paymentsLoading ? (
              <p className="text-sm text-gray-500">{tt('Loading payments…')}</p>
            ) : paymentsError ? (
              <p className="text-sm text-red-500">{paymentsError}</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-gray-500">{tt('No supplier payments recorded.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Payment #')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Supplier')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Date')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Method')}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Amount')}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        {tt('Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{payment.paymentNumber}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {payment.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.allocations?.length || 0} bill{payment.allocations?.length !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {payment.paymentDate ? formatDateDDMMYYYY(payment.paymentDate) : "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{payment.paymentMethodName || payment.paymentMethod}</td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(payment.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => setViewingPayment(payment)}
                            className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            {tt('View')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showOrderPreview && previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="relative border-b bg-gray-50 px-6 py-6">
              <button
                onClick={() => {
                  setShowOrderPreview(false);
                  setPreviewOrder(null);
                }}
                className="absolute right-4 top-4 text-gray-500 transition hover:text-gray-700"
                aria-label={tt('Close preview')}
              >
                ✕
              </button>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {businessBrand.logoUrl && (
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-indigo-100 bg-white p-2">
                    <Image
                      src={businessBrand.logoUrl}
                      alt={`${businessBrand.name} logo`}
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className={businessBrand.logoUrl ? "" : "pl-0"}>
                    <p className="text-lg font-semibold text-gray-900">
                      {businessBrand.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {businessBrand.address}
                    </p>
                    <p className="text-xs text-gray-400">
                      {businessBrand.phone} • {businessBrand.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {tt('Document')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {businessBrand.tagline}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {previewOrder.poNumber}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase text-gray-500 tracking-wide">
            {tt('Supplier Details')}
          </p>
          <div className="mt-2 text-sm">
            <p className="font-semibold text-gray-900">
              {previewOrder.supplier?.supplierName || "—"}
            </p>
            <p className="text-gray-500">
              Code: {previewOrder.supplier?.supplierCode || "—"}
            </p>
            <p className="text-gray-500">
              Email: {previewOrder.supplier?.email || "—"}
            </p>
            <p className="text-gray-500">
              Phone: {previewOrder.supplier?.phone || previewOrder.supplier?.mobile || "—"}
            </p>
          </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase text-gray-500 tracking-wide">
            {tt('Order Details')}
          </p>
          <div className="mt-2 text-sm text-gray-900 space-y-1">
            <p>
              <span className="text-gray-500">{tt('PO Date:')}</span>{" "}
              {previewOrder.poDate
                ? formatDateDDMMYYYY(previewOrder.poDate)
                : "—"}
            </p>
            <p>
              <span className="text-gray-500">{tt('Expected Delivery:')}</span>{" "}
              {previewOrder.expectedDeliveryDate
                ? formatDateDDMMYYYY(previewOrder.expectedDeliveryDate)
                : "—"}
            </p>
            <p>
              <span className="text-gray-500">{tt('Payment Terms:')}</span>{" "}
              {previewOrder.paymentTerms
                ? `${previewOrder.paymentTerms} days`
                : "—"}
            </p>
          </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">{tt('Status')}</p>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[previewOrder.status] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {previewOrder.status}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">{tt('Total Amount')}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatMoney(previewOrder.totalAmount)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {tt('Line Items')}
                  </h3>
                </div>
                <div className="mt-2 overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">{tt('Product')}</th>
                        <th className="px-4 py-2 text-right">{tt('Qty Ordered')}</th>
                        <th className="px-4 py-2 text-right">{tt('Order Price')}</th>
                        <th className="px-4 py-2 text-right">{tt('Line Total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewOrder.items?.length ? (
                        previewOrder.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-gray-900">
                              {item.product?.name || item.description || "Product"}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {Number(item.quantityOrdered || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {formatMoney(item.unitCost)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">
                              {formatMoney(
                                Number(item.quantityOrdered || 0) *
                                  Number(item.unitCost || 0)
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-4 py-4 text-center text-gray-500"
                            colSpan={4}
                          >
                            {tt('No items available')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  {tt('Notes')}
                </p>
                <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 min-h-[80px]">
                  {previewOrder.notes || "No additional notes provided for this purchase order."}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowOrderPreview(false);
                  setPreviewOrder(null);
                }}
              >
                {tt('Close')}
              </button>
              <button
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                onClick={handleExportOrderPreview}
              >
                {tt('Export')}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white ">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{viewingPayment.paymentNumber}</h2>
                <p className="text-sm text-gray-500">
                  {viewingPayment.supplier?.supplierName ?? "—"} •{" "}
                  {viewingPayment.paymentDate ? formatDateDDMMYYYY(viewingPayment.paymentDate) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('payments', viewingPayment.id)}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <Download size={14} />
                  {tt('Export')}
                </button>
                <button onClick={() => setViewingPayment(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Payment Method')}</div>
                  <div className="mt-1 text-gray-900">{viewingPayment.paymentMethodName || viewingPayment.paymentMethod}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Reference')}</div>
                  <div className="mt-1 text-gray-900">{viewingPayment.referenceNumber || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Total Amount')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number(viewingPayment.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Allocations')}</div>
                  <div className="mt-1 text-gray-900">{viewingPayment.allocations?.length ?? 0}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700">{tt('Bill Allocations')}</h3>
                <div className="mt-2 overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">{tt('Bill')}</th>
                        <th className="px-4 py-2 text-right">{tt('Allocated')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {viewingPayment.allocations?.length ? (
                        viewingPayment.allocations.map((allocation) => (
                          <tr key={allocation.id}>
                            <td className="px-4 py-2 text-gray-900">
                              {allocation.bill?.billNumber ?? allocation.billId}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900">
                              MWK {Number(allocation.amountAllocated || allocation.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-2 text-gray-500" colSpan={2}>
                            {tt('No allocations recorded.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white ">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{viewingBill.billNumber}</h2>
                <p className="text-sm text-gray-500">
                  {viewingBill.supplier?.supplierName ?? "—"} •{" "}
                  {viewingBill.billDate ? formatDateDDMMYYYY(viewingBill.billDate) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('bills', viewingBill.id)}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <Download size={14} />
                  {tt('Export')}
                </button>
                <button onClick={() => setViewingBill(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Supplier')}</div>
                  <div className="mt-1 text-gray-900">{viewingBill.supplier?.supplierName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Bill Date')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingBill.billDate ? formatDateDDMMYYYY(viewingBill.billDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Due Date')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingBill.dueDate ? formatDateDDMMYYYY(viewingBill.dueDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Status')}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        viewingBill.status === "Paid"
                          ? "bg-green-100 text-green-800"
                          : viewingBill.status === "Overdue"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {viewingBill.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Total Amount')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number(viewingBill.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Amount Paid')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number(viewingBill.amountPaid || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Balance')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number((Number(viewingBill.totalAmount || 0) - Number(viewingBill.amountPaid || 0))).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Supplier Invoice #')}</div>
                  <div className="mt-1 text-gray-900">{viewingBill.supplierInvoiceNumber || "—"}</div>
                </div>
              </div>
              {viewingBill.notes && (
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Notes')}</div>
                  <div className="mt-1 text-gray-900">{viewingBill.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white ">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{viewingOrder.poNumber}</h2>
                <p className="text-sm text-gray-500">
                  {viewingOrder.supplier?.supplierName ?? "—"} •{" "}
                  {viewingOrder.poDate ? formatDateDDMMYYYY(viewingOrder.poDate) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('orders', viewingOrder.id)}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <Download size={14} />
                  {tt('Export')}
                </button>
                <button onClick={() => setViewingOrder(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Supplier')}</div>
                  <div className="mt-1 text-gray-900">{viewingOrder.supplier?.supplierName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('PO Date')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingOrder.poDate ? formatDateDDMMYYYY(viewingOrder.poDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Expected Delivery')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingOrder.expectedDeliveryDate ? formatDateDDMMYYYY(viewingOrder.expectedDeliveryDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Status')}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        statusColors[viewingOrder.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {viewingOrder.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Total Amount')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number(viewingOrder.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Payment Terms')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingOrder.paymentTerms ? `${viewingOrder.paymentTerms} days` : "—"}
                  </div>
                </div>
              </div>
              {viewingOrder.items && viewingOrder.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{tt('Items')}</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">{tt('Product')}</th>
                          <th className="px-4 py-2 text-right">{tt('Quantity')}</th>
                          <th className="px-4 py-2 text-right">{tt('Selling Price')}</th>
                          <th className="px-4 py-2 text-right">{tt('Total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {viewingOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-gray-900">{item.productName || item.name || "—"}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{item.quantity || 0}</td>
                            <td className="px-4 py-2 text-right text-gray-900">
                              MWK {Number(item.unitPrice || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900">
                              MWK {Number((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {viewingOrder.notes && (
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Notes')}</div>
                  <div className="mt-1 text-gray-900">{viewingOrder.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white ">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{viewingReceipt.receiptNumber}</h2>
                <p className="text-sm text-gray-500">
                  {viewingReceipt.supplier?.supplierName ?? "—"} •{" "}
                  {viewingReceipt.receiptDate ? formatDateDDMMYYYY(viewingReceipt.receiptDate) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('receipts', viewingReceipt.id)}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <Download size={14} />
                  {tt('Export')}
                </button>
                <button onClick={() => setViewingReceipt(null)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Supplier')}</div>
                  <div className="mt-1 text-gray-900">{viewingReceipt.supplier?.supplierName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Receipt Date')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingReceipt.receiptDate ? formatDateDDMMYYYY(viewingReceipt.receiptDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Purchase Order')}</div>
                  <div className="mt-1 text-gray-900">
                    {viewingReceipt.purchaseOrder?.poNumber || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Status')}</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        viewingReceipt.status === "Posted"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {viewingReceipt.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">{tt('Total Amount')}</div>
                  <div className="mt-1 text-gray-900">
                    MWK {Number(viewingReceipt.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              {viewingReceipt.items && viewingReceipt.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{tt('Items Received')}</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-2">{tt('Product')}</th>
                          <th className="px-4 py-2 text-right">{tt('Quantity')}</th>
                          <th className="px-4 py-2 text-right">{tt('Selling Price')}</th>
                          <th className="px-4 py-2 text-right">{tt('Total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {viewingReceipt.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-gray-900">{item.productName || item.name || "—"}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{item.quantityReceived || item.quantity || 0}</td>
                            <td className="px-4 py-2 text-right text-gray-900">
                              MWK {Number(item.unitPrice || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900">
                              MWK {Number((item.quantityReceived || item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 ">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formMode === "edit" ? tt('Edit Supplier') : tt('New Supplier')}
                </h2>
                {formMode === "edit" && (
                  <p className="text-xs text-gray-500">{activeSupplier?.supplierCode}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setActiveSupplier(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <SupplierForm
              initialData={formMode === "edit" ? activeSupplier : undefined}
              onSave={handleSaveSupplier}
              onCancel={() => {
                setShowForm(false);
                setActiveSupplier(null);
              }}
            />
          </div>
        </div>
      )}

      {deletingSupplier && (
        <ConfirmDialog
          title={tt('Delete Supplier')}
          message={`Are you sure you want to delete ${deletingSupplier.supplierName}?`}
          onConfirm={handleDeleteSupplier}
          onCancel={() => setDeletingSupplier(null)}
          loading={deleteLoading}
        />
      )}

      {deletingOrder && (
        <ConfirmDialog
          title={tt('Delete Purchase Order')}
          message={`Are you sure you want to delete ${deletingOrder.poNumber}?`}
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeletingOrder(null)}
          loading={deleteOrderLoading}
        />
      )}

      {/* Bill Form Modal */}
      {showBillForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {billFormMode === "edit" ? tt('Edit Bill') : tt('New Supplier Bill')}
              </h2>
              <button
                onClick={() => {
                  setShowBillForm(false);
                  setActiveBill(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <BillForm
              suppliers={suppliers}
              initialData={billFormMode === "edit" ? activeBill : null}
              onSave={handleSaveBill}
              onCancel={() => {
                setShowBillForm(false);
                setActiveBill(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Order Form Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {orderFormMode === "edit" ? tt('Edit Purchase Order') : tt('New Purchase Order')}
              </h2>
              <button
                onClick={() => {
                  setShowOrderForm(false);
                  setActiveOrder(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <OrderForm
              suppliers={suppliers}
              products={products}
              initialData={orderFormMode === "edit" ? activeOrder : (activeOrder?.items ? activeOrder : null)}
              onSave={handleSaveOrder}
              onCancel={() => {
                setShowOrderForm(false);
                setActiveOrder(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Receipt Form Modal */}
      {showReceiptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tt('New Goods Receipt')}</h2>
              <button
                onClick={() => setShowReceiptForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptForm
              suppliers={suppliers}
              products={products}
              purchaseOrders={purchaseOrders}
              onSave={handleSaveReceipt}
              onCancel={() => setShowReceiptForm(false)}
            />
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tt('New Supplier Payment')}</h2>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              suppliers={suppliers}
              bills={unpaidBills}
              onSave={handleSavePayment}
              onCancel={() => {
                setShowPaymentForm(false);
                setPendingPaymentPrefill(null);
              }}
              initialSupplierId={pendingPaymentPrefill?.supplierId}
              initialBillAllocations={pendingPaymentPrefill?.allocations || []}
            />
          </div>
        </div>
      )}

      {/* Supplier Transactions Modal */}
      {viewingSupplierTransactions && (
        <SupplierTransactionsModal
          supplier={viewingSupplierTransactions}
          transactions={supplierTransactions}
          loading={loadingTransactions}
          onClose={() => {
            setViewingSupplierTransactions(null);
            setSupplierTransactions(null);
          }}
        />
      )}
    </div>
  );
}

