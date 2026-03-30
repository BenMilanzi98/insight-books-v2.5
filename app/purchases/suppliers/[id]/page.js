"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const formatMoney = (value) => `MWK ${Number(value || 0).toLocaleString()}`;

export default function SupplierLedgerPage() {
  const params = useParams();
  const rawId = params?.id;
  const supplierId = Array.isArray(rawId) ? rawId[0] : rawId ?? null;
  const [supplier, setSupplier] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supplierId) {
      setError("Supplier ID is missing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/purchases/suppliers/${supplierId}/transactions`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Supplier not found" : "Failed to load ledger");
        return res.json();
      })
      .then((data) => {
        setSupplier(data.supplier || { id: supplierId, supplierName: "Supplier", supplierCode: "" });
        setTransactions(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const summary = transactions?.summary || {};
  const bills = summary.bills || {};
  const expenses = summary.expenses || {};
  const payments = summary.payments || {};
  const billsList = transactions?.bills || [];
  const expensesList = transactions?.expenses || [];
  const paymentsList = transactions?.payments || [];

  if (loading && !supplier) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          Loading supplier ledger…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-white p-8">
          <p className="text-red-600">{error}</p>
          <Link
            href="/purchases/suppliers"
            className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:underline"
          >
            <ArrowLeft size={16} /> Back to Suppliers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/purchases/suppliers"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft size={18} /> Back to Suppliers
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {supplier?.supplierName || "Supplier Ledger"}
              </h1>
              <p className="text-sm text-gray-600">
                Code: {supplier?.supplierCode || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">
              Loading transactions…
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <DollarSign size={16} className="text-indigo-600" />
                    Total Owed
                  </div>
                  <div className="mt-2 text-2xl font-bold text-red-600">
                    {formatMoney(summary.totalOwed || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills + Expenses outstanding
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <FileText size={16} className="text-blue-600" />
                    Total Billed
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">
                    {formatMoney(summary.totalBilled || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills: {formatMoney(bills.totalBillsAmount || 0)} + Expenses: {formatMoney(expenses.totalExpensesAmount || 0)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <TrendingDown size={16} className="text-green-600" />
                    Total Paid
                  </div>
                  <div className="mt-2 text-2xl font-bold text-green-600">
                    {formatMoney(summary.totalPaid || 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Bills + Expenses paid
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <TrendingUp size={16} className="text-orange-600" />
                    Current Balance
                  </div>
                  <div className="mt-2 text-2xl font-bold text-orange-600">
                    {formatMoney(summary.currentBalance ?? supplier?.currentBalance ?? 0)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    From supplier record
                  </div>
                </div>
              </div>

              {/* Bills */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Receipt size={20} className="text-indigo-600" />
                    Bills ({billsList.length})
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-lg font-semibold text-gray-900">{bills.totalBills ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Amount</div>
                      <div className="text-lg font-semibold text-gray-900">{formatMoney(bills.totalBillsAmount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Paid</div>
                      <div className="text-lg font-semibold text-green-600">{formatMoney(bills.totalBillsPaid)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Outstanding</div>
                      <div className="text-lg font-semibold text-red-600">{formatMoney(bills.billsOutstanding)}</div>
                    </div>
                  </div>
                  {billsList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Bill #</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Paid</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Balance</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {billsList.map((bill) => (
                            <tr key={bill.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{bill.billNumber}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">{formatMoney(bill.totalAmount)}</td>
                              <td className="px-4 py-2 text-sm text-right text-green-600">{formatMoney(bill.amountPaid)}</td>
                              <td className="px-4 py-2 text-sm text-right text-red-600 font-semibold">{formatMoney(bill.balanceDue)}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  bill.status === "Paid" ? "bg-green-100 text-green-800" :
                                  bill.status === "Partially Paid" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {bill.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No bills</p>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Expenses ({expensesList.length})
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-lg font-semibold text-gray-900">{expenses.totalExpenses ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Amount</div>
                      <div className="text-lg font-semibold text-gray-900">{formatMoney(expenses.totalExpensesAmount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Paid</div>
                      <div className="text-lg font-semibold text-green-600">{formatMoney(expenses.totalExpensesPaid)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Outstanding</div>
                      <div className="text-lg font-semibold text-red-600">{formatMoney(expenses.expensesOutstanding)}</div>
                    </div>
                  </div>
                  {expensesList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Paid</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {expensesList.map((exp) => (
                            <tr key={exp.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{exp.description || "—"}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {exp.date ? new Date(exp.date).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">{formatMoney(exp.amount)}</td>
                              <td className="px-4 py-2 text-sm text-right text-green-600">{formatMoney(exp.paidAmount)}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  exp.paymentStatus === "Fully paid" ? "bg-green-100 text-green-800" :
                                  exp.paymentStatus === "Partially" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {exp.paymentStatus || "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No expenses</p>
                  )}
                </div>
              </div>

              {/* Payments */}
              {paymentsList.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign size={20} className="text-green-600" />
                      Payments ({paymentsList.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-500">Total Payments</div>
                        <div className="text-lg font-semibold text-gray-900">{payments.totalPayments ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Total Amount</div>
                        <div className="text-lg font-semibold text-green-600">{formatMoney(payments.totalPaymentsAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">To Bills</div>
                        <div className="text-lg font-semibold text-blue-600">{formatMoney(payments.paymentsToBills)}</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Payment #</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paymentsList.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.paymentNumber || "—"}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900">{formatMoney(p.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
