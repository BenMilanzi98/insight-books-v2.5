"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

const emptyForm = () => ({
  type: "transfer",
  invoiceId: "",
  amount: "",
  paymentDate: new Date().toISOString().split("T")[0],
  sourceAccount: "",
  destinationAccount: "",
  reference: "",
  notes: "",
});

/**
 * @param {boolean} [transferFundsOnly] — /payments: hide type selector; only internal transfers; balances from management API.
 */
const PaymentModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  transferFundsOnly = false,
}) => {
  const [formData, setFormData] = useState(emptyForm);
  const [invoices, setInvoices] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchPaymentAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/payment-accounts/balances", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && data.accounts) {
        setPaymentAccounts(
          data.accounts.map((a) => ({
            ...a,
            balance: typeof a.balance === "number" ? a.balance : parseFloat(a.balance) || 0,
          }))
        );
        return;
      }
      const fallback = await fetch("/api/payment-accounts?activeOnly=true", { cache: "no-store" });
      const fb = await fallback.json();
      if (fallback.ok && fb.success && fb.paymentAccounts) {
        setPaymentAccounts(
          fb.paymentAccounts
            .filter((a) => a.isActive !== false)
            .map((a) => ({
              id: a.id,
              name: a.name,
              accountType: a.accountType,
              reference: a.reference,
              isSystem: a.isSystem,
              isActive: a.isActive,
              balance: typeof a.balance === "number" ? a.balance : 0,
            }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch payment accounts", err);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (transferFundsOnly) {
      setFormData(emptyForm());
      setErrors({});
    }
    fetchPaymentAccounts();
  }, [isOpen, transferFundsOnly, fetchPaymentAccounts]);

  useEffect(() => {
    if (!isOpen || transferFundsOnly) return;
    if (formData.type === "invoice") {
      const fetchInvoices = async () => {
        const res = await fetch("/api/invoices?status=Pending,Partial");
        const data = await res.json();
        setInvoices(data.invoices || []);
      };
      fetchInvoices();
    }
  }, [formData.type, isOpen, transferFundsOnly]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "amount" && value !== "" && !/^\d+(\.\d{0,2})?$/.test(value) ? prev.amount : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    const selectedInvoice = invoices.find((inv) => inv.id === invoiceId);

    setFormData((prev) => ({
      ...prev,
      invoiceId,
      amount: selectedInvoice?.amountDue?.toString() || "",
    }));
  };

  const getBalance = (accountIdOrName) => {
    const account = paymentAccounts.find(
      (acc) => acc.id === accountIdOrName || acc.name === accountIdOrName
    );
    if (!account) return 0;
    if (account.balance != null) {
      return Number(account.balance) || 0;
    }
    return 0;
  };

  const amount = parseFloat(formData.amount || "0");

  const validateForm = () => {
    const newErrors = {};

    if (!formData.paymentDate) newErrors.paymentDate = "Payment date required";
    if (!amount || amount <= 0) newErrors.amount = "Enter a valid amount";

    if (transferFundsOnly || formData.type === "transfer") {
      if (!formData.sourceAccount) newErrors.sourceAccount = "Source account required";
      if (!formData.destinationAccount) newErrors.destinationAccount = "Destination account required";
      if (formData.sourceAccount === formData.destinationAccount) {
        newErrors.destinationAccount = "Source and destination must be different";
      }
      const sourceBalance = getBalance(formData.sourceAccount);
      if (sourceBalance < amount) {
        newErrors.sourceAccount = `Insufficient balance. Available: MWK ${sourceBalance.toLocaleString()}`;
      }
    } else {
      if (formData.type === "invoice") {
        if (!formData.invoiceId) newErrors.invoiceId = "Invoice is required";
      }
      if (["expense", "transfer"].includes(formData.type)) {
        if (!formData.sourceAccount) newErrors.sourceAccount = "Source account required";
        const sourceBalance = getBalance(formData.sourceAccount);
        if (amount > sourceBalance) {
          newErrors.sourceAccount = `Insufficient funds. Available: MWK ${sourceBalance}`;
        }
      }
      if (!formData.sourceAccount) {
        newErrors.sourceAccount = "Source account required";
      }
      if (formData.type === "transfer" && !formData.destinationAccount) {
        newErrors.destinationAccount = "Destination account required";
      }
      if (formData.type === "transfer") {
        if (formData.sourceAccount === formData.destinationAccount) {
          newErrors.destinationAccount = "Source and destination accounts must be different";
        }
        const sourceBalance = getBalance(formData.sourceAccount);
        if (sourceBalance < amount) {
          newErrors.sourceAccount = `Insufficient balance. Available: MWK ${sourceBalance}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        type: transferFundsOnly ? "transfer" : formData.type,
        amount,
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
      alert(err?.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amt) =>
    Number(amt || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const showTransferSourceDest = transferFundsOnly || ["expense", "transfer"].includes(formData.type);
  const showTransferDestination = transferFundsOnly || formData.type === "transfer";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {transferFundsOnly
              ? "Record New Transaction"
              : mode === "create"
                ? "Record New Transaction"
                : "Edit Transaction"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 focus:outline-none">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="payment-modal-form" onSubmit={handleSubmit}>
            {!transferFundsOnly && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{tt('Type')}</label>
                <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded-md">
                  <option value="sale">{tt('Sale Payment')}</option>
                  <option value="invoice">{tt('Invoice Payment')}</option>
                  <option value="expense">{tt('Expense')}</option>
                  <option value="transfer">{tt('Transfer')}</option>
                </select>
              </div>
            )}

            {!transferFundsOnly && formData.type === "invoice" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{tt('Invoice')}</label>
                <select
                  name="invoiceId"
                  value={formData.invoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">{tt('Select invoice')}</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.client?.name} (MK {inv.amountDue})
                    </option>
                  ))}
                </select>
                {errors.invoiceId && <p className="text-red-500 text-sm">{errors.invoiceId}</p>}
              </div>
            )}

            {showTransferSourceDest && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{tt('Source account')}</label>
                <select name="sourceAccount" value={formData.sourceAccount} onChange={handleChange} className="w-full p-2 border rounded-md">
                  <option value="">{tt('Select source account')}</option>
                  {paymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} — Balance: MWK {formatCurrency(getBalance(account.id))}
                    </option>
                  ))}
                </select>
                {formData.sourceAccount && (
                  <p className="text-sm text-gray-500 mt-1">
                    Available: MWK {formatCurrency(getBalance(formData.sourceAccount))} · After transfer: MWK{" "}
                    {formatCurrency(getBalance(formData.sourceAccount) - amount)}
                  </p>
                )}
                {errors.sourceAccount && <p className="text-red-500 text-sm">{errors.sourceAccount}</p>}
              </div>
            )}

            {showTransferDestination && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{tt('Destination account')}</label>
                <select
                  name="destinationAccount"
                  value={formData.destinationAccount}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">{tt('Select destination account')}</option>
                  {paymentAccounts
                    .filter((account) => account.id !== formData.sourceAccount)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} — Balance: MWK {formatCurrency(getBalance(account.id))}
                      </option>
                    ))}
                </select>
                {formData.destinationAccount && (
                  <p className="text-sm text-gray-500 mt-1">
                    Current: MWK {formatCurrency(getBalance(formData.destinationAccount))} · After transfer: MWK{" "}
                    {formatCurrency(getBalance(formData.destinationAccount) + amount)}
                  </p>
                )}
                {errors.destinationAccount && <p className="text-red-500 text-sm">{errors.destinationAccount}</p>}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Amount (MWK)</label>
              <input
                type="text"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-red-500 text-sm">{errors.amount}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">{tt('Payment date')}</label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
              />
              {errors.paymentDate && <p className="text-red-500 text-sm">{errors.paymentDate}</p>}
            </div>
            {!transferFundsOnly && ["sale", "invoice"].includes(formData.type) && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{tt('Payment method')}</label>
                <select name="sourceAccount" value={formData.sourceAccount} onChange={handleChange} className="w-full p-2 border rounded-md">
                  <option value="">{tt('Select payment method')}</option>
                  {paymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {formData.sourceAccount && (
                  <p className="text-sm text-gray-500 mt-1">
                    New balance: MWK {formatCurrency(getBalance(formData.sourceAccount) + amount)}
                  </p>
                )}
                {errors.sourceAccount && <p className="text-red-500 text-sm">{errors.sourceAccount}</p>}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">{tt('Reference')}</label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                placeholder={tt('Optional reference…')}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">{tt('Notes')}</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full p-2 border rounded-md"
                placeholder={tt('Additional notes…')}
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100">
            {tt('Cancel')}
          </button>
          <button
            type="submit"
            form="payment-modal-form"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {loading ? "Saving…" : transferFundsOnly ? "Transfer" : mode === "create" ? "Record" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
